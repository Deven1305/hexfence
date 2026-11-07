# AGENTS.md: rules for every AI agent on HexFence (Claude Code, Codex)

**Spec:** `docs/planning/10_FINAL_What_To_Build_HexFence.md` (v4, LOCKED; the PDF has the same text). The scope is fixed: P0 → gate → P1. P2 happens only if every P1 task is ✔.

**State:** we now work in **parallel mode with 3 lanes**. Read `docs/PARALLEL_PLAN.md`, `docs/INTERFACES.md` and **your lane file** in `docs/lanes/` first. `docs/PROGRESS.md` still holds the task table, the H-boxes and the addresses. Update **only your own task rows** there, and write your session log in your lane file.

## How to work
1. **One agent per lane.** No subagents, no Agent/Task tool, no parallel tasks inside your lane. Do your lane's tasks strictly in order. **Edit only the paths your lane owns** (see `docs/PARALLEL_PLAN.md`). Lane A works on `main`; Lanes B and C work on `lane-b` / `lane-c` and merge into `main` when a task is ✔ (Git rules in `docs/PARALLEL_PLAN.md`). Run `git pull --rebase` before every commit, and push after every task.
2. **Per task:** implement → run that task's tests → fix → update PROGRESS (status, commit hash, notes, "Next step") → `git commit` with message `T<n>: <what>`. Never stop between tasks with uncommitted work.
3. **Long tasks:** commit working sub-steps (`T<n> wip: <what>`) at least every ~30 minutes, so a sudden stop loses little.
4. **Human-only steps** (keys, faucets, Safe{Wallet} UI, deploys, manual tests):
   - write the exact steps under "Waiting on humans";
   - mark the task ⏸;
   - continue with the next task that doesn't depend on it;
   - come back to it when the box is ticked.
5. **Before using any external API, read its official docs** and match names exactly: Safe Protocol Kit, safe-deployments, the Arkiv SDK, Anon-RPC, viem. If the docs disagree with the spec, write it in the PROGRESS "Decisions log" and choose the documented behaviour.

## Hard rules
- **Nothing fake or hard-coded.**
  - Unsupported transactions show "cannot verify".
  - Evidence status is always "suspected".
  - The synthetic Sepolia lookalike only ever gets "resembles your approved payee", never "verified" or "evidence".
- **No per-recipient lookups** to any server: read `payees(safe)` once; read Arkiv evidence in bulk.
- **Secrets:** testnet keys only, in `.env` (git-ignored); `.env.example` lists names only. Never print or commit keys or seed phrases.
- **Contracts:** keep the reference Guard's behaviour (13 tests must stay green). Don't add Guard features beyond the spec.

## Layout
```
contracts/            Hardhat project (from 11_HexFence_Guard_reference), standalone npm: npm install --legacy-peer-deps
packages/shared/      fingerprint, Safe payment decoder, PoisoningEvidence schema (TypeScript, vitest)
apps/detector/        mainnet logs -> evidence.jsonl -> Arkiv writer
apps/explorer/        static Vite app reading Arkiv
apps/pay/             HexFence Pay (Safe Protocol Kit), the P0 client
apps/extension/       Chrome MV3 (P2, only if everything else is done)
arkiv/                schema.md friction.md reach.md why-arkiv.md how-you-use-arkiv.md
docs/                 PROGRESS.md AI_USAGE.md planning/
```
- **JS/TS packages:** a pnpm workspace (`packages/*`, `apps/*`), TypeScript strict, Node 22, viem, zod, vitest.
- **`contracts/` stays outside the workspace** and uses npm, as tested.

## Test commands (run all of them before marking a task ✔)
- `cd contracts && npx hardhat test` → 13+ passing
- `pnpm -r test` → all green
- `pnpm -r build` → no errors
