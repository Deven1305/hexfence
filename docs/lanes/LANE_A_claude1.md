# Lane A: core + data. Claude Code #1 (this laptop)

**Account:** Deven's Claude account, on Deven's laptop (this device).

**Owns:**
- `packages/shared/`, `packages/arkiv/`, `apps/detector/`, `contracts/`
- `arkiv/schema.md`
- the Now / H-boxes / addresses parts of `docs/PROGRESS.md`
- it is also the only lane that may change `docs/INTERFACES.md`, on request.

**Rules:** `AGENTS.md` + `docs/PARALLEL_PLAN.md`. One agent, no subagents, tasks in order. After each task: tests → update **your rows** in PROGRESS + the log below → commit `[A] T<n>: …` → `git pull --rebase` → `git push`.

**Branch:** Lane A works directly on **`main`**. Lanes B and C merge their branches (`lane-b`, `lane-c`) into `main` when their tasks are ✔.

## Tasks (in order)
1. **T2 `@hexfence/shared`:** implement **exactly** `docs/INTERFACES.md`.
   - **Done when:** vitest covers the fingerprint vectors (USDT, USDC, zero, the P/L pair), decodes the same cases as the Guard tests, gives every `verdictFor` branch, and never throws on junk calldata.
   - **Push immediately (S1).** B and C are waiting on it.
2. **T4a `@hexfence/arkiv` read side:** `PoisoningSchema`, `arkivReadClient`, `fetchAllEvidence`, `findEvidenceByAddress`, plus `arkiv/schema.md`.
   - **Done when:** the unit tests pass and a read against Rabdi works (empty is fine). **Push (S2).**
3. **T3 `apps/detector`:** mainnet logs → rules → `evidence.jsonl`.
   - **Done when:** the fixture tests pass, and a real run (H4) finds ≥5 pairs.
4. **T4b writer:** `writeEvidence` (idempotent) + `pnpm --filter @hexfence/detector publish:arkiv`.
   - **Done when:** a re-run creates 0 duplicates, and the README query is noted in this file for Lane C (H5). **Push (S4).**
5. **T1 finish:** once H1/H2 are done, record the guard address, and run `contracts` tests to stay green.
6. **T13:** ≥20 pairs, and a precision table from the H9 labels. Put the numbers in this file for Lane C.

## Notes for other lanes (A writes facts here, B and C read them)
- `@hexfence/arkiv` read side is on main (S2): `arkivReadClient({ accessKey })`, `fetchAllEvidence(client, publisher)`, `findEvidenceByAddress(client, publisher, address)`. Browser-safe (no Node imports).
- Arkiv README query: (to fill in at T4b)
- Detector numbers for the README (T3): 24 h run 06 Nov, blocks 26343865–26351064: 1,330,446 USDT/USDC Transfer logs → 43,227 suspected pairs (31,801 zero-value, 11,426 dust); 40/40 random records confirmed against receipts. Precision: pending H9.
- Publisher wallet: (to fill in)

## Usage-limit rule (stop at 5% left, resume after the reset)
The agent can't see its own usage, so the **person running it checks**:
- **Claude Code:** run `/usage` and look at the plan-usage bars.
- **Codex:** run `/status` (5-hour and weekly limits), or open chatgpt.com/codex/settings/usage for the reset times. `/statusline` can keep the limits visible in the footer.

Check after every task, or about every 30–45 minutes (see the schedule below).

### Usage check schedule (Claude Code, Lane A: stop at **5% left**)
| When | The person running Lane A does this |
|---|---|
| After every `[A] T<n>: …` push | run `/usage` |
| Every 30 minutes on the clock (:00 and :30 IST), even mid-task | run `/usage` |
| `/usage` shows **≤5% left** (≥95% used) in the session **or** weekly window | paste **STOP-SAFE** below, with the reset time `/usage` shows |
| The reset time has passed | paste **RESUME** below |
| Lane A paused for more than ~2 hours (A and B are on the gate path) | give another agent the TAKEOVER prompt in `docs/AGENT_PROMPTS.md` |

**STOP-SAFE (paste as is; fill in the reset time):**
```
USAGE LOW: about 5% left. Do the Usage-limit stop routine in your lane file now: start nothing new; commit current work
as "[A] T<n> wip: paused for usage limit" (it must build; list failing tests in notes); set your task row to ▶
"PAUSED (usage limit) at <now IST>"; write "Paused: until <RESET TIME>" and an exact "Next step" (file, function,
what's left, commands); git pull --rebase; git push (on main); reply PAUSED-SAFE and stop.
The limit resets at: <RESET TIME>
```

**RESUME (paste after the reset):**
```
Your usage limit has reset. Resume your lane: git checkout main; git pull --rebase; git status (finish or revert anything uncommitted);
run your lane's tests; read your lane file's log, Paused and Next step; clear Paused; continue the tasks in order with
the same rules (one agent, no subagents, your paths only, commit + push after every task).
```

**When about 5% is left** (≈95% used) in the session or weekly window, the person pastes the **STOP-SAFE** prompt. The agent also does this on its own if it ever sees a usage-limit warning. The agent then:
1. Starts nothing new. If the current step needs more than ~5 minutes, it stops it at a point that builds: commit `[A] T<n> wip: paused for usage limit`, with failing tests listed in the notes.
2. Updates this file:
   - the task row shows ▶ with "PAUSED (usage limit) at HH:MM IST";
   - **Paused** = the reset time the person gives;
   - **Next step** = the exact file/function, what's left, and the commands to run.
3. Runs `git pull --rebase`, then `git push` (on `main`), replies `PAUSED-SAFE`, and does nothing else.

**While it's paused:** the other lanes keep going. If this lane is A or B (on the gate path) and the pause is longer than about 2 hours, an agent with quota left may take this lane over with the takeover prompt in `docs/PARALLEL_PLAN.md`.

**After the reset,** the person pastes the **RESUME** prompt. The agent:
1. runs `git checkout main`, `git pull --rebase` and `git status`;
2. finishes or reverts any uncommitted work;
3. runs the lane's tests;
4. clears **Paused**;
5. continues from **Next step**.

*Claude Code note:* if the hard limit is hit before the 5% stop, keep the session open. Claude Code (v2.1.234+) shows "limit resets HH:MM" and continues the task on its own after the reset. Every task is committed, so a sudden stop loses at most one step.

## Paused
(not paused)

## Next step
- **T4b ⏸ H5:** once H5 is ticked: `pnpm --filter @hexfence/detector publish:arkiv --limit 25` → run it again (must print `0 created`) → `ARKIV_LIVE=1 ARKIV_PUBLISHER=<addr> pnpm --filter @hexfence/arkiv test` → fill "Publisher wallet" + "Arkiv README query" below → decide the publish scope (43k/day).
- **T13 ⏸ H9:** the sheet is `apps/detector/labels/h9-sample.csv`; once it's labelled, run `pnpm --filter @hexfence/detector precision` and put the numbers below for Lane C.
- **T1 ⏸ H1+H2:** record the Guard address, keep contracts green.

## Session log

| Time (IST) | Task | Result | Commit |
|---|---|---|---|
| 06 Nov 01:49 | T2 | ✔ `@hexfence/shared` per INTERFACES, 30 tests; pushed (S1) | 90f8b05 |
| 06 Nov 01:59 | T4a | ✔ `@hexfence/arkiv` read side + `arkiv/schema.md`; live Rabdi read OK (S2) | 691f634 |
| 06 Nov 02:16 | T3 | ✔ detector; real 24h run 43,227 pairs, 40/40 receipts confirmed; Guard parity test added to T2 | aaa233c |
| 06 Nov 02:24 | T4b | ⏸ code done (writer, batch publisher, CLI); live dry run stops only at the tGLM balance; waiting on H5 | d56bee3 |
| 06 Nov 02:23 | T13 | ⏸ ≥20 pairs done (43,227); 30-record label sheet + precision command ready; waiting on H9 | 4c631f1 |
