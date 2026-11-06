DRAFT as requested; base feat/pay-t12, branch created from origin/lane-b after:
`git merge-base --is-ancestor origin/feat/pay-nox-only origin/lane-b` -> exit 0.

Updates only README CROPS P/limits and DEMO route wording to match the current Pay implementation: Nox for Sepolia RPC reads, visible route status, Safe/payee reads waiting during startup, the exact Skip: read directly (not anonymous) button, labelled direct startup fallback, and surfaced errors without silent fallback after Nox activation. The one bootstrap read and Arkiv bulk reads remain direct; signing/sending remain wallet operations.

The approximately 9-second startup figure is explicitly one local measurement supplied for this task, not a new measurement or a hosted benchmark. Hosted Nox and Guard or payee reads through Nox are explicitly untested. The earlier local browser VERSION() result is distinguished from those untested paths.

The lane-b/feat/pay-t12 tree lacks docs/DEMO.md and has only the draft CROPS heading. Restored DEMO from origin/main and added its route notes; added the scoped P paragraph to the existing README heading. No Git merge and no Pay source, lane log or PROGRESS edit.

Validation: wording checked against apps/pay/src/anon.ts, main.ts and rpc.ts; git diff --check passed. Final validation in C:/hexfence-work/nox-wording: contracts npm install --legacy-peer-deps completed; npx hardhat test -> 14 passed; corepack pnpm@10.34.9 -r test -> 87 passed, 3 integration tests skipped; corepack pnpm@10.34.9 -r build -> passed with existing bundle warnings. New live/startup/hosted/Guard-payee tests: not run (documentation-only scope; no new live claim).

