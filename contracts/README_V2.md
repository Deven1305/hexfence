# Auto-Fence: HexFenceGuardV2

**Testnet, not audited. V2 is a new contract; v1 and its 14 tests are unchanged.**

V2 learns recipients from successful Safe executions when the Safe opts in with `setAutoLearn(true)`. A different address sharing the first four and last four hex characters is refused with `LookalikeOfKnownRecipient(recipient, holder)`. New fingerprints remain allowed. `approve` and learning share one holder map; changing a holder requires owner-authorized `forget` followed by `approve`.

The ETH destination is checked whenever `value > 0`, including ETH attached to arbitrary or token-shaped calldata. Recognized token calldata is checked separately, so a combined native/token call has up to two pending recipients. Administration and recovery (`Call` to the Safe itself or this Guard) run first. Delegatecall remains refused.

## Build and tests

```sh
npm install --legacy-peer-deps
npx hardhat test
node scripts/parity-vectors-v2.js
```

From the root, also run `corepack pnpm@10.34.9 -r test` and `corepack pnpm@10.34.9 -r build`. V1 stays on solc 0.8.26; only V2 and its new test targets use solc 0.8.28 with EVM Cancun. A pinned `solc-v2` alias supports an in-process compiler in restricted environments; normal CI uses Hardhat's compiler download.

Tests execute the real Safe 1.4.1 singleton/proxy, not a replacement Safe. They cover success/failure, learning off, ETH/transfer/transferFrom lookalikes, ETH with calldata, both recipients of a mixed call, namespaces, approval/learning collisions, forget/approve, removal/re-enable, and nested same-Safe/admin/different-Safe execution. Transient state is keyed by Safe and frame depth and cleared at each after-hook, including failure. The 414 generated client parity vectors check the actual pre-execution Guard decisions after learning through a real Safe; contract tests cover the post-execution learning phase separately.

Measured local whole-Safe ETH execution: **182,927 gas** for a newly learned recipient and **72,839** for a repeat. These are test snapshots, not guarantees. Learning writes the holder, enumerable list/index and timestamp; it is more than two storage writes.

## Sepolia deployment and isolated setup

```sh
npx hardhat run scripts/deploy-v2.js --network sepolia
npx hardhat run scripts/setup-v2.js --network sepolia
node scripts/verify-upgrade.js HexFenceGuardV2 <deployed-address> <creation-tx>
```

Use only an existing testnet key and existing balance in the ignored root `.env`. Both scripts refuse other chain IDs. The setup resolves official Safe **1.4.1** deployments through `safe-deployments`, checks their runtime hashes, atomically initializes a new **1-of-1** proxy, installs V2, enables learning, then removes and restores the Guard. It refuses to alter an already-created proxy. It never uses or changes the v1 demo Safe and performs no funding or payment transfers. Public results go to `contracts/deployments/`.

A positive-value Sepolia P-then-L payment demonstration needs a human to fund this isolated Safe and authorize its payments. Under this session's no-fund-transfer boundary, that demonstration is not executed by the agent. The positive-value flow is covered locally against real Safe contracts. Do not present the setup/removal transactions as a P-then-L payment demonstration or as a human wallet test.

## Honest limits

- Trust on first use: an initial mistaken recipient can become the holder. Learning starts when enabled; it does not import earlier on-chain history.
- The after-hook's `success` is **EVM execution success**, not proof that an ERC-20 returned true, moved funds, or is a real token. Recognized zero-value calls and token-shaped calldata to an EOA can be learned. `firstPaidAt` records the first successful recognized execution while learning is enabled, not independently established receipt history. Clients must not invent a date for explicit approvals with no recorded execution.
- If two different newly encountered recipients in the same native-plus-token call share a fingerprint, learning the second reverts the whole transaction atomically (`FingerprintAlreadyHeld`). The static client parity test covers pre-execution checks; it does not establish successful token semantics or post-execution state changes.
- Only native destinations and `transfer`/`transferFrom` recipient fields are understood. Arbitrary calldata remains “cannot verify” in clients even when its ETH destination can be checked. Approvals, permits, swaps and NFT-specific semantics are outside this implementation.
- Module transactions bypass Safe 1.4.1 transaction guards. MultiSend delegatecall is refused. Owner/threshold/module changes remain administrative actions; no governance fence is included.
- The Safe's threshold can remove the Guard. It protects against recipient confusion, not authorized owners choosing to bypass it.
- A 4+4 fingerprint does not detect weaker resemblance. Legitimate collisions require the explicit forget/approve escape hatch.
- Bulk recipient enumeration grows with history; checking one payment remains O(1). Unbounded history is not benchmarked for production.
- An external review, fuzz/invariant testing and mainnet validation remain outstanding. No mainnet deployment is provided.

Official references read: [Safe setup](https://docs.safe.global/reference-smart-account/setup/setup), [execTransaction](https://docs.safe.global/reference-smart-account/transactions/execTransaction), [safe-deployments API](https://github.com/safe-global/safe-deployments#usage), [Solidity transient storage](https://docs.soliditylang.org/en/v0.8.28/contracts.html#transient-storage).
