import { gateRequest, matchRequest, record, type Request } from './interception';

interface Provider { request: (request: Request) => Promise<unknown>; providers?: unknown[] }
const wrapped = new WeakSet<object>();
// Replies travel over a port only the bridge holds: page scripts on this origin can post window
// messages, so a window-message reply could be forged. This capture listener runs before any page
// script exists and stops propagation, so the page never sees the port.
let port: MessagePort | null = null;
const waiting = new Map<string, (approved: boolean) => void>();
window.addEventListener('message', event => {
  if (port || event.source !== window || !record(event.data) || event.data.channel !== 'hexfence:init' || !event.ports[0]) return;
  event.stopImmediatePropagation();
  port = event.ports[0];
  port.onmessage = (reply: MessageEvent) => {
    if (reply.isTrusted && record(reply.data) && typeof reply.data.id === 'string') waiting.get(reply.data.id)?.(reply.data.approved === true);
  };
}, true);
function review(request: Request, chainId: unknown): Promise<boolean> {
  const id = crypto.randomUUID();
  return new Promise(resolve => {
    if (!port) { resolve(false); return; }
    const finish = (approved: boolean) => { clearTimeout(timer); waiting.delete(id); resolve(approved); };
    const timer = setTimeout(() => finish(false), 180_000);
    waiting.set(id, finish);
    port.postMessage({ id, request, chainId });
  });
}
function wrap(value: unknown, source: string): void {
  if (!record(value) || typeof value.request !== 'function' || wrapped.has(value)) return;
  const provider = value as unknown as Provider;
  const original = provider.request.bind(provider);
  const replacement = async (args: Request): Promise<unknown> => {
    if (!matchRequest(args)) return original(args);
    // Freeze the exact JSON-RPC request we review; callers cannot mutate it during the popup.
    const snapshot = JSON.parse(JSON.stringify(args)) as Request;
    const capture = matchRequest(snapshot)!;
    console.info('[HexFence] caught', { method: snapshot.method, kind: capture.kind, source, decoded: capture.call !== null });
    return gateRequest(async () => {
      let chainId: unknown;
      try { chainId = await original({ method: 'eth_chainId' }); } catch { return false; }
      if (!await review(snapshot, chainId)) return false;
      // A wallet chain change during review invalidates the decision.
      return chainId === await original({ method: 'eth_chainId' });
    }, () => original(snapshot));
  };
  try {
    provider.request = replacement;
    if (provider.request !== replacement) throw new Error();
    wrapped.add(provider);
    console.info('[HexFence] provider wrapped', { source });
  } catch { console.warn('[HexFence] provider could not be wrapped', { source }); }
  if (Array.isArray(provider.providers)) for (const p of provider.providers) wrap(p, 'ethereum.providers');
}
const page = window as Window & { ethereum?: unknown };
// Preserve accessor semantics, including wallets that inject after document_start.
const descriptor = Object.getOwnPropertyDescriptor(window, 'ethereum');
if (!descriptor || descriptor.configurable) {
  let current = descriptor?.value as unknown;
  Object.defineProperty(window, 'ethereum', {
    configurable: true, enumerable: descriptor?.enumerable ?? true,
    get() { const p = descriptor?.get ? descriptor.get.call(window) : current; wrap(p, 'window.ethereum'); return p; },
    set(p: unknown) {
      if (descriptor?.set) descriptor.set.call(window, p);
      else if (!descriptor?.get && descriptor?.writable !== false) current = p;
      wrap(descriptor?.get ? descriptor.get.call(window) : current, 'window.ethereum');
    },
  });
}
window.addEventListener('eip6963:announceProvider', event => {
  const detail: unknown = (event as CustomEvent).detail;
  if (record(detail)) wrap(detail.provider, 'EIP-6963');
}, { capture: true });
window.dispatchEvent(new Event('eip6963:requestProvider'));
window.addEventListener('ethereum#initialized', () => wrap(page.ethereum, 'ethereum#initialized'));
wrap(page.ethereum, 'window.ethereum');
// Covers non-configurable late replacements. This race is part of the human go/no-go.
setInterval(() => wrap(page.ethereum, 'window.ethereum'), 250);
console.info('[HexFence] interception ready');
