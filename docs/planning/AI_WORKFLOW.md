# HexFence: how to build it with Claude Code + Codex, one agent at a time

**Repo name: `hexfence`** (public, MIT licence).
- **GitHub description:** "HexFence: a Safe Guard that refuses lookalike payments (deny by resemblance), with open address-poisoning evidence on Arkiv. ETHGlobal Mumbai 2026."
- **Topics:** `ethereum` `safe` `address-poisoning` `arkiv` `crops`

## The idea in one paragraph
Only **one AI agent works on the repo at a time**. **Claude Code** goes first. When its limit runs out, **Codex** continues. When Codex runs out and Claude's limit has reset, Claude continues again.

Both agents follow the same rules (`AGENTS.md`) and the same task list (`docs/PROGRESS.md`), **strictly in order, one task at a time, with no subagents and no parallel work**. After every task, the agent updates `docs/PROGRESS.md` and commits, so a stop at any moment loses at most one task. The humans do what an AI can't: keys, faucets, Safe{Wallet} clicks, testing, reviews, the video.

## Set-up (10 minutes, one person)
1. Create the `hexfence` repo on GitHub and clone it on the **driver laptop**.
2. Copy into the repo:
   - `AGENTS.md`, `CLAUDE.md` and `docs/PROGRESS.md` from this folder;
   - `10_FINAL_What_To_Build_HexFence.pdf` **and** `.md` → `docs/planning/`, together with every other plan, prompt and GPT/Claude report. The rules require them.
   - the whole `11_HexFence_Guard_reference/` folder → `contracts/`.
3. Commit it yourself: `git add -A && git commit -m "T0 starter: planning docs, agent rules, Guard reference (AI-generated, see AI_USAGE)"`, then `git push`.
4. Start Claude Code in the repo root and paste **Prompt 1**.

## Prompt 1: start Claude Code (paste as is)
```
Read docs/planning/10_FINAL_What_To_Build_HexFence.pdf (the .md next to it has the same text; prefer the .md for exact
strings), then AGENTS.md and docs/PROGRESS.md. Work as ONE agent in this session only: do not use the Agent/Task tool,
do not spawn subagents, and do not run tasks in parallel. Do the tasks in docs/PROGRESS.md strictly in order, one at a
time, starting with the first task that is not ✔. For each task: implement -> run its tests -> fix -> update
docs/PROGRESS.md (status, commit, notes, "Next step") -> commit. Never end a task with uncommitted work. If a task needs a
human (keys, faucet, Safe{Wallet} clicks, deploys, manual tests), write exact steps under "Waiting on humans", mark the
task ⏸ and continue with the next task that does not depend on it; come back to ⏸ tasks as soon as the human box is ticked.
Keep the spec's scope: P0 -> gate -> P1; P2 only if all P1 is ✔. Agent name for the log: Claude Code.
```

## Prompt 2: Codex takes over (when Claude stops)
Before starting, check that Claude's last work is committed and pushed (`git status` is clean). On another machine, run `git pull` first.
```
You are continuing a project another AI agent (Claude Code) was building. Read AGENTS.md, docs/PROGRESS.md and
docs/planning/10_FINAL_What_To_Build_HexFence.md. Run `git status` and `git log --oneline -8`. If there are uncommitted
changes, finish them so the tests pass (or revert them) and commit. Run every test suite listed in AGENTS.md. Then continue with
the task marked ▶, otherwise the first ☐, strictly in order, one at a time, no parallel work. Same rules as AGENTS.md:
after every task update docs/PROGRESS.md and commit. Agent name for the log: Codex.
```

## Prompt 3: Claude Code comes back after Codex
Use Prompt 2 with "Claude Code" and "Codex" swapped, and still no subagents.

## Who does what (4 people, 2 AI accounts, sequential)

| Person | Role while the agent runs |
|---|---|
| **Driver** (runs the agent; rotate every few hours) | Watches the agent, answers questions, stops it if it goes off-scope, pushes after every session |
| **Baqir** | Human tasks for the Guard and Safe: H1–H3, H7 (deploy, demo Safe, removal drill, demo payments). Reviews the Guard commits. |
| **Deven** | H4–H5 (mainnet RPC, Arkiv key + faucet). Checks the detector output on Etherscan (H9 labels). Reviews detector/Arkiv commits. |
| **Dhruv + Akshat** | H6 (testing HexFence Pay), reviews of the client and explorer, README/CROPS/Arkiv text, H8 (video) |

## Stay eligible (ETHGlobal rules)
- AI must *assist*, not create the entire project. Humans review every commit, make the on-chain and Safe decisions, test, write and curate the docs, and record the demo.
- Keep `docs/AI_USAGE.md` honest: it should say which agent did which task (copy from the session log in `docs/PROGRESS.md`).
- **Small commits** (at least one per task). Rotate the driver so commits come from several accounts, and make the human-task commits from your own accounts.
- Put every prompt you use (including these) in `docs/planning/`.
