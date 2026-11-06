# Governance fence: HexFenceGovernanceGuardV2

This is a **new transaction guard**, deployed separately from HexFenceGuardV2. **Only Safes that execute setGuard with this new guard address get these checks.** A Safe has one transaction guard: installing this replaces its previous transaction guard. No existing Sepolia Safe was switched, and Pay, its pinned V2 deployment and the v1 demo remain on their existing paths. Pay does not recognize this new address as its configured V2 deployment.

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

Only the existing Sepolia testnet key/balance paid deployment gas. No funds or tGLM were transferred, and no Safe was installed/configured live. The original deployment command reported an RPC-stage failure after broadcast. Read-only nonce/runtime/block/receipt checks recovered the already mined creation; no duplicate deployment was sent. The source match was then obtained through Sourcify's official v2 API.

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

## Limits

This is a narrow resemblance rule, not proof of owner identity or module behavior. New fingerprints and exact known addresses remain allowed. Existing modules can bypass transaction guards, including for administration; this guard does not contain an authorized hostile module. Other self-calls, arbitrary nested call semantics and unrelated governance functions are not newly inspected. Delegatecall, including MultiSend, remains refused. B3 is cut.

All existing [V2 payment/first-use/EVM-success limits](README_V2.md#honest-limits) apply. Recognized EVM-successful token-shaped execution does not prove token receipt. Owners can remove this guard and change lists. The governance tests use real Safe 1.4.1 locally; no live governance operation or human wallet flow is claimed. The contract is a testnet prototype without an external audit.

Official sources read before implementation: [Safe 1.4.1 OwnerManager](https://github.com/safe-global/safe-smart-account/blob/v1.4.1/contracts/base/OwnerManager.sol), [ModuleManager](https://github.com/safe-global/safe-smart-account/blob/v1.4.1/contracts/base/ModuleManager.sol), [GuardManager](https://github.com/safe-global/safe-smart-account/blob/v1.4.1/contracts/base/GuardManager.sol).
