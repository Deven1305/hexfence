# HexFence: parallel plan (3 AI agents, 3 devices)

The spec is still `docs/planning/10_FINAL_What_To_Build_HexFence.md` (v4, LOCKED). This file only decides **who builds what, in parallel, without stepping on each other.**

| Lane | Agent | Device / account | Owns (only this lane edits these paths) | Tasks, in order |
|---|---|---|---|---|
| **A: core + data** | Claude Code #1 | **Deven's** Claude account, Deven's laptop (already running T2) | `packages/shared/`, `packages/arkiv/`, `apps/detector/`, `contracts/`, `arkiv/schema.md`, `docs/PROGRESS.md` (Now / H-boxes / addresses) | T2 → T4a → T3 → T4b → T1 (once H1/H2 are done) → T13 |
| **B: HexFence Pay** | Claude Code #2 | **Dhruv's** Claude account, 2nd laptop | `apps/pay/` | T6 → T10 → T11 → T12 |
| **C: explorer + docs** | Codex | **Dhruv's** Codex account, 3rd laptop | `apps/explorer/`, `README.md`, `arkiv/friction.md`, `arkiv/reach.md`, `arkiv/why-arkiv.md`, `arkiv/how-you-use-arkiv.md`, `docs/AI_USAGE.md`, `docs/DEMO.md` | T5 → T9 → T7 → demo script |

The **gate** (T8) is run together by the humans once A, B and C report ✔ on P0. T14 (the extension) is P2 and isn't assigned.

## Why this split
- **The lanes don't share directories.** Each agent edits only the paths it owns, so `git pull --rebase` almost never conflicts.
- **They meet only through `docs/INTERFACES.md`.** That file holds the frozen function and type signatures. B and C code against it **before** A has published, so nobody waits.
- **The heaviest lane goes to the freshest account.** We can't see any account's remaining limit, so the Pay app (largest) goes to the fresh Claude account (B). The Claude on this laptop (A), which has been running since kickoff, gets smaller tasks. If any lane stops, another agent takes it over from its lane file (see below).

## Sync points (only these create waiting)

| # | What | Who publishes | Who uses it | Until then |
|---|---|---|---|---|
| S1 | `@hexfence/shared` (T2) | A, **push the moment its tests pass** | B, C | B builds the Pay shell + Safe loading; C builds the explorer shell |
| S2 | `@hexfence/arkiv` read helpers + schema (T4a) | A | C (explorer), B (T10) | C renders from a typed fixture matching `PoisoningEvidence`. **Delete the fixture before T5 is ✔.** |
| S3 | Guard deployed + demo Safe (H2, H3) | humans (Baqir) | B (live tests), A (T1 ✔) | B tests verdict logic with unit tests |
| S4 | Real evidence on Arkiv (T4b, needs H4/H5) | A | C (explorer shows real records) | C uses the S2 helpers against an empty publisher |
| Gate | T8 end to end | humans + all lanes | | |

## Git rules (every agent, every task)
1. Everyone works on `main`.
2. **Before starting a task and before every commit:** `git pull --rebase`.
3. **After every task:** commit **and push**. Keep commits small, with the message `[A] T3: …`, `[B] T6: …` or `[C] T5: …`.
4. **Edit only your own paths.** The few shared files have rules:
   - `pnpm-lock.yaml`: if it conflicts, take the remote version (`git checkout --theirs pnpm-lock.yaml`), then run `pnpm install`, then commit.
   - `.env.example`: only *add* lines, and only in your lane's section.
   - `docs/PROGRESS.md`: change **only your own task rows**. Write your session log in **your lane file**, never in PROGRESS (two appends at the end of one file always conflict).
   - `AGENTS.md`, `docs/INTERFACES.md`, `docs/planning/`: **nobody edits them.** If an interface must change, write the proposal in your lane file and wait for A to apply it.
5. Never commit `.env`, keys, `node_modules/`, `artifacts/` or `cache/`.

## Usage limits (all three lanes)
Each lane file has a **Usage-limit rule**:
1. The person checks usage (`/usage` in Claude Code, `/status` in Codex).
2. At **~5% left** they paste STOP-SAFE. The agent commits, writes an exact "Next step" and "Paused until <reset time>", pushes, and stops.
3. After the reset they paste RESUME.

Every task is committed, so even a sudden hard stop loses at most one step.

**Takeover**, when a paused lane is on the gate path (A or B) and the wait is over ~2 hours: give any agent with quota left *"Take over Lane X: read docs/lanes/LANE_X_*.md, follow its rules and owned paths, and continue from its 'Next step'. Write your name in its log."* When the original agent comes back, it reads the lane log first.

**Priority when only two agents are working:** A and B first (the gate path), then C.
