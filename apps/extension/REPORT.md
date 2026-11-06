# Extension spike report

Go/no-go: **pending human MetaMask tests on app.safe.global**. No commit made.

All source additions are under `apps/extension/`:

- `manifest.json`, `package.json`, `tsconfig.json`, `build.mjs`: MV3 / strict
  TypeScript / Vite setup; standalone MAIN and isolated content-script bundles.
- `src/main.ts`, `src/interception.ts`, `src/bridge.ts`: provider wrapping,
  shared decoders, payload-free metadata logging and gated forwarding / error 4001.
- `src/background.ts`, `src/check.ts`, `src/policy.ts`, `src/chrome.d.ts`:
  separate review window, document-bound expiring session state, Guard slot and
  single bulk payee read, optional Arkiv bulk reads, shared verdicts, RED friction.
- `options.html`, `review.html`, `src/options.ts`, `src/review.ts`,
  `src/config.ts`, `src/style.css`, `src/verdictCopy.ts`: options, narrowly
  requested network grants, review UI and fixed English Pay presentation.
- `test/interception.test.ts`, `test/copy.test.ts`: matching, malformed captures,
  4001 / no-forwarding paths, RED friction, and fixed-copy parity tests.
- `TESTING.md`: exact loading instructions, human go/no-go and integration checklist,
  API sources, permission rationale, privacy and interception limitations.

Validation:

- Node 22.14.0 and Corepack pnpm 10.34.9 available. Plain `pnpm` is not on PATH.
- Filtered dependency installation succeeded using Corepack, `CI=true`,
  `--lockfile=false --ignore-scripts`; the tracked root lockfile is unchanged.
- `corepack pnpm --filter @hexfence/extension build`: passed strict TypeScript
  and all four Vite outputs. Vite emitted an upstream `ox` browser externalization
  warning for `node:worker_threads`; generated background output contains no
  worker_threads / browser-external / new Worker / eval / new Function matches.
  Actual extension-worker startup still needs Chrome testing.
- `corepack pnpm --filter @hexfence/extension test`: attempted; Vitest could not
  spawn either worker (`spawn EPERM`). **Zero tests ran.** No alternate pool,
  privilege escalation or other sandbox bypass was attempted.
- Browser/MetaMask, live RPC, Arkiv, and on-chain execution tests were not run.
  Repository-wide tests/builds and contract tests were not run; no completion
  status in shared project documents was changed.
- No contract, other app, locked spec, interfaces, AGENTS or lane document edits.

Dependency installation generated an untracked root `.pnpm-store/` directory.
Automatic approval review blocked recursive cleanup of that directory; it remains
local and must not be included in the organiser's commit. `dist/` and
`node_modules/` are already ignored by the repository.

The organiser must rerun the tests, load `apps/extension/dist`, then complete
`TESTING.md`, especially actual SafeTx **and** execTransaction capture, error
4001 on Reject/close/expiry, RED friction, and the EIP-6963 / late-injection races.
