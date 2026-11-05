# T8 operator runbook (PowerShell, repo root)

Use a checkout of `main`; keep it under `C:/hexfence-work/`.
**Not run on Sepolia in this work:** deploy, live Etherscan verification, demo
setup/removal, these payment/checker steps. Local contract tests passed. The
publish/rerun, hosted flows and human reviews below have not been run by Codex.

1. **H1 → H2.** Use Node 22. Preserve any existing root `.env`:
   ```powershell
   if (-not (Test-Path .env)) { Copy-Item .env.example .env }
   corepack pnpm@10.34.9 install --frozen-lockfile
   Push-Location contracts
   npm install --legacy-peer-deps
   npx hardhat run scripts/deploy.js --network sepolia
   Pop-Location
   ```
   Before deployment, privately fill root `.env`: `SEPOLIA_RPC_URL`, a fresh
   **testnet-only** `DEPLOYER_PRIVATE_KEY`, and `ETHERSCAN_API_KEY`; faucet-fund the
   owner with about 0.05 Sepolia ETH. Never print the key. Save the public deploy
   hash/address and put the address in root `.env` as `VITE_GUARD_ADDRESS`.

2. **Verify → setup (H3).** Enter the actual printed Guard address:
   ```powershell
   $guard = Read-Host 'Deployed Guard address'
   Push-Location contracts
   npx hardhat verify --network sepolia $guard
   node scripts/setup-demo.js
   Pop-Location
   $safe = Read-Host 'Printed demo Safe address'
   ```
   Verification uses the pinned Hardhat-2-compatible plugin and Sepolia V2 adapter;
   it needs no constructor arguments. Setup reuses `VITE_GUARD_ADDRESS`, creates a
   real 1-of-1 Safe 1.4.1, funds to 0.002 ETH, installs/approves P, removes/re-enables
   the Guard. Save all printed hashes; set `DEMO_SAFE_ADDRESS` for reruns. **The
   deployer key is the only owner; Pay's wallet must use that same testnet-only key.**
   The script's drill does not claim a human Safe{Wallet} UI test.

3. **H5 → T4b.** Privately set `ARKIV_PRIVATE_KEY` (new testnet publisher),
   `ARKIV_ACCESS_KEY` and `MAINNET_RPC_URL`; get publisher tGLM/access at
   [Arkiv Hub](https://hub.arkiv.network). Run:
   ```powershell
   corepack pnpm@10.34.9 --filter @hexfence/detector detect
   corepack pnpm@10.34.9 --filter @hexfence/detector publish:arkiv --limit 25
   corepack pnpm@10.34.9 --filter @hexfence/detector publish:arkiv --limit 25
   ```
   Keep the same `out/evidence.jsonl` between publishes. The rerun must print
   **`0 created`**. Put the public publisher in `VITE_ARKIV_PUBLISHER`; open the
   explorer and confirm real records labelled **suspected**.

4. **H6 → H7.** Set `VITE_SEPOLIA_RPC_URL`; in another terminal run
   `corepack pnpm@10.34.9 --filter @hexfence/pay dev`. Pay starts on Nox, which can
   take a minute or more. Guard and payee reads through Nox are untested: if they error,
   reload and press **Skip: read directly (not anonymous)**. Use the owner wallet on
   Sepolia, load the printed Safe and confirm active Guard. Pay 0.0001 ETH to
   L (`0x4E185a3FC4B530244aB9ed0dE38167b403344120`): RED, type **344120**, send,
   obtain a mined `LookalikeOfApprovedPayee` revert. Pay a fresh B (AMBER, success),
   then P (`0x4E185e251Ac7fB83E9DE10723EAda46cadE74120`, GREEN, success).
   Close Pay; pay L again from **Safe{Wallet}**, choosing execute anyway with
   **manual gas 200000**. Save that second reverted hash separately.

5. **Check → paste public rows.** Enter actual hashes (including the setup output):
   ```powershell
   $b = Read-Host 'B address'
   foreach ($name in 'setguard','approve','remove','reenable','lpay','bpay','ppay') { Set-Variable -Name $name -Value (Read-Host "$name transaction hash") }
   node contracts/scripts/check-t8.js --guard $guard --safe $safe --p 0x4E185e251Ac7fB83E9DE10723EAda46cadE74120 --l 0x4E185a3FC4B530244aB9ed0dE38167b403344120 --b $b --setguard $setguard --approve $approve --remove $remove --reenable $reenable --lpay $lpay --bpay $bpay --ppay $ppay
   ```
   Require exit **0**. Repeat with `--lpay` set to the Safe{Wallet} hash. Historical
   replay must decode the exact Guard error; `status 0, reason not decoded` fails.
   Paste passing rows into PROGRESS/README tables. Separately confirm explorer
   evidence and the H6 wallet flow: the checker explicitly does not check them.

6. **After T8:** a human fills all 30 `apps/detector/labels/h9-sample.csv` labels
   (H9); then run `corepack pnpm@10.34.9 --filter @hexfence/detector precision`.
   Set repository variables `VITE_ARKIV_PUBLISHER`, `VITE_GUARD_ADDRESS`,
   `VITE_SEPOLIA_RPC_URL`; optional `VITE_MAINNET_RPC_URL`, `VITE_ARKIV_ACCESS_KEY`,
   `VITE_EXPLORER_URL`. Values enter **public JavaScript**; keys must be public or
   origin-restricted. Set **Settings → Pages → Source: GitHub Actions**, then build
   on main; record both URLs. **H10:** a native Hindi reader
   checks the two verdicts against spec §3.4 and records their name. Never claim
   H9/H10, hosted evidence or wallet execution complete without those human checks.
