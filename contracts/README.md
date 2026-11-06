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

## Module guard scripted live receipts

On 6 November 2026, the separately deployed module guard `0xa7Dc08C6fb15fCdBF4De484FaE393fea052c546B` was installed on **new isolated Safe 1.5.0 `0x36cc3F281129C6375B8057faB536caDD83C577b2`**. The official singleton and proxy factory were found through `@safe-global/safe-deployments` 1.37.67 and their runtime hashes and Safe version checked on Sepolia. The existing demo and V2 Safes were not changed.

The deployer enabled a real module contract, `0xDDEE3DEF76E42A99c9237509cD6657DF72451746`, which calls `execTransactionFromModule`. Its immutable owner is the deployer, its immutable target is this new Safe, and `pay(recipient)` sends exactly one wei. Its source, compiler and runtime hash are in the [receipt journal](deployments/live-guard-receipts-v2-sepolia.json); the script checks the deployed runtime including the two immutable values. It is a purpose-built demonstration module, not a reviewed production module.

This Safe's original V2 recipient list started empty. An owner-authorized Safe call to **original V2** `approve(P)` populated the new Safe's namespace; approving from the deployer's wallet directly would populate the wrong namespace. The module guard reads that original V2 list, not the governance guard's separate list. V2 is also installed as this new Safe's transaction guard. Auto-learning remained off and the final list contains only P.

| Module payment | Transaction | Mined status |
|---|---|---|
| One wei to recorded P | [0x1b981af2679ec1e035b53ebe3950cf2c892416fb12f9826e406c02297529471d](https://sepolia.etherscan.io/tx/0x1b981af2679ec1e035b53ebe3950cf2c892416fb12f9826e406c02297529471d) | 1; Safe emitted `ExecutionFromModuleSuccess` |
| One wei to synthetic L | [0x3f9035a29f220fe23995444a72d3821a8be34c4bc50b328ee3d9755df64bd935](https://sepolia.etherscan.io/tx/0x3f9035a29f220fe23995444a72d3821a8be34c4bc50b328ee3d9755df64bd935) | 0; preflight `LookalikeOfKnownRecipient(L,P)` |

The deployer funded only this new Safe with two wei. The successful payment reduced its balance by one wei; the refusal did not reduce it further, leaving one wei. L only resembles the approved P. No evidence or identity claim is made about this synthetic pair.

All setup hashes, receipt statuses and costs are recorded in the journal. Total spending for this module drill, the [governance drill and the failed initial creation](README_GOVERNANCE.md#scripted-live-receipts-6-november-2026) was **0.000000000135696858 Sepolia ETH**, below the scripted shared 0.012 ETH ceiling. `node scripts/live-guard-receipts.js --verify` reads every receipt back without signing. `--send` and `--continue` refuse this completed run; other chain IDs are refused. Interrupted runs may continue only after their journaled receipts reconcile, without resending completed transactions.

This exercised native ETH module payments from a script, not a human wallet. ERC-20 module payments, delegatecall refusal, module-guard removal, and module administration bypass were tested locally, not live in this drill. The module guard never learns from module payments. Safe/V2 calls remain exempt, and authorized modules can alter lists or remove guards; this does not contain an authorized module acting against the Safe. No mainnet operation, Safe{Wallet} UI flow or external audit is claimed.

## Replay of one real suspected loss

A local test in `test/LossReplay.test.js` replays one recorded loss event against `HexFenceGuardV2`.

**What this shows:**
- The addresses and amount come from one published record with status suspected.
- Approving the impersonated recipient allows an ERC-20 payment of that amount to proceed.
- An attempted payment of the same amount to the lookalike address reverts with `LookalikeOfKnownRecipient`.

**What this does not show:**
- The victim's account had no HexFence Guard; this test uses a separate local Safe instead.
- This is a local counterfactual, not a mainnet action and not a claim that the loss would certainly have been prevented.

