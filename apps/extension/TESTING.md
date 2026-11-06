# Human go/no-go — pending

Only a human using MetaMask on `https://app.safe.global/` can settle this spike.
Unit tests and a successful build do **not** establish interception reliability.
No go/no-go result has been claimed by the implementation agent.

## Build and load

Use Node 22 and the repository's pnpm version. From the repository root:

```powershell
corepack pnpm@10.34.9 install
corepack pnpm@10.34.9 --filter @hexfence/extension test
corepack pnpm@10.34.9 --filter @hexfence/extension build
```

1. In Chrome, open `chrome://extensions`, enable **Developer mode**, choose
   **Load unpacked**, and select `apps/extension/dist` (not the source directory).
2. Enable MetaMask. Use a testnet owner account and an isolated Sepolia demo Safe.
3. Open a **new** `https://app.safe.global/` tab after loading the extension.
   Reload existing tabs after every extension reload.
4. Open that tab's DevTools Console, enable Info messages, filter `HexFence`, and
   enable Preserve log. Expect `[HexFence] interception ready` and
   `[HexFence] provider wrapped` for `window.ethereum` and/or `EIP-6963`.
   Never paste keys, seed phrases, typed data, calldata, signatures or RPC URLs
   into the console. Logs contain only source, method, kind and decoded boolean.

## Step 1: settle capture within minutes (RPC setup is unnecessary)

1. Connect MetaMask to the Sepolia Safe in the actual Safe web UI. Create a
   single ETH payment to a test recipient, then choose the signing action.
2. Before the wallet signing confirmation, expect a separate **HexFence payment
   review** window. With no options configured it must display GREY and the fixed
   “Cannot verify this transaction type…” sentence; it must never imply a pass.
3. In the page console expect `caught` with method `eth_signTypedData_v4`, kind
   `SafeTx`, and `decoded: true`. Record only these fields, Chrome/MetaMask
   versions and which provider source was wrapped. Do not record payloads.
4. Click **Reject**. The page request must reject with EIP-1193 code `4001` and
   must not open a new wallet signing prompt for this request. The page may show
   its own cancellation message. If necessary enable DevTools **Pause on caught
   exceptions** to inspect the error's numeric `code` without printing payloads.
5. Retry, choose **Continue to wallet**, then **reject in MetaMask** to avoid
   signing during the initial capture test. There should be one wallet prompt,
   and its rejection should reach the web UI normally.
6. Separately exercise the execution path: use a demo payment that has enough
   owner confirmations, then choose **Execute** in Safe. The extension should
   catch `eth_sendTransaction`, kind `execTransaction`, `decoded: true` before
   the MetaMask transaction confirmation. Reject in HexFence. Merely capturing
   typed data does not establish the execution path.
7. Repeat after a full reload, after disconnect/reconnect, and with MetaMask
   selected through Safe's injected-wallet discovery. Check both the legacy
   `window.ethereum` and EIP-6963 paths; if the UI does not expose both, record
   the untested path rather than claiming it passed. Re-announcements must not
   create duplicate windows.

**GO requires both real request shapes to be captured and decoded consistently,
with Reject preventing forwarding.** Missing interception, an unwrappable
provider, a wallet confirmation appearing first, or a broken web UI is a NO-GO
for the affected path. Record the human result below; do not infer it from mocks.
The non-configurable-provider polling fallback has a race; test it explicitly.

## Step 2: verdict and lifecycle checks

1. From `chrome://extensions` → HexFence → **Details** → **Extension options**,
   enter a Sepolia HTTPS RPC URL and the actual deployed HexFence Guard address.
   Optionally enter the real Arkiv publisher address. Save and grant only the
   requested host(s). No private key is needed. Reload the Safe tab.
2. Create single ETH and ERC-20 transfer payments in Safe. An approved payee
   must show GREEN with Pay's fixed “Approved payee…” text. A new recipient must
   show AMBER with the three fixed Pay sentences. Check the full recipient.
3. Use the organiser's synthetic Sepolia lookalike of an approved payee. Expect
   RED “resembles your approved payee”, never a public-evidence claim. Continue
   stays disabled until the last six recipient hex characters are entered
   (case-insensitive, surrounding whitespace ignored, as in Pay). Wrong or
   partial input must not forward. Reject must return `4001`.
4. Continue a RED request only when deliberately testing the isolated demo.
   With the configured Guard active, execution should still be refused on-chain.
   The extension's Continue action never disables or overrides the Guard.
5. When a publisher is configured, inspect the extension worker's Network panel:
   Arkiv queries must read all records for that publisher, paginated in bulk;
   there must be no recipient filter. Exact listed addresses use the fixed
   mainnet / publisher / “Status: suspected” copy. No receipt verification occurs.
6. For each review, inspect RPC traffic: chain ID and block number, one Guard
   slot read, and exactly one `payees(safe)` read at that block. There must be no
   `isApprovedPayee` or per-recipient threat request. Concurrent popup refreshes
   must not cause extra chain or Arkiv reads.
7. Try an unsupported contract call / MultiSend and a delegatecall. Unsupported
   or undecodable requests must show GREY “Cannot verify…”; delegatecall uses
   Pay's fixed refusal sentence only when the configured Guard is active.
8. In the isolated demo only, test a removed/different Guard. The window must
   show Pay's Guard-inactive notice rather than claim on-chain refusal.
9. Test missing options, invalid RPC, wrong RPC chain, missing host permission,
   failed Arkiv reads, and a wallet or typed-data chain other than Sepolia. All
   must show GREY, never GREEN. Change the wallet chain while a review is open;
   the original request must reject rather than forward after approval.
10. Close the review window, wait past three minutes, reload the extension while
    pending, and retry after navigating away/back. Requests must reject or become
    unavailable, never silently forward. Stop the worker using Chrome DevTools
    while a review is open, then reopen its inspector: a completed pending review
    should survive in session storage. A stopped worker during network loading
    may leave a loading review until expiry; retry rather than treating it as a pass.
11. Open two Safe tabs and initiate reviews. Each decision must affect only its
    own document/request. Repeated clicks in one tab must not create extra windows.

## Limits and permissions

- This is a cooperative page interception spike, not an authenticated boundary
  against scripts executing in the MAIN world. The same-origin page can observe
  or spoof the DOM message bridge, replace providers, or keep earlier references.
  On-chain Guard enforcement remains independent of this UI. No claim of
  comprehensive wallet protection is made.
- Only top-level `app.safe.global` documents are injected. WalletConnect, mobile,
  relayers, other domains, iframe providers, legacy `send`/`sendAsync`, module
  execution and unsupported methods are outside this interception scope.
- No signing payload, signature or transaction is persisted. Pending display
  context is in `storage.session`, bound to tab/document and expires. Options
  (including any RPC URL access token) are in local browser storage, not synced.
- Required API permission: `storage`. No `tabs`, `scripting`, `webRequest`,
  trackers, remotely hosted code or web-accessible resources. `windows.create`
  requires no additional API permission. Static content-script matches grant
  access only to `https://app.safe.global/*`.
- The broad **optional** HTTPS declaration is necessary to accept an arbitrary
  user-configured RPC host. Options request only its exact origin and, if enabled,
  the fixed Rabdi origin. Changing options removes obsolete origins; Clear
  removes configured grants. No arbitrary site is injected by these grants.
- The English presentation is copied from Pay with a parity test; verdicts and
  transaction decoding run exclusively in `@hexfence/shared`. Reads use viem
  and the existing `@hexfence/arkiv` bulk reader. Guard discovery uses the
  documented GuardManager slot because Safe 1.3/1.4 `getGuard()` is internal.

API references read during implementation:
[Chrome content scripts](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts),
[Chrome windows](https://developer.chrome.com/docs/extensions/reference/api/windows),
[optional host permissions](https://developer.chrome.com/docs/extensions/reference/api/permissions),
[EIP-6963](https://eips.ethereum.org/EIPS/eip-6963),
[EIP-1193](https://eips.ethereum.org/EIPS/eip-1193),
[viem readContract](https://github.com/wevm/viem/blob/main/site/pages/docs/contract/readContract.md),
[viem getStorageAt](https://github.com/wevm/viem/blob/main/site/pages/docs/contract/getStorageAt.md),
[Safe 1.4.1 GuardManager](https://github.com/safe-global/safe-smart-account/blob/v1.4.1/contracts/base/GuardManager.sol),
[Arkiv query guide](https://docs.arkiv.network/start-here/first-entity/).

## Waiting on humans

- [ ] Build/load unpacked and confirm typed-data capture with MetaMask.
- [ ] Confirm actual `execTransaction` capture with MetaMask.
- [ ] Confirm 4001, no forwarding on Reject/close/expiry, and one forwarding on Continue.
- [ ] Complete verdict, friction, network and worker lifecycle checks above.
- Human name / date / Chrome / MetaMask versions:
- Observed provider sources and request kinds (metadata only):
- GO / NO-GO and any untested paths:

See `REPORT.md` for the implementation agent's local validation results.
