# Lane B: HexFence Pay. Claude Code #2 (second laptop, other account)

**Account:** Dhruv's Claude account, on the second laptop.

**Owns:** `apps/pay/` only.

**Rules:** `AGENTS.md` + `docs/PARALLEL_PLAN.md`. One agent, no subagents, tasks in order. After each task: tests → update **your rows** in PROGRESS + the log below → commit `[B] T<n>: …` → `git pull --rebase` → `git merge --no-edit origin/main` → `git push`. Never edit `packages/`, `contracts/` or `docs/INTERFACES.md`; if you need an interface change, write it under "Requests to Lane A".

**Branch:** work only on **`lane-b`** (`git checkout lane-b`). When a task is ✔, merge `lane-b` into `main` as in `docs/PARALLEL_PLAN.md` Git rules step 4, push `main`, then go back to `lane-b`.

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

Check after every task, or about every 30–45 minutes (see the schedule below).

### Usage check schedule (Claude Code, Lane B: stop at **5% left**)
| When | The person running Lane B does this |
|---|---|
| After every `[B] T<n>: …` push | run `/usage` |
| Every 30 minutes on the clock (:00 and :30 IST), even mid-task | run `/usage` |
| `/usage` shows **≤5% left** (≥95% used) in the session **or** weekly window | paste **STOP-SAFE** below, with the reset time `/usage` shows |
| The reset time has passed | paste **RESUME** below |
| Lane B paused for more than ~2 hours (A and B are on the gate path) | give another agent the TAKEOVER prompt in `docs/AGENT_PROMPTS.md` |

**STOP-SAFE (paste as is; fill in the reset time):**
```
USAGE LOW: about 5% left. Do the Usage-limit stop routine in your lane file now: start nothing new; commit current work
as "[B] T<n> wip: paused for usage limit" (it must build; list failing tests in notes); set your task row to ▶
"PAUSED (usage limit) at <now IST>"; write "Paused: until <RESET TIME>" and an exact "Next step" (file, function,
what's left, commands); git pull --rebase; git push (on lane-b); reply PAUSED-SAFE and stop.
The limit resets at: <RESET TIME>
```

**RESUME (paste after the reset):**
```
Your usage limit has reset. Resume your lane: git checkout lane-b; git pull --rebase; git merge --no-edit origin/main; git status (finish or revert anything uncommitted);
run your lane's tests; read your lane file's log, Paused and Next step; clear Paused; continue the tasks in order with
the same rules (one agent, no subagents, your paths only, commit + push after every task).
```

**When about 5% is left** (≈95% used) in the session or weekly window, the person pastes the **STOP-SAFE** prompt. The agent also does this on its own if it ever sees a usage-limit warning. The agent then:
1. Starts nothing new. If the current step needs more than ~5 minutes, it stops it at a point that builds: commit `[B] T<n> wip: paused for usage limit`, with failing tests listed in the notes.
2. Updates this file:
   - the task row shows ▶ with "PAUSED (usage limit) at HH:MM IST";
   - **Paused** = the reset time the person gives;
   - **Next step** = the exact file/function, what's left, and the commands to run.
3. Runs `git pull --rebase`, then `git push` (on `lane-b`), replies `PAUSED-SAFE`, and does nothing else.

**While it's paused:** the other lanes keep going. If this lane is A or B (on the gate path) and the pause is longer than about 2 hours, an agent with quota left may take this lane over with the takeover prompt in `docs/PARALLEL_PLAN.md`.

**After the reset,** the person pastes the **RESUME** prompt. The agent:
1. runs `git checkout lane-b`, `git pull --rebase`, `git merge --no-edit origin/main` and `git status`;
2. finishes or reverts any uncommitted work;
3. runs the lane's tests;
4. clears **Paused**;
5. continues from **Next step**.

*Claude Code note:* if the hard limit is hit before the 5% stop, keep the session open. Claude Code (v2.1.234+) shows "limit resets HH:MM" and continues the task on its own after the reset. Every task is committed, so a sudden stop loses at most one step.

## Git exception (Dhruv's ruling, 06 Nov)
Lane B never commits to, merges into, or pushes `main`, and never enables auto-merge. This replaces step 4 of the Git rules in `docs/PARALLEL_PLAN.md`. Finished work goes up as a PR from a frozen snapshot branch: `git push origin lane-b:refs/heads/feat/pay-tN`, then `gh pr create --base main --head feat/pay-tN`. T10 to T12 PRs are drafts until T8 is done.

## H6: manual Sepolia test of HexFence Pay (human, needs S3: Guard deployed, demo Safe with guard + approved payee P)
1. Root `.env`: set `VITE_GUARD_ADDRESS`, `VITE_SEPOLIA_RPC_URL` (copy from `.env.example`).
2. `pnpm --filter @hexfence/pay dev`, open the printed URL in a browser with a wallet that owns the demo Safe (1-of-1), on Sepolia.
3. Connect, paste the demo Safe address, Load Safe. Expect: "HexFence Guard ... is active", P listed as payee.
4. Pay L (`0x4E185a3FC4B530244aB9ed0dE38167b403344120`, 0.0001 ETH): expect RED with "Your protected Safe will refuse this payment.". Type `344120`, Continue. The wallet prompts twice (sign, then send; the send may show a "will fail" warning, click through). Expect a tx hash that reverts on Sepolia Etherscan with `LookalikeOfApprovedPayee(L, P)`. Record the hash.
5. Pay B (any fresh address): AMBER, succeeds. Pay P: GREEN, succeeds. Record both hashes.
6. If the wallet refuses to send the reverting transaction, note which wallet; demo step 1 then needs another wallet or Safe{Wallet}.

## Paused
(not paused)

## Next step
T6 PR is open and its row waits on H6 (see above). Continue with T10 on `lane-b`: `apps/pay/src/evidence.ts` (bulk `fetchAllEvidence` -> Map keyed on `lookalike`), wire into `main.ts` `onCheck` (`verdictFor(decoded, payees, listed)`), `VITE_EXPLORER_URL` in `.env.example`, tests.

## Session log

| Time (IST) | Task | Result | Commit |
|---|---|---|---|
| 06 Nov ~03:00 | T6a+T6b | Pay shell + verdict UI. 20 Pay tests, tsc, vite build, contracts 14, shared 33, arkiv 4, detector 11 all green. Browser pane: shell and config-error states only (no wallet). Live test = H6. Note: `pnpm -r test` fails on this laptop only because a stray vite.config.ts in the Windows home folder is picked up by vitest in shared/arkiv/detector; run with `--config <empty file>` to verify. | bd20404 |
