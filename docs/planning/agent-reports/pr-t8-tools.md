Adds T8 operator tools, based on feat/demo-setup (PR #8), in three commits:
1. Official hardhat-verify 2.0.13 (peer hardhat ^2.0.4), compatible with pinned Hardhat 2.22.17; optional ETHERSCAN_API_KEY; Sepolia Etherscan V2 configuration. The compatible plugin replaces GET queries, so a small version-pinned transport bridge restores chainid=11155111 on the official V2 endpoint. A scripted HTTP test exercises the actual plugin's source check, submission and status requests. No contract changes.
2. Plain Node/ethers read-only check-t8.js with explicit address/hash CLI arguments, no markdown parsing and no signer. It checks chain/code/VERSION/current Guard slot, one bulk payee read, local fingerprint comparisons, Guard installation/approval/removal events and order, decoded inner recipients, successful Safe ExecutionSuccess events (rejecting ExecutionFailure), and a mined non-OOG L receipt whose replay at blockNumber-1 decodes exactly LookalikeOfApprovedPayee(L,P). It fails closed on unavailable/undecoded replay and prints "status 0, reason not decoded". Public table rows print only after all checks pass; CLI always states "not checked: explorer evidence, H6 wallet flow".
3. One-page docs/RUNBOOK_T8.md with PowerShell commands, human funding/key/review steps, deploy/verify/setup/publish/rerun/payment/checker/precision/Pages sequence; checker added to DEMO's Before recording, without Nox wording.

Validation run:
- npm install --save-dev --save-exact @nomicfoundation/hardhat-verify@2.0.13 --legacy-peer-deps; npm ls confirms Hardhat 2.22.17 plus verify 2.0.13.
- npx hardhat test: 14 passed.
- npx hardhat test scripts/etherscan-v2.test.js: 1 passed (scripted HTTP, not a live verification).
- npx hardhat test --config scripts/setup-demo.hardhat.js scripts/check-t8.test.js scripts/setup-demo.test.js: 12 passed (8 checker, 4 setup). Real Safe release contracts and unchanged Guard on local chain 11155111. Covers pass path, wrong recipient, real status-1 ExecutionFailure, real mined out-of-gas, different decoded Safe error, unavailable replay, ERC-20 decoding, and plain Node CLI with no private key and only RPC read methods.
- node scripts/check-t8.js without arguments exits 1 as required.
- corepack pnpm@10.34.9 -r test: 76 passed, 3 integration tests skipped.
- corepack pnpm@10.34.9 -r build: passed with existing Pay bundle warnings.

Not run: live Etherscan verify (needs deployed Guard and API key), Sepolia setup/checker/payments (no funded-key operation attempted), live Arkiv publish/rerun (publisher funding/credentials are human steps), H6 wallet flow, H9 labels/precision, H10 Hindi review, hosted Pages. RUNBOOK commands are instructions for those steps, not claims of execution. The CSV labels and protected Pay/lane/progress/spec files are unchanged.

Guard storage slot confirmed from installed @safe-global/safe-contracts/contracts/base/GuardManager.sol. Official references consulted: Hardhat 2 verify docs, Etherscan V2 docs, ethers v6 provider docs, and installed version-pinned plugin source. No main merge or force push.
