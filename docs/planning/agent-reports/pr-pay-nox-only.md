Removes tor-js, Nym, their mainnet bootstrap configuration, the Tor gateway and VITE_TOR_GATEWAYS. Retains Nox, the skip button, visible route status, labelled direct fallback, and exclusion of the passthrough specifier. Later Nox read failures remain errors rather than silently falling back.

Live contract read actually run in Chromium on 6 Nov 2026:
- Loaded the actual apps/pay/src/anon.ts and rpc.ts through Vite in a temporary browser check page.
- Real AnonRpcWorker, no mock worker; connectAnon selected Nox (Sphinx mixnet).
- RPC: https://ethereum-sepolia-rpc.publicnode.com
- Sepolia contract: 0x41675C099F32341bf84BFc5382aF534df5C7461a (canonical Safe 1.4.1 singleton).
- VERSION() through createReadClient(rpc, outcome.fetchFn).readContract returned "1.4.1", error null.
- No direct contract-read substitute was permitted. The initial specifier bootstrap is direct as labelled in the UI.

The exact reproducible browser-console snippet and limits are recorded in Lane B's T11 notes. The result satisfies the requested real contract read. It is not an anonymity audit or a promise about future availability; if a later live check fails, T11 should return to ⏸.

Validation: corepack pnpm@10.34.9 -r test: 83 passed, 3 integration tests skipped; recursive build passed with existing Pay bundle warnings; contracts npx hardhat test: 14 passed. Tests cover only-Nox/excluded passthrough, successful route, wrong-chain rejection, labelled direct fallback, timeout, skip and no silent fallback after activation.

Not tested: live Guard/payee reads through Nox, Arkiv, or wallet signing/sending through the mixnet (wallet actions are deliberately outside that route). No existing product bug found. No transaction sent and no keys used.

Official references: https://github.com/ethereum/anon-rpc/blob/main/docs/integrate-wallet.md and https://github.com/ethereum/anon-rpc/blob/main/impl/README.md.
