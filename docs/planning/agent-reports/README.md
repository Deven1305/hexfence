# Agent plans and reports (H12)

Copied as they are from the agents' working folders. Nothing was edited. Each file was scanned before copying for keys, seed phrases, RPC URLs with embedded keys, emails and personal paths; none were found (the only addresses are public contract addresses).

## Codex: pull-request reports
Codex wrote these as the text for its pull requests (some were saved as drafts first). Facts and numbers in them are Codex's own account of what it ran.

| File | What it is |
|---|---|
| [pr-pay-e2e.md](pr-pay-e2e.md) | End-to-end browser test of the built Pay app against the unchanged Guard and real Safe 1.4.1 contracts on a local chain |
| [pr7-item2.md](pr7-item2.md) | Same PR as above, with the follow-up that keeps the E2E build out of `apps/pay/dist` (opens with nearly the same text as pr-pay-e2e.md, then differs) |
| [pr-demo-setup.md](pr-demo-setup.md) | `contracts/scripts/setup-demo.js`: automated Sepolia demo set-up |
| [pr8-item1.md](pr8-item1.md) | Same PR as above, as revised (opens with nearly the same text as pr-demo-setup.md, then differs) |
| [pr-t8-tools.md](pr-t8-tools.md) | T8 operator tools: Guard verification plugin, checker script |
| [pr-pay-nox-only.md](pr-pay-nox-only.md) | Removes the tor-js and Nym routes from Pay; Nox only |
| [pr-pages-deploy.md](pr-pages-deploy.md) | GitHub Pages workflow for the explorer and Pay |
| [pr-nox-wording.md](pr-nox-wording.md) | Nox wording in the README and demo script |
| [pr-ai-usage.md](pr-ai-usage.md) | Corrects `docs/AI_USAGE.md` |

## Claude: plan
| File | What it is |
|---|---|
| [pasted-content-id-d619-you-are-humming-lerdorf.md](pasted-content-id-d619-you-are-humming-lerdorf.md) | The plan for Lane B (HexFence Pay), written in Claude Code plan mode before the Lane B Sonnet session started. The file name is the one Claude Code generated |

## Already in the repo (not copied)
- Prompts: [docs/AGENT_PROMPTS.md](../../AGENT_PROMPTS.md)
- Lane files and session logs: [Lane A (Claude)](../../lanes/LANE_A_claude1.md), [Lane B (Claude)](../../lanes/LANE_B_claude2.md), [Lane C (Codex)](../../lanes/LANE_C_codex.md)
- Parallel plan and interfaces: [docs/PARALLEL_PLAN.md](../../PARALLEL_PLAN.md), [docs/INTERFACES.md](../../INTERFACES.md)
- Task table and decisions log: [docs/PROGRESS.md](../../PROGRESS.md)
- The locked spec and earlier plans: the other files in [docs/planning/](..)

## Not here
Chat transcripts and session logs were not copied. Plans or prompts that live only on another team member's machine could not be reached from this one and are not included.
