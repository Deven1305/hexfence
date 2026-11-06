import { record, type Request } from './interception';
const origin = 'https://app.safe.global';
let busy = false;
window.addEventListener('message', event => {
  const data: unknown = event.data;
  if (event.source !== window || event.origin !== origin || !record(data) ||
      data.channel !== 'hexfence:request' || typeof data.id !== 'string' || !record(data.request)) return;
  const request = data.request as unknown as Request;
  const reply = (approved: boolean) => window.postMessage({ channel: 'hexfence:result', id: data.id, approved }, origin);
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
});
