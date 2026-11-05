# Lane C: explorer + docs. Codex (third laptop)

**Account:** Dhruv's Codex account, on the third laptop.

**Owns:**
- `apps/explorer/`, `README.md`
- `arkiv/friction.md`, `arkiv/reach.md`, `arkiv/why-arkiv.md`, `arkiv/how-you-use-arkiv.md`
- `docs/AI_USAGE.md`, `docs/DEMO.md`

**Rules:** `AGENTS.md` + `docs/PARALLEL_PLAN.md`. One agent, tasks in order, no parallel work. After each task: tests/build → update **your rows** in PROGRESS + the log below → commit `[C] T<n>: …` → `git pull --rebase` → `git push`. Never edit `packages/`, `apps/pay/`, `apps/detector/`, `contracts/` or `docs/INTERFACES.md`; ask under "Requests to Lane A".

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

## Usage-limit rule (stop at 5% left, resume after the reset)
The agent can't see its own usage, so the **person running it checks**:
- **Claude Code:** run `/usage` and look at the plan-usage bars.
- **Codex:** run `/status` (5-hour and weekly limits), or open chatgpt.com/codex/settings/usage for the reset times. `/statusline` can keep the limits visible in the footer.

Check after every task, or about every 30–45 minutes.

**When about 5% is left** (≈95% used) in the session or weekly window, the person pastes the **STOP-SAFE** prompt. The agent also does this on its own if it ever sees a usage-limit warning. The agent then:
1. Starts nothing new. If the current step needs more than ~5 minutes, it stops it at a point that builds: commit `[C] T<n> wip: paused for usage limit`, with failing tests listed in the notes.
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
T5

## Session log

| Time (IST) | Task | Result | Commit |
|---|---|---|---|
