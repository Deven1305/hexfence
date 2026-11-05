# Lane A: core + data. Claude Code #1 (this laptop)

**Account:** Deven's Claude account, on Deven's laptop (this device).

**Owns:**
- `packages/shared/`, `packages/arkiv/`, `apps/detector/`, `contracts/`
- `arkiv/schema.md`
- the Now / H-boxes / addresses parts of `docs/PROGRESS.md`
- it is also the only lane that may change `docs/INTERFACES.md`, on request.

**Rules:** `AGENTS.md` + `docs/PARALLEL_PLAN.md`. One agent, no subagents, tasks in order. After each task: tests → update **your rows** in PROGRESS + the log below → commit `[A] T<n>: …` → `git pull --rebase` → `git push`.

## Tasks (in order)
1. **T2 `@hexfence/shared`:** implement **exactly** `docs/INTERFACES.md`.
   - **Done when:** vitest covers the fingerprint vectors (USDT, USDC, zero, the P/L pair), decodes the same cases as the Guard tests, gives every `verdictFor` branch, and never throws on junk calldata.
   - **Push immediately (S1).** B and C are waiting on it.
2. **T4a `@hexfence/arkiv` read side:** `PoisoningSchema`, `arkivReadClient`, `fetchAllEvidence`, `findEvidenceByAddress`, plus `arkiv/schema.md`.
   - **Done when:** the unit tests pass and a read against Rabdi works (empty is fine). **Push (S2).**
3. **T3 `apps/detector`:** mainnet logs → rules → `evidence.jsonl`.
   - **Done when:** the fixture tests pass, and a real run (H4) finds ≥5 pairs.
4. **T4b writer:** `writeEvidence` (idempotent) + `pnpm --filter detector publish`.
   - **Done when:** a re-run creates 0 duplicates, and the README query is noted in this file for Lane C (H5). **Push (S4).**
5. **T1 finish:** once H1/H2 are done, record the guard address, and run `contracts` tests to stay green.
6. **T13:** ≥20 pairs, and a precision table from the H9 labels. Put the numbers in this file for Lane C.

## Notes for other lanes (A writes facts here, B and C read them)
- Arkiv README query: (to fill in)
- Publisher wallet: (to fill in)

## Usage-limit rule (stop at 5% left, resume after the reset)
The agent can't see its own usage, so the **person running it checks**:
- **Claude Code:** run `/usage` and look at the plan-usage bars.
- **Codex:** run `/status` (5-hour and weekly limits), or open chatgpt.com/codex/settings/usage for the reset times. `/statusline` can keep the limits visible in the footer.

Check after every task, or about every 30–45 minutes.

**When about 5% is left** (≈95% used) in the session or weekly window, the person pastes the **STOP-SAFE** prompt. The agent also does this on its own if it ever sees a usage-limit warning. The agent then:
1. Starts nothing new. If the current step needs more than ~5 minutes, it stops it at a point that builds: commit `[A] T<n> wip: paused for usage limit`, with failing tests listed in the notes.
2. Updates this file:
   - the task row shows ▶ with "PAUSED (usage limit) at HH:MM IST";
   - **Paused** = the reset time the person gives;
   - **Next step** = the exact file/function, what's left, and the commands to run.
3. Runs `git pull --rebase`, then `git push`, replies `PAUSED-SAFE`, and does nothing else.

**While it's paused:** the other lanes keep going. If this lane is A or B (on the gate path) and the pause is longer than about 2 hours, an agent with quota left may take this lane over with the takeover prompt in `docs/PARALLEL_PLAN.md`.

**After the reset,** the person pastes the **RESUME** prompt. The agent:
1. runs `git pull --rebase` and `git status`;
2. finishes or reverts any uncommitted work;
3. runs the lane's tests;
4. clears **Paused**;
5. continues from **Next step**.

*Claude Code note:* if the hard limit is hit before the 5% stop, keep the session open. Claude Code (v2.1.234+) shows "limit resets HH:MM" and continues the task on its own after the reset. Every task is committed, so a sudden stop loses at most one step.

## Paused
(not paused)

## Next step
T4a: create `packages/arkiv` (`@hexfence/arkiv`): `PoisoningSchema` via `defineSchema`, `arkivReadClient`, `fetchAllEvidence` (key-paged, ≤100 rows), `findEvidenceByAddress`; plus `arkiv/schema.md`. Test: `pnpm --filter @hexfence/arkiv test`.

## Session log

| Time (IST) | Task | Result | Commit |
|---|---|---|---|
| 06 Nov 02:10 | T2 | ✔ `@hexfence/shared` per INTERFACES, 30 tests; pushed (S1) | 90f8b05 |
