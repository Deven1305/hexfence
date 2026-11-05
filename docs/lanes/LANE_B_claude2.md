# Lane B: HexFence Pay. Claude Code #2 (second laptop, other account)

**Account:** Dhruv's Claude account, on the second laptop.

**Owns:** `apps/pay/` only.

**Rules:** `AGENTS.md` + `docs/PARALLEL_PLAN.md`. One agent, no subagents, tasks in order. After each task: tests → update **your rows** in PROGRESS + the log below → commit `[B] T<n>: …` → `git pull --rebase` → `git push`. Never edit `packages/`, `contracts/` or `docs/INTERFACES.md`; if you need an interface change, write it under "Requests to Lane A".

## Tasks (in order)
1. **T6a Pay shell (doesn't need S1):**
   - a Vite + TypeScript static app in `apps/pay`, running on Sepolia;
   - connect an injected wallet (EIP-6963 / `window.ethereum`) with viem;
   - load a Safe address and the guard address (`VITE_GUARD_ADDRESS`);
   - Safe Protocol Kit set-up (**read the official Safe docs for the exact current API**).
2. **T6b Verdict UI (after S1, `@hexfence/shared`):**
   - build an ETH or ERC-20 `transfer` payment → `SafeCall` → `decodeSafeCall` → read `guard.payees(safe)` **once** (`hexFenceGuardAbi`) → `verdictFor`;
   - show the **exact English strings from spec §3.4**;
   - RED requires typing the last 6 characters; Reject cancels;
   - then create, sign and execute through the Protocol Kit;
   - show the revert reason, decoded with `hexFenceGuardAbi` (e.g. `LookalikeOfApprovedPayee`);
   - **done when:** unit tests cover string selection + the friction rule, and there's a manual Sepolia test (H6, after S3).
3. **T10 "listed" signal (after S2):**
   - `fetchAllEvidence` **once in bulk** → `Map<lowercase address, evidenceIds>` → `verdictFor(..., listed)`;
   - **done when:** a test shows a listed address → RED listed, and the synthetic L → only RED resembles.
4. **T11 Anon-RPC:** route Pay's RPC reads through `@anon-rpc/browser-harness` by default (read its docs), with the fallback labelled in the UI.
5. **T12 Hindi:** the §3.4 Hindi strings, with a language toggle and English one tap away. Flag them for a native-speaker check.

## Requests to Lane A
(none)

## Usage-limit rule (stop at 5% left, resume after the reset)
The agent can't see its own usage, so the **person running it checks**:
- **Claude Code:** run `/usage` and look at the plan-usage bars.
- **Codex:** run `/status` (5-hour and weekly limits), or open chatgpt.com/codex/settings/usage for the reset times. `/statusline` can keep the limits visible in the footer.

Check after every task, or about every 30–45 minutes.

**When about 5% is left** (≈95% used) in the session or weekly window, the person pastes the **STOP-SAFE** prompt. The agent also does this on its own if it ever sees a usage-limit warning. The agent then:
1. Starts nothing new. If the current step needs more than ~5 minutes, it stops it at a point that builds: commit `[B] T<n> wip: paused for usage limit`, with failing tests listed in the notes.
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
T6a

## Session log

| Time (IST) | Task | Result | Commit |
|---|---|---|---|
