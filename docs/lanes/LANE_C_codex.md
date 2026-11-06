# Lane C: explorer + docs. Codex (third laptop)

**Account:** Dhruv's Codex account, on the third laptop.

**Owns:**
- `apps/explorer/`, `README.md`
- `arkiv/friction.md`, `arkiv/reach.md`, `arkiv/why-arkiv.md`, `arkiv/how-you-use-arkiv.md`
- `docs/AI_USAGE.md`, `docs/DEMO.md`

**Rules:** `AGENTS.md` + `docs/PARALLEL_PLAN.md`. One agent, tasks in order, no parallel work. After each task: tests/build → update **your rows** in PROGRESS + the log below → commit `[C] T<n>: …` → `git pull --rebase` → `git merge --no-edit origin/main` → `git push`. Never edit `packages/`, `apps/pay/`, `apps/detector/`, `contracts/` or `docs/INTERFACES.md`; ask under "Requests to Lane A".

**Branch:** work only on **`lane-c`** (`git checkout lane-c`). When a task is ✔, merge `lane-c` into `main` as in `docs/PARALLEL_PLAN.md` Git rules step 4, push `main`, then go back to `lane-c`.

## Tasks (in order)
1. **T5 explorer:** a Vite + TypeScript static app in `apps/explorer`.
   - **Search by address** uses `findEvidenceByAddress`. **List + counts by variant** use `fetchAllEvidence` (`@hexfence/arkiv`, S2).
   - Show the Etherscan links for `attackTx` / `referenceTx` and the label **"Ethereum mainnet evidence · status: suspected"**.
   - Before S2, render from a typed fixture that matches `PoisoningEvidence`. **Remove the fixture before marking T5 ✔.**
   - **Done when:** it builds, it shows the real records from A's publisher (S4), and it has no trackers.
2. **T9 "Verify on Ethereum":** fetch both receipts (viem, `VITE_MAINNET_RPC_URL`) and check for a `Transfer` log from the canonical token, with from/to matching the variant, value 0 (zero-value) or under 1e6 (dust), and the reference block earlier. Show ✓ or "could not verify".
   - **Done when:** there are unit tests with saved receipts for both outcomes.
3. **T7 docs:**
   - `README.md`: run steps for every app, the architecture, what's new vs reused, the **CROPS** section from spec §6, limits, and the addresses/hashes table, taken from PROGRESS;
   - the four `arkiv/*.md` judging files (`schema.md` is A's);
   - `docs/AI_USAGE.md`, built from all three lane logs.

   **Done when:** there are no placeholders except values the humans haven't produced yet.
4. **Demo:** `docs/DEMO.md`, the demo script and checklist from spec §4 (part 1 real evidence, part 2 synthetic re-enactment, part 3 why it's new).

## Requests to Lane A
(none)

## Notes from Lane A (spec review, 06 Nov 02:20 IST)
- **Data size:** the detector finds ~43,000 suspected pairs per 24 hours (PROGRESS Decisions log); how many go to Arkiv is still being decided (T4b). Don't fetch everything before first paint: render progressively, and use **search** (`findEvidenceByAddress`, indexed, fast) as the main path. If counts by variant need a cheaper call, ask under "Requests to Lane A" (the SDK has a `count()` builder).
- **AI_USAGE (spec §8):** name the reference Guard (`contracts/`) explicitly as **AI-generated (Claude) and reviewed**, and list which agent did which task from all three lane logs.
- **DEMO step 5 (client off, pay L in Safe{Wallet}):** Safe{Wallet} will warn that the tx will fail; the presenter must choose to execute anyway (with a manual gas limit in the wallet) so the revert is mined. Put that in `docs/DEMO.md`.
- **T9 needs `VITE_MAINNET_RPC_URL`** (now in `.env.example`). The public `https://ethereum-rpc.publicnode.com` worked for the detector.
- **Static build for hosting (H11):** the explorer's `dist/` must work from any path (`base: "./"` in Vite).

## Usage-limit rule (stop at 10% left, resume after the reset)
The agent can't see its own usage, so the **person running it checks**:
- **Claude Code:** run `/usage` and look at the plan-usage bars.
- **Codex:** run `/status` (5-hour and weekly limits), or open chatgpt.com/codex/settings/usage for the reset times. `/statusline` can keep the limits visible in the footer.

Check after every task, or about every 30–45 minutes (see the schedule below).

### Usage check schedule (Codex, Lane C: stop at **10% left**)
| When | The person running Lane C does this |
|---|---|
| After every `[C] T<n>: …` push | run `/status` |
| Every 30 minutes on the clock (:00 and :30 IST), even mid-task | run `/status` |
| `/status` shows **≤10% left** (≥90% used) in the session **or** weekly window | paste **STOP-SAFE** below, with the reset time `/status` shows |
| The reset time has passed | paste **RESUME** below |
| Lane C paused for more than ~2 hours (C is off the gate path: only if A and B are idle) | give another agent the TAKEOVER prompt in `docs/AGENT_PROMPTS.md` |

**STOP-SAFE (paste as is; fill in the reset time):**
```
USAGE LOW: about 10% left. Do the Usage-limit stop routine in your lane file now: start nothing new; commit current work
as "[C] T<n> wip: paused for usage limit" (it must build; list failing tests in notes); set your task row to ▶
"PAUSED (usage limit) at <now IST>"; write "Paused: until <RESET TIME>" and an exact "Next step" (file, function,
what's left, commands); git pull --rebase; git push (on lane-c); reply PAUSED-SAFE and stop.
The limit resets at: <RESET TIME>
```

**RESUME (paste after the reset):**
```
Your usage limit has reset. Resume your lane: git checkout lane-c; git pull --rebase; git merge --no-edit origin/main; git status (finish or revert anything uncommitted);
run your lane's tests; read your lane file's log, Paused and Next step; clear Paused; continue the tasks in order with
the same rules (one agent, no subagents, your paths only, commit + push after every task).
```

**When about 10% is left** (≈90% used) in the session or weekly window, the person pastes the **STOP-SAFE** prompt. The agent also does this on its own if it ever sees a usage-limit warning. The agent then:
1. Starts nothing new. If the current step needs more than ~5 minutes, it stops it at a point that builds: commit `[C] T<n> wip: paused for usage limit`, with failing tests listed in the notes.
2. Updates this file:
   - the task row shows ▶ with "PAUSED (usage limit) at HH:MM IST";
   - **Paused** = the reset time the person gives;
   - **Next step** = the exact file/function, what's left, and the commands to run.
3. Runs `git pull --rebase`, then `git push` (on `lane-c`), replies `PAUSED-SAFE`, and does nothing else.

**While it's paused:** the other lanes keep going. If this lane is A or B (on the gate path) and the pause is longer than about 2 hours, an agent with quota left may take this lane over with the takeover prompt in `docs/PARALLEL_PLAN.md`.

**After the reset,** the person pastes the **RESUME** prompt. The agent:
1. runs `git checkout lane-c`, `git pull --rebase`, `git merge --no-edit origin/main` and `git status`;
2. finishes or reverts any uncommitted work;
3. runs the lane's tests;
4. clears **Paused**;
5. continues from **Next step**.

*Codex note:* Lane C stops at **10%** (not 5%), by the team's choice, to leave a bigger margin for the wip commit and push. Every task is committed, so a sudden stop loses at most one step.

## Paused
(not paused)

## Next step
After H5/S4: set `VITE_ARKIV_PUBLISHER`, run `pnpm --filter @hexfence/explorer dev`, confirm real records and counts, click Verify on one, then mark T5 ✔. Fill the README and `arkiv/reach.md` values as humans and Lane A produce them. Add the Anon-RPC sentence to the README CROPS section only when T11 is ✔; add T13 precision when H9 is done.

## Session log

| Time (IST) | Task | Result | Commit |
|---|---|---|---|
| 06 Nov 02:31 | T5 | ⏸ explorer built, 5 tests, live Rabdi read works with an empty test publisher; real records wait on S4/H5. Agent: Claude Code (Opus) on Dhruv's account, standing in for Codex one time. Git: PRs, not direct merges to main (the user's global rule) | 52bb472 |
| 06 Nov 02:31 | T7 | ✔ README, four Arkiv files, AI_USAGE; only human-produced values left open | 03804f5 |
| 06 Nov 02:31 | Demo | ✔ docs/DEMO.md; timings shortened so the video fits 3:00 | 393ad20 |
| 06 Nov 02:31 | T9 | ✔ Verify on Ethereum: 24 tests on real saved receipts; live ✓ and could-not-verify checked in the browser | e3db3e0 |
| 06 Nov (feat/live-evidence) | Scheduled publisher + explorer views | Implemented bounded scheduled publication, automatic bulk paging, local views/search/address checks and focused tests. No commit per organiser instruction. Test startup blocked by Node spawn EPERM; no workaround. Details and human setup: docs/LIVE_EVIDENCE.md. | uncommitted for organiser review |
