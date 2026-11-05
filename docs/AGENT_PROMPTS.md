# Agent prompts (copy and paste)

| Lane | Who | Account / device |
|---|---|---|
| A | Deven | Deven's Claude account, Deven's laptop |
| B | Dhruv | Dhruv's Claude account, 2nd laptop |
| C | Dhruv | Dhruv's Codex account, 3rd laptop |

## Set-up on the 2nd and 3rd laptops (once)
Install Node 22 and git, then:
```
corepack enable
git clone https://github.com/Deven1305/hexfence.git
cd hexfence
cp .env.example .env    # fill in only what your lane needs
pnpm install
```
**Start B and C only after Lane A has pushed "[A] switch to parallel mode".**

## START: Lane A (paste into Deven's running Claude Code)
```
We're switching to parallel mode with 2 more agents (Dhruv's Claude = Lane B, Dhruv's Codex = Lane C). I've added
docs/PARALLEL_PLAN.md, docs/INTERFACES.md, docs/AGENT_PROMPTS.md and docs/lanes/*, and updated AGENTS.md and
docs/PROGRESS.md. Read all of them, including the Usage-limit rule in your lane file. First commit only those files
("[A] switch to parallel mode (3 lanes)"), then git pull --rebase and git push so the others can start. You are Lane A
(docs/lanes/LANE_A_claude1.md): finish T2 exactly as docs/INTERFACES.md says and push as soon as its tests pass,
because Lanes B and C depend on it. Then continue your lane's tasks in order. Single agent, no subagents, edit only
Lane A's paths.
```

## START: Lane B (Dhruv's Claude Code, 2nd laptop)
```
You are Lane B (HexFence Pay) of a 3-agent parallel build. Read AGENTS.md, docs/PARALLEL_PLAN.md, docs/INTERFACES.md,
docs/lanes/LANE_B_claude2.md (including its Usage-limit rule) and docs/planning/10_FINAL_What_To_Build_HexFence.md
(section 3.4 has the exact verdict strings). Work as ONE agent: do not use the Agent/Task tool or spawn subagents.
Edit only apps/pay/. Do your lane's tasks in order, starting from its "Next step". After each task: run tests, update
your rows in docs/PROGRESS.md and your lane log, commit "[B] T<n>: ...", git pull --rebase, git push. If
@hexfence/shared isn't on main yet, build the parts that don't need it and pull again later; never write your own
copy of the shared code. Implement everything for real: no mock data in the finished app.
```

## START: Lane C (Dhruv's Codex, 3rd laptop)
```
You are Lane C (explorer + docs) of a 3-agent parallel build. Read AGENTS.md, docs/PARALLEL_PLAN.md,
docs/INTERFACES.md, docs/lanes/LANE_C_codex.md (including its Usage-limit rule) and
docs/planning/10_FINAL_What_To_Build_HexFence.md. Work as one agent, one task at a time within your lane, and edit
only Lane C's paths. Start from your lane's "Next step". After each task: build/tests, update your rows in
docs/PROGRESS.md and your lane log, commit "[C] T<n>: ...", git pull --rebase, git push. If @hexfence/arkiv isn't on
main yet, use a typed fixture for PoisoningEvidence and switch to the real helpers when they land; remove the fixture
before T5 is ✔.
```

## STOP-SAFE (paste when /usage or /status shows about 5% left)
```
USAGE LOW: about 5% left. Do the Usage-limit stop routine in your lane file now: start nothing new; commit current work
as "[<lane>] T<n> wip: paused for usage limit" (it must build; list failing tests in notes); set your task row to ▶
"PAUSED (usage limit) at <now IST>"; write "Paused: until <RESET TIME>" and an exact "Next step" (file, function,
what's left, commands); git pull --rebase; git push; reply PAUSED-SAFE and stop.
The limit resets at: <RESET TIME>
```

## RESUME (paste after the reset)
```
Your usage limit has reset. Resume your lane: git pull --rebase; git status (finish or revert anything uncommitted);
run your lane's tests; read your lane file's log, Paused and Next step; clear Paused; continue the tasks in order with
the same rules (one agent, no subagents, your paths only, commit + push after every task).
```

## TAKEOVER (only if lane A or B is paused for more than ~2 hours)
```
Take over Lane <X>: read AGENTS.md, docs/PARALLEL_PLAN.md and docs/lanes/LANE_<X>_*.md. Follow that lane's rules and
owned paths, continue from its "Next step", and write your agent name in its log. Finish your current task in your own
lane first and push it.
```
