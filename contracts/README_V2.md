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

The positive-value P-then-L run happened on Sepolia on 6 Nov, with Dhruv's permission, using the deployer testnet key: [0.0001 Sepolia ETH funding](https://sepolia.etherscan.io/tx/0x0368f00e05359c607a03a7bdd501646458bc62b9bb20206e74ae6028c4593007), [1 wei to P, status 1](https://sepolia.etherscan.io/tx/0xfc93f06334211546d1371ed3b2b5fbafc77842a03e227f7197a2e50680d866a5), then [the same Safe paying L, status 0](https://sepolia.etherscan.io/tx/0x2585f5ce7bce79a6c139d19f56e4f125f8c84a7c09fe59d27d2598eb83c328ff). Preflight decoded `LookalikeOfKnownRecipient`. Afterwards `knownRecipients(Safe)` returned only P. [Record](deployments/v2-payment-demo-sepolia.json). This was a script, so do not present it as a human wallet test.

Command used, after funding the isolated Safe: `node scripts/demo-v2-payments.js 0x4E185e251Ac7fB83E9DE10723EAda46cadE74120 0x4E185a3FC4B530244aB9ed0dE38167b403344120`. This sends one wei to P and broadcasts a forced-gas L transaction expected to revert; it requires a fresh empty list and records actual receipts only. It refuses to run again now the list is not empty.

Recorded Sepolia preparation: V2 [0x0adF080DE3DA9D672fDc7330B8750a0579A698c7](https://sepolia.etherscan.io/address/0x0adF080DE3DA9D672fDc7330B8750a0579A698c7), [deployment](https://sepolia.etherscan.io/tx/0xbafcc10e3e4008adc5281495ad39985f6d6d82d8507f4b6aad89be69de8bc14e), Sourcify exact creation/runtime match **58609655**. New isolated Safe [0x5142C7E9DE82726CaCb847c5469D460508738214](https://sepolia.etherscan.io/address/0x5142C7E9DE82726CaCb847c5469D460508738214) is 1-of-1, version 1.4.1, learning enabled, recipient list empty and balance zero at setup. [Removal](https://sepolia.etherscan.io/tx/0x267d7fb1721c2c2c909ace707aeb77d7da75bd13b0e9bf638e6d381277dfd500) and [restoration](https://sepolia.etherscan.io/tx/0xa7a4afc8a75465d612c4615ec5acdd582d773dd18ed48898f0643d11142b330b) succeeded. These are scripted setup results, not a human wallet test.

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
