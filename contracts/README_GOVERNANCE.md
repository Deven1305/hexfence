# Governance fence: HexFenceGovernanceGuardV2

This is a **new transaction guard**, deployed separately from HexFenceGuardV2. **Only Safes that execute setGuard with this new guard address get these checks.** A Safe has one transaction guard: installing this replaces its previous transaction guard. A new isolated Sepolia Safe now uses it, as recorded below. No pre-existing Sepolia Safe was switched, and Pay, its pinned V2 deployment and the v1 demo remain on their existing paths. Pay does not recognize this new address as its configured V2 deployment.

## Rule

On an owner-authorized Safe self-call, inspect only:

| Safe function | Selector | Address checked |
|---|---|---|
| addOwnerWithThreshold(address,uint256) | 0x0d582f13 | First argument: new owner |
| swapOwner(address,address,address) | 0xe318b52b | Third argument: new owner, not prevOwner or oldOwner |
| enableModule(address) | 0x610b5925 | First argument: new module |

Refuse a candidate that differs from an existing owner or this guard's known recipient while sharing its first four and last four hexadecimal address characters. Current owners come from the calling Safe's getOwners; known recipients come from this contract's per-Safe holderOf mapping. Exact matches pass this rule, subject to the Safe's own validity checks. Owner lists are traversed on-chain, not through a per-recipient server query. Cost grows with the current owner count.

setGuard is never decoded or checked, and never triggers a getOwners call. Removal with setGuard(0) and restoration work in real Safe tests. Other administration follows the existing V2 behavior. Malformed short calls remain for the Safe to reject. No owner/module address is learned merely because it is added administratively.

## Payment behavior and separate state

The payment implementation is an isolated copy of V2, with the governance check inserted before its Safe self-call exemption. The deployed V2 source and its tests have no changes. All fourteen V2 regression cases also run against this new contract: opt-in learning, ETH with calldata, token shapes, failure behavior, namespaces, correction, nested frames and removal.

The recipient list starts empty and learning starts off for each Safe. **There is no state migration from the deployed V2.** Owners must execute approve(recipient) and, if wanted, setAutoLearn(true) as Safe transactions targeting this new contract. Calling those functions directly from a wallet configures that wallet's namespace, not its Safe. Review and seed the new list before relying on it.

The existing module guard deployment reads the original V2 address. It does not automatically read this new list. Do not claim that installing this transaction guard upgrades module protection or migrates a module guard's policy source.

## Deployment and reproducibility

Sepolia only: [0x108ea016F84d9817364b65Df6A133afe9CA33855](https://sepolia.etherscan.io/address/0x108ea016F84d9817364b65Df6A133afe9CA33855). Creation [0x8d274c070f3a387e3c473be449a516eb6bc22342f64ec88bc60714969e744018](https://sepolia.etherscan.io/tx/0x8d274c070f3a387e3c473be449a516eb6bc22342f64ec88bc60714969e744018), block 12077102. Sourcify exact creation/runtime match **58635387**, job 9893b169-ae6c-40b6-8402-18756131b2a3. [Public deployment record](deployments/governance-sepolia.json). Runtime hash: 0x9eab6ac2ce5b53c3511bea1386007fb8e4cffef52beec24ee2d09db8786b5f58.

Only the existing Sepolia testnet key/balance paid the original deployment gas. That deployment did not transfer funds or tGLM or configure a Safe. The original deployment command reported failure after broadcast; the original failing step was not captured. Read-only nonce/runtime/block/receipt checks recovered the already mined creation; no duplicate deployment was sent. The source match was then obtained through Sourcify's official v2 API.

From contracts, with existing testnet settings in ignored root .env:

```sh
npm install --legacy-peer-deps
npx hardhat test
# A new deployment spends Sepolia gas; it does not install the guard on any Safe.
npx hardhat run scripts/deploy-governance.js --network sepolia
# Read-only source verification for the existing deployment:
node scripts/verify-upgrade.js HexFenceGovernanceGuardV2 0x108ea016F84d9817364b65Df6A133afe9CA33855 0x8d274c070f3a387e3c473be449a516eb6bc22342f64ec88bc60714969e744018
```

The script refuses non-Sepolia networks or insufficient existing balance. It prints only public deployment information and withholds provider/key details on errors. Do not repeat a submission after an ambiguous RPC error without checking its public hash/receipt.

## Scripted live receipts (6 November 2026)

New isolated Safe **0xb619071ca1D449A6aac6588f8D9aad49605C44ac**, official Safe 1.4.1, initially one owner with threshold one. The deployer installed this guard and approved P in this Safe's separate governance-guard namespace. Auto-learning remained off. The synthetic L only resembles the approved P; it is not evidence of an attack.

| Operation | Transaction | Mined status |
|---|---|---|
| Add L as owner, threshold one | [0xfb0d8a277cb22620e07897b642b7fdf86a05f83fd8bafde37b6241d7747ea860](https://sepolia.etherscan.io/tx/0xfb0d8a277cb22620e07897b642b7fdf86a05f83fd8bafde37b6241d7747ea860) | 0; preflight `LookalikeOfKnownRecipient(L,P)` |
| Add B as owner, threshold one | [0xdb4af2e80f174712f060c263479ec9ee6c81eaad46be1d26668b578af5c09594](https://sepolia.etherscan.io/tx/0xdb4af2e80f174712f060c263479ec9ee6c81eaad46be1d26668b578af5c09594) | 1; `ExecutionSuccess`, B present in `getOwners()` |

B is the repository's non-lookalike test address `0x7c42d2e09B3f5A6C8E1D4F2A0B9C3e5D7f6A1b20`; its fingerprint differs from P and the deployer. This adds an owner address for the drill, without asserting control or identity of that address. The final threshold remains one and the deployer remains an owner. L was not added. No ETH was transferred by these governance calls.

[Complete receipt journal](deployments/live-guard-receipts-v2-sepolia.json) includes creation, installation, approvals, gas, fees, block hashes and the [module drill](README.md#module-guard-scripted-live-receipts). Each transaction receipt was fetched again after mining. Both deliberate refusals used a forced gas limit of 750,000 and mined with status 0 after the expected custom error and exact arguments were checked in preflight.

Total for both drills: **135,696,858 wei (0.000000000135696858 Sepolia ETH)**, including two wei funding and the [failed first creation](deployments/live-guard-receipts-sepolia.json). That first attempt's 600,000 gas limit was insufficient; the revised run used new salts, 1,500,000 creation limits and gas estimation before ordinary sends. RPC state reads also intermittently lagged mined receipts; the journal allowed continuation without resending completed transactions. The failed creation is retained with status 0 and its fee, rather than counted as a guard refusal.

The script enforces chain ID 11155111, a shared **0.012 ETH** ceiling including the failed attempt, an up-front balance/budget check for 20,000,000 gas at the pinned maximum fee, and a per-broadcast cost check. Only newly created deterministic isolated Safe addresses are allowed; both existing demo Safes are explicitly excluded. It records nonce before broadcast and hash after broadcast, refuses a completed repeat, and permits `--continue` only for an incomplete journal whose recorded receipts all reconcile. An ambiguous broadcast requires read-only reconciliation. No faucets or tGLM were used.

From `contracts/`:

```sh
node scripts/live-guard-receipts.js --verify  # read every receipt; no signing
node scripts/live-guard-receipts.js --send    # refuses: this drill is complete
```

These are scripted transactions signed by the existing ignored `.env` Sepolia deployer. No human wallet flow, Safe{Wallet} UI, live `swapOwner`, live governance `enableModule`, or existing-owner resemblance branch was exercised. Existing local tests cover those governance branches.

Validation for this receipt change: `npx hardhat test` returned **68 passing** with contract sources and tests unchanged; `node --check scripts/live-guard-receipts.js` passed; `--verify` reconciled all 15 receipts, including the failed creation. Completed-run and non-Sepolia send attempts exited 1 before broadcasting. Both `corepack pnpm@10.34.9 -r test` and `corepack pnpm@10.34.9 -r build` were attempted and blocked locally by Windows `spawn EPERM` before workspace scripts ran.

## Limits

This is a narrow resemblance rule, not proof of owner identity or module behavior. New fingerprints and exact known addresses remain allowed. Existing modules can bypass transaction guards, including for administration; this guard does not contain an authorized hostile module. Other self-calls, arbitrary nested call semantics and unrelated governance functions are not newly inspected. Delegatecall, including MultiSend, remains refused. B3 is cut.

All existing [V2 payment/first-use/EVM-success limits](README_V2.md#honest-limits) apply. Recognized EVM-successful token-shaped execution does not prove token receipt. Owners can remove this guard and change lists. The governance tests use real Safe 1.4.1 locally; the live operations above were scripted. No human wallet flow is claimed. The contract is a testnet prototype without an external audit.

Official sources read before implementation: [Safe 1.4.1 OwnerManager](https://github.com/safe-global/safe-smart-account/blob/v1.4.1/contracts/base/OwnerManager.sol), [ModuleManager](https://github.com/safe-global/safe-smart-account/blob/v1.4.1/contracts/base/ModuleManager.sol), [GuardManager](https://github.com/safe-global/safe-smart-account/blob/v1.4.1/contracts/base/GuardManager.sol).

Validation: npx hardhat test returned 68 passing locally. The exact recursive workspace test/build commands passed in [CI 42233393884](https://github.com/Deven1305/hexfence/actions/runs/42233393884), after local Windows spawn EPERM blocked them. The additional [Pages run 42233404026](https://github.com/Deven1305/hexfence/actions/runs/42233404026) passed the v1 scripted payment regression and actual-data visual checks. Non-Sepolia deployment was refused with exit 1; a fresh Sepolia read confirmed receipt status 1, exact compiled runtime and Guard interface support.
