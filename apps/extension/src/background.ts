import { check, cannotVerify, type Review } from './check';
import { matchRequest, record, type Request } from './interception';
import { mayContinue } from './policy';

interface Pending { tab: number; document: string; expires: number; window?: number; review: Review; approved?: boolean }
const key = (id: string) => `review:${id}`;
async function read(id: string): Promise<Pending | undefined> {
  return (await chrome.storage.session.get(key(id)))[key(id)] as Pending | undefined;
}
async function write(id: string, pending: Pending): Promise<void> { await chrome.storage.session.set({ [key(id)]: pending }); }
function pageSender(sender: chrome.runtime.MessageSender): boolean {
  try { return sender.id === chrome.runtime.id && new URL(sender.url ?? '').origin === 'https://app.safe.global' && sender.tab?.id !== undefined && !!sender.documentId; }
  catch { return false; }
}
function owns(sender: chrome.runtime.MessageSender, pending: Pending): boolean {
  return pageSender(sender) && sender.tab?.id === pending.tab && sender.documentId === pending.document;
}
async function handle(message: unknown, sender: chrome.runtime.MessageSender): Promise<unknown> {
  if (!record(message)) return {};
  if (message.type === 'begin' && pageSender(sender) && record(message.request)) {
    const request = message.request as unknown as Request;
    if (!matchRequest(request)) return {};
    // Bound storage and prevent duplicate windows for a document, including after worker suspension.
    const entries = await chrome.storage.session.get(null);
    for (const [entryKey, value] of Object.entries(entries)) {
      if (!entryKey.startsWith('review:')) continue;
      const pending = value as Pending;
      if (pending.expires < Date.now()) {
        await chrome.storage.session.remove(entryKey);
        if (pending.window !== undefined) void chrome.windows.remove(pending.window).catch(() => {});
      } else if (pending.tab === sender.tab!.id && pending.document === sender.documentId) return {};
    }
    const id = crypto.randomUUID();
    const pending: Pending = { tab: sender.tab!.id!, document: sender.documentId!, expires: Date.now() + 170_000,
      review: { level: 'GREY', sentences: ['Reading payment context…'], ready: false } };
    await write(id, pending);
    try {
      const win = await chrome.windows.create({ url: chrome.runtime.getURL(`review.html?id=${id}`), type: 'popup', width: 560, height: 720 });
      if (win.id === undefined) throw new Error();
      pending.window = win.id;
      await write(id, pending);
      // Keep no raw request or signatures in storage. Bound the network phase.
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        pending.review = await Promise.race([check(request, message.chainId), new Promise<Review>(resolve => {
          timer = setTimeout(() => resolve(cannotVerify('Network reads timed out.')), 20_000);
        })]);
      } finally { clearTimeout(timer); }
      const current = await read(id);
      if (current) await write(id, { ...current, review: pending.review });
      return { id };
    } catch {
      await chrome.storage.session.remove(key(id));
      return {};
    }
  }
  if (typeof message.id !== 'string') return {};
  const pending = await read(message.id);
  if (!pending) return { approved: false };
  // Extension pages may omit sender.tab; Chrome still supplies their authenticated URL.
  const popup = sender.id === chrome.runtime.id && sender.url === chrome.runtime.getURL(`review.html?id=${message.id}`);
  if (message.type === 'view' && popup) return { ...pending.review, expired: Date.now() > pending.expires || pending.approved !== undefined };
  if (message.type === 'decide' && popup && pending.approved === undefined && Date.now() < pending.expires) {
    pending.approved = message.approved === true && mayContinue(pending.review, message.typed);
    await write(message.id, pending);
    return { done: true };
  }
  if (message.type === 'status' && owns(sender, pending)) {
    return { approved: Date.now() >= pending.expires ? false : pending.approved };
  }
  if (message.type === 'forget' && owns(sender, pending)) {
    await chrome.storage.session.remove(key(message.id));
    if (pending.window !== undefined) void chrome.windows.remove(pending.window).catch(() => {});
  }
  return {};
}
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  void handle(message, sender).then(respond, () => respond({ approved: false }));
  return true;
});
chrome.windows.onRemoved.addListener(windowId => {
  void (async () => {
    for (const [entryKey, value] of Object.entries(await chrome.storage.session.get(null))) {
      if (!entryKey.startsWith('review:')) continue;
      const pending = value as Pending;
      if (pending.window === windowId && pending.approved === undefined) {
        pending.approved = false;
        await chrome.storage.session.set({ [entryKey]: pending });
      }
    }
  })();
});
