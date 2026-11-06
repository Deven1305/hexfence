import './style.css';
import { ARKIV_ORIGIN, parseSettings, rpcOrigin, settings } from './config';
const form = document.querySelector<HTMLFormElement>('#options')!;
const rpc = document.querySelector<HTMLInputElement>('#rpc')!;
const guard = document.querySelector<HTMLInputElement>('#guard')!;
const publisher = document.querySelector<HTMLInputElement>('#publisher')!;
const status = document.querySelector<HTMLElement>('#status')!;
void settings().then(config => {
  rpc.value = config.rpc; guard.value = config.guard; publisher.value = config.publisher ?? '';
}).catch(() => {});
form.onsubmit = event => {
  event.preventDefault();
  void (async () => {
    try {
      const config = parseSettings({ rpc: rpc.value.trim(), guard: guard.value.trim(), publisher: publisher.value.trim() });
      const origins = [rpcOrigin(config.rpc), ...(config.publisher ? [ARKIV_ORIGIN] : [])];
      // Invoke directly from the user gesture, before any storage/network await.
      if (!await chrome.permissions.request({ origins })) { status.textContent = 'Network access was not granted.'; return; }
      const old = await settings().catch(() => undefined);
      await chrome.storage.local.set({ settings: config });
      if (old) {
        const obsolete = [rpcOrigin(old.rpc), ...(old.publisher ? [ARKIV_ORIGIN] : [])].filter(origin => !origins.includes(origin));
        if (obsolete.length) await chrome.permissions.remove({ origins: obsolete });
      }
      status.textContent = 'Settings saved. Reload app.safe.global before testing.';
    } catch { status.textContent = 'Settings could not be saved. Enter an HTTPS RPC URL and valid addresses.'; }
  })();
};
document.querySelector<HTMLButtonElement>('#clear')!.onclick = () => {
  void (async () => {
    const old = await settings().catch(() => undefined);
    await chrome.storage.local.remove('settings');
    if (old) await chrome.permissions.remove({ origins: [rpcOrigin(old.rpc), ...(old.publisher ? [ARKIV_ORIGIN] : [])] });
    form.reset(); status.textContent = 'Settings and network grants cleared.';
  })().catch(() => { status.textContent = 'Could not clear settings.'; });
};
