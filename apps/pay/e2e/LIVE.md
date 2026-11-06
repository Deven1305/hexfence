# Live Sepolia gate runner

This is an explicitly **scripted wallet**, not H6 or a Safe{Wallet} test. It sends
real Sepolia transactions and spends test ETH. Keys stay in the ignored root
`.env` and the Node signer; none are entered into the browser or an extension.

After funding, Guard deployment, `setup-demo.js` and real Arkiv publication,
set `DEMO_SAFE_ADDRESS`, `VITE_GUARD_ADDRESS`, `VITE_ARKIV_PUBLISHER` and the RPC
names in that `.env`. Install as in `docs/RUNBOOK_T8.md` and install Chromium once:

```
corepack pnpm@10.34.9 --filter @hexfence/pay exec playwright install chromium
corepack pnpm@10.34.9 --filter @hexfence/pay test:live --explorer
corepack pnpm@10.34.9 --filter @hexfence/pay test:live
corepack pnpm@10.34.9 --filter @hexfence/pay test:live --direct-l
```

The ordinary production source is built into an ignored E2E folder, with no test
ingress. The runner tries Nox and real Guard/payee reads, retries once on failure,
then reloads and explicitly chooses the labelled direct Skip route. It records
which path actually worked. UI payments run L (RED, last-six friction), fresh B
(AMBER) and P (GREEN). The signer restricts the chain, Safe, recipients, value and
gas, and rejects duplicate recorded broadcasts. The final mode sends L directly
with gas 200000 and labels it **direct script, not Safe{Wallet}**.

Public hashes/results, screenshots and 1280×960 videos are saved outside git in
`C:/hexfence-work/live-artifacts/` by default. `HEXFENCE_LIVE_OUTPUT` may select a
different directory outside the worktree. Keep `pay-live.json`: existing hashes
are not resent on reruns. A broadcast without UI confirmation still needs receipt
and checker review; it is not silently retried. Run `check-t8.js` separately for
both reverted L hashes. No live result is implied merely by this harness existing.
