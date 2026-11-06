# Merging Pramaan into HexFence: read this before you start

**Do not merge Pramaan code into `main` until the team has ETHGlobal's answer in writing.** Moving pre-event code in the wrong way costs us every partner prize.

Fallback: the tag `hexfence-pre-pramaan` marks the last `main` without Pramaan. We can always submit from it.

## What the rules say

From [ETHGlobal's rules](https://ethglobal.com/rules), section "Rules on Pre-existing Work", read 6 Nov 2026:

- **Classic "From Scratch" track:** the project must begin at kick-off. Pre-existing project-specific code, designs or assets are not allowed.
- **Any track not an approved Continuity track:** using pre-existing project-specific work makes the submission ineligible for Partner prizes and the Finalist category.
- **Continuity track:** building on an existing codebase is allowed. We must document what existed before and add substantive new work. Partner prize eligibility may vary.
- **All tracks:** pre-existing work must be disclosed in writing to ETHGlobal and in the submission (repo history, video, description). Undisclosed work can mean disqualification, revoked prizes and a ban from future events.
- **Version control:** repos with single commits of large files and no proper history are assumed unqualified unless proven otherwise.

## Where we stand

- **Pramaan looks pre-existing.** The private `Deven1305/eth_pramaan` repo was created 5 Nov 00:49 IST and its first commit imports a whole codebase. HexFence's first commit is 6 Nov 01:19 IST. Our spec (`docs/planning/10_FINAL_What_To_Build_HexFence.md:293`) says Pramaan was built before the event and isn't eligible.
- **HexFence is written up as from-scratch.** `docs/SUBMISSION.md` and `docs/JUDGE_READINESS.md` target Arkiv's "Build on Arkiv (from scratch)" prize. `AGENTS.md` says "Don't use any code from the pre-event Pramaan repo."
- **Not known yet:**
  - which track we are registered on, and whether it can still change;
  - the exact kick-off time;
  - whether a feature rewritten now from a pre-event idea counts as pre-existing. The rules name code, designs and assets, not ideas, but that reading is ours, not ETHGlobal's.

## Ask this first

Send it to ETHGlobal, and ask the Arkiv booth about Arkiv's part:

> We are submitting HexFence, started after kick-off. A teammate's project, Pramaan, existed before kick-off. (1) If we rewrite some of its ideas as new code during the event and disclose that, are we still on the Classic track and eligible for partner prizes? (2) If we merge Pramaan's existing code instead, can we still move to a Continuity track, and are Arkiv, Ethereum Foundation and Chainlink prizes still open to us?

## The two paths

| | A: new code from the ideas (recommended) | B: merge the existing code |
|---|---|---|
| Needs | ETHGlobal's yes to question 1 | ETHGlobal's yes to question 2 |
| Pramaan files | None copied. Don't open its source while writing | Brought in with history |
| Arkiv prize | From-scratch prize stays as written | From-scratch prize gone. The "existing projects" prize is only for Continuity participants |
| Docs to change | A disclosure line in the submission and README | `AGENTS.md` rule and spec line (humans only), `SUBMISSION.md`, `JUDGE_READINESS.md`, `arkiv/*.md`, README "what existed before" section |
| Judging | New work, so the note below shouldn't apply (our reading) | The rules say projects using a majority of pre-existing work have historically scored lower |

Either way, no answer means no merge: we submit from `main` as it stands.

## How to work

1. Work on your own branch (`feat/pramaan-…`) in your own worktree. `main` only changes through a PR after a green `build` check. No force-push.
2. **Path B only:** keep Pramaan's history, for example `git subtree add --prefix=pramaan <url> main` (not tested here). Never paste it in as one big commit. Keep it under `pramaan/`, outside `pnpm-workspace.yaml`, because both repos have `apps/`, `packages/` and `contracts/`.
3. The hosted site is static GitHub Pages. Anything that needs Pramaan's server or Docker won't run there, so don't link judges to it unless it is hosted and tested.
4. Don't change `HexFenceGuard` v1, V2, the module guard or their tests. Don't edit `AGENTS.md`, `docs/INTERFACES.md` or `docs/planning` unless the humans decide on path B.
5. Keep the wording rules: status is always "suspected"; no "verified", "scam", "malicious", or "safe" as an adjective in UI text. Unsupported transactions show "cannot verify". Only claim what the merged feature really does.
6. Secrets stay in the ignored `.env`. Pramaan's keys must not land in commits, logs or the built site.

## Before any PR to `main`

Run all of these:

```bash
cd contracts && npx hardhat test
```

```bash
corepack pnpm@10.34.9 -r test
```

```bash
corepack pnpm@10.34.9 -r build
```

Then open the built site, explorer and Pay, and confirm that nothing already working broke.

## If `main` changes after the release record

The planned release record on Arkiv binds one build's `SHA256SUMS.txt` to one commit. A later build makes it out of date, and the demo video should show the build we submit. So tell Dhruv before any Pramaan work lands on `main`, or as soon as you know it won't.
