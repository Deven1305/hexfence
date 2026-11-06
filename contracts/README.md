# HexFenceGuard — reference implementation (AI-generated, tested)

**What this is:** a reference Safe transaction guard for HexFence, written by Claude on Fri 6 Nov 2026 (after kickoff) and tested against the **real Safe 1.4.1 contracts** (npm `@safe-global/safe-contracts@1.4.1-build.0`) in Hardhat's in-process EVM. **14 tests pass** (13 from the reference + the ready-made demo pair).

**What Baqir must do (ETHGlobal rules):** read every line, adapt it, commit it in the team repo **with a clear message** (e.g. "Guard: start from Claude reference, reviewed by Baqir"), and list it in `docs/AI_USAGE.md`. Don't present it as hand-written.

## Run
```
npm install --legacy-peer-deps      # safe-contracts declares an old ethers peer; this is expected
npx hardhat test                    # 14 passing
```
If your network blocks the solc download, Hardhat can't fetch 0.8.26. Use a normal connection or a local solc.

## Deploy (Sepolia, test funds only)
```
SEPOLIA_RPC_URL=... DEPLOYER_PRIVATE_KEY=0x<testnet-only key> npx hardhat run scripts/deploy.js --network sepolia
```
(The deploy script was not run from the sandbox, which had no Sepolia access.)
Then, in Safe{Wallet} → Apps → Transaction Builder, run **one call per transaction**. Batches use a MultiSend delegatecall, and this guard rejects delegatecalls.
1. To your Safe: `setGuard(<guard>)`. (Before this, check `VERSION()` on your Safe; if it isn't 1.4.1, confirm `setGuard` accepts the guard. It reverts with `GS300` if the interface ID doesn't match.)
2. To the guard: `approvePayee(<supplier>)`
3. **Removal drill:** to your Safe: `setGuard(0x0000000000000000000000000000000000000000)` → it must succeed → re-enable with step 1. Save both tx hashes for the README.

## Behaviour (what the tests prove)

| Case | Result |
|---|---|
| ETH / ERC-20 `transfer` / `transferFrom` to an **approved payee** | allowed |
| ...to a **lookalike** (same first 4 + last 4 hex chars, different address) | **reverts `LookalikeOfApprovedPayee(recipient, payee)`** |
| ...to a **genuinely new** recipient | allowed (deny by resemblance, not an allowlist) |
| `operation == DelegateCall` | **reverts `DelegateCallNotAllowed`** (fail closed) |
| approving a 2nd payee with the **same fingerprint** | **reverts `FingerprintAlreadyApproved`** (through the Safe this shows as `GS013`) |
| removing one payee | other payees stay protected |
| Safe calling itself / configuring the guard, even with junk calldata | never blocked (administration + recovery path) |
| `setGuard(0)` through a real Safe tx while the guard is active | succeeds; re-enable restores protection |
| other calls (unknown calldata) | allowed and **not inspected**; clients must show "cannot verify" |

**Gas:** a guarded ETH payment cost about 68k gas for the whole `execTransaction` in the test.

## Synthetic test pair (for the Sepolia demo)
```
node scripts/make-lookalike-pair.js      # birthday search; ~1-2 min; writes keys to .pair.local.json (git-ignored)
```
A pair we found while testing the script (keys not kept, so use these only as **recipients** on Sepolia):
- fingerprint `0x4e184120`
- **P** (approve): `0x4E185e251Ac7fB83E9DE10723EAda46cadE74120`
- **L** (lookalike): `0x4E185a3FC4B530244aB9ed0dE38167b403344120`

## Limits (put these in the README)
- Module transactions bypass transaction guards. `HexFenceModuleGuard` closes this for payments only on Safe 1.5.0 Safes that also call `setModuleGuard`. It reads the list in `HexFenceGuardV2`, does not learn from module payments, and refuses module delegatecalls. Calls to the Safe or V2 pass unchecked, so it does not contain a module acting against the Safe. The demo Safe is 1.4.1 and does not have it.
- MultiSend is rejected (it's a delegatecall).
- Only ETH, `transfer` and `transferFrom` are inspected.
- A 4+4 fingerprint doesn't catch weaker lookalikes.
- Safe warns that a broken guard can lock a Safe: use an **isolated demo Safe with test funds** and keep the removal drill.
