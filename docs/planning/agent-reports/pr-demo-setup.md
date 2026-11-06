Adds contracts/scripts/setup-demo.js and documents it in the README Guard section. It loads the root .env, accepts only chain 11155111, deploys the unchanged Guard (or checks/reuses VITE_GUARD_ADDRESS), creates a canonical Safe 1.4.1 with one owner/threshold 1, funds to 0.002 test ETH, installs the Guard, approves spec payee P, then executes setGuard(0) and re-enables it as individual real Safe transactions. Output is Markdown table rows containing only public addresses, tx hashes and VERSION().

Rerun: set VITE_GUARD_ADDRESS and DEMO_SAFE_ADDRESS to the printed addresses. These deployments, prior approval and sufficient funding are skipped. Owner-based CREATE2 salt also recovers the Safe without DEMO_SAFE_ADDRESS. The removal drill runs again. Without VITE_GUARD_ADDRESS a new Guard is deployed; keep/reuse its printed address. Existing Safe owner, threshold, VERSION, Guard bytecode and active Guard are checked. Provider exceptions are not dumped because they may contain RPC credentials.

Run: cd contracts; npm install --legacy-peer-deps; node scripts/setup-demo.js

Validation actually run:
- npx hardhat test --config scripts/setup-demo.hardhat.js scripts/setup-demo.test.js: 3 passing on local chain ID 11155111, real Safe release bytecode at canonical addresses. Setup, funding, approval, both removal transactions, address reuse/no second funding, deterministic Safe recovery, and refusal checks passed.
- npx hardhat test: 14 passing.
- corepack pnpm@10.34.9 -r test: 76 passing, 3 integration tests skipped.
- corepack pnpm@10.34.9 -r build: passed (existing Pay browser externalization/chunk warnings).

No Sepolia deployment or transaction was sent; no funded .env key was used. The local tests invoke the exported setup routine, not the CLI .env entry point. The automated drill does not replace the human Safe{Wallet} UI drill. No existing product bug found; HexFenceGuard is unchanged.

Official references consulted: https://docs.safe.global/advanced/smart-account-signatures and https://github.com/safe-global/safe-deployments.
