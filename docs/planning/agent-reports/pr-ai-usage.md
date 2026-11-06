Corrects AI_USAGE so the initial Claude explorer/docs work is separated from Codex's completed follow-up PRs #7-#10. Adds PR links, exact commit IDs and validation limits; removes the stale "planned for Codex" wording. Facts added were checked only against git log and gh pr view (including PR descriptions/commits), as requested.

Lane B conflict check: git log origin/main..origin/lane-b -- docs/AI_USAGE.md and git diff origin/main...origin/lane-b -- docs/AI_USAGE.md showed no Lane-B-only edits. The file is absent in the older lane-b tree; that is not a branch-side deletion since their common base. No protected file was changed.

Validation: git diff --check passed. No runtime code changed. Final required checks ran on C:/hexfence-work/t8-tools: contracts npx hardhat test -> 14 passed; corepack pnpm@10.34.9 -r test -> 76 passed, 3 integration tests skipped; corepack pnpm@10.34.9 -r build -> passed with existing Pay bundle warnings. No extra runtime tests were run in this documentation-only worktree. Live Sepolia, hosting and human wallet/review steps: not run (documentation-only item).

