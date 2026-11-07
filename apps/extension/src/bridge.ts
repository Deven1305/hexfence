import { record, type Request } from './interception';
let busy = false;
const channel = new MessageChannel();
const page = channel.port1;
window.postMessage({ channel: 'hexfence:init' }, window.location.origin, [channel.port2]);
page.onmessage = (event: MessageEvent) => {
  const data: unknown = event.data;
  if (!record(data) || typeof data.id !== 'string' || !record(data.request)) return;
  const request = data.request as unknown as Request;
  const reply = (approved: boolean) => page.postMessage({ id: data.id, approved });
  if (busy) { reply(false); return; }
  busy = true;
  void (async () => {
    let id: string | undefined;
    let approved = false;
    try {
      const result = await chrome.runtime.sendMessage({ type: 'begin', request, chainId: data.chainId });
      if (!record(result) || typeof result.id !== 'string') return;
      id = result.id;
      const deadline = Date.now() + 170_000;
      while (Date.now() < deadline) {
        const state = await chrome.runtime.sendMessage({ type: 'status', id });
        if (!record(state)) break;
        if (typeof state.approved === 'boolean') { approved = state.approved; break; }
        await new Promise(resolve => setTimeout(resolve, 700));
      }
    } catch { /* extension reload, navigation, worker restart: reject */ }
    finally {
      if (id) void chrome.runtime.sendMessage({ type: 'forget', id }).catch(() => {});
      busy = false;
      reply(approved);
    }
  })();
};
