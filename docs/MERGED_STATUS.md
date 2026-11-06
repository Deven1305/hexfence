# Merged status (local, not pushed)

- `pramaan/` = Pramaan imported with history (pre-event work, see README Provenance).
- `packages/core` = unified verdict model; adapters for HexFence and Pramaan; 6 tests.
- Done: one pnpm workspace and lockfile (Pramaan packages and apps are members in place under `pramaan/`); `@hexfence/core` has tested adapters for every row kind (recipient, action, release, site files, contracts) and `merged:verify` uses them.
- Not done: moving Pramaan packages out of `pramaan/` and renaming `@pramaan/*`, one extension, ENS key rename, one CRE project (docs/planning/final_hexfence/05_MERGE_STEPS.md phases 2 (moves), 4-6).

## Run
- HexFence: `pnpm install && pnpm -r test` (Guard contracts need Node 22: `cd contracts && npm ci --legacy-peer-deps && npx hardhat test`).
- Pramaan: `pnpm install` at the repo root, then `pnpm --dir pramaan test` (210 pass; the Foundry/anvil/Docker files are excluded there, run them with `test:full`).
