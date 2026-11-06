Builds apps/explorer and apps/pay with corepack pnpm@10.34.9 and Node 22, takes VITE_* values from repository variables, stages one Pages artifact with explorer/ and pay/, and deploys only from main. Pull requests build only. Both Vite builds use --base ./ so assets work under /hexfence/explorer/ and /hexfence/pay/, or on a custom domain. No application source changed and no trackers added.

Human configuration before deployment:
1. Repository Settings -> Pages -> Build and deployment -> Source: GitHub Actions. The Pages API currently returned HTTP 404, so a hosted site could not be verified here.
2. Settings -> Secrets and variables -> Actions -> Variables. Required repository variables:
   - VITE_ARKIV_PUBLISHER: actual Arkiv publisher address.
   - VITE_GUARD_ADDRESS: actual Sepolia HexFenceGuard address.
   - VITE_SEPOLIA_RPC_URL: browser-callable Sepolia RPC.
3. Optional repository variables:
   - VITE_MAINNET_RPC_URL: browser-callable mainnet RPC for explorer receipt checks once T9 lands.
   - VITE_ARKIV_ACCESS_KEY: optional origin-restricted browser access key.
   - VITE_EXPLORER_URL: public explorer URL for Pay's explorer link once that UI is merged (normally https://deven1305.github.io/hexfence/explorer/).
4. Review github-pages environment protection, then merge/run on main. This PR does not enable Pages or deploy anything itself.

VITE_* VALUES END UP IN PUBLIC JAVASCRIPT. Only public or appropriately restricted keys may go there. Never put private keys, seed phrases, DEPLOYER_PRIVATE_KEY or ARKIV_PRIVATE_KEY into these variables. RPC CORS/origin restrictions must allow the published site. Updating a variable requires a fresh build.

Validation actually run:
- actionlint (ShellCheck unavailable/disabled): passed.
- Workflow YAML parsed and its exact artifact-assembly shell step executed locally.
- Missing-production-config shell check failed as expected with exit 1; a presence-only test fixture passed with exit 0. That fixture was not used in a product build.
- Exact workflow shared-package and explorer/Pay --base ./ build commands: passed.
- Chromium smoke against the staged artifact at /hexfence/: both navigation links and apps loaded JS/CSS, with zero HTTP failures or uncaught page errors. No public configuration was supplied locally, so this checked the expected configuration-error states, not live evidence or payments.
- corepack pnpm@10.34.9 -r test: 76 passed, 3 integration tests skipped.
- corepack pnpm@10.34.9 -r build: passed with existing Pay bundle warnings.
- contracts npx hardhat test: 14 passed.

GitHub-hosted validation also passed: https://github.com/Deven1305/hexfence/actions/runs/42114417297 built both apps, assembled the artifact and uploaded it successfully. Deployment was skipped as intended for a PR.

Not tested: OIDC Pages deployment, real repository-variable values, hosted RPC CORS, live Arkiv or wallet payments. No existing product bug found. Nothing committed to or merged into main.

Official references consulted: https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages and https://vite.dev/guide/static-deploy.html#github-pages.

