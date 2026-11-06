# Team handoff: read this before working on HexFence

For teammates and their coding agents. Checked against `main` at **8c3c175** (6 Nov 2026, evening). Check `git log` and open PRs for anything newer.

**Deadline:** submission Sat 7 Nov 2026, 09:00 IST (aim for 08:30). Dhruv decides when work stops; there is no earlier freeze. Leave enough time to record the video, upload it and submit.

**Read next, in this order:** `AGENTS.md`, `docs/PROGRESS.md`, `docs/JUDGE_READINESS.md`, then the files named in the section you work on. The locked spec is `docs/planning/10_FINAL_What_To_Build_HexFence.md`.

## What it is

The detector reads Ethereum mainnet USDT and USDC logs and publishes suspected address-poisoning records to Arkiv (Rabdi testnet). The explorer shows them. HexFence Pay checks a Safe payment against approved payees before signing. `HexFenceGuard` on Sepolia refuses a lookalike of an approved payee on-chain.

| Live page | URL | Needs |
|---|---|---|
| Landing | https://deven1305.github.io/hexfence/ | Nothing |
| Explorer (Evidence, Losses, Campaigns, Check my address) | https://deven1305.github.io/hexfence/explorer/ | Nothing |
| Pay, read-only preview on the v1 demo Safe | https://deven1305.github.io/hexfence/pay/?safe=0x3BCc3969713778F3Ed26AE1490529eeBAD43FbD5 | Nothing; cannot sign or send |
| Pay, read-only preview on the V2 Safe | https://deven1305.github.io/hexfence/pay/?safe=0x5142C7E9DE82726CaCb847c5469D460508738214 | Nothing |
| Pay, full flow | https://deven1305.github.io/hexfence/pay/ | A Sepolia wallet that owns the Safe |

URLs are case-sensitive (`/Pay/` is a 404). Pages deploys from `main` through `.github/workflows/pages.yml`. Hard-refresh if you see an old page.

Checked in headless Chrome on 6 Nov at about 18:00 IST: the landing page showed 173 published records; the explorer loaded 173 of 173; Pay on the demo Safe reached "Nox reads active", "v1.4.1 · 1/2 · Guard active" and "Sentinel simulation: no alerts returned for this Safe", and gave the synthetic L a RED "Possible address poisoning" verdict. No console errors on any of the three pages.

## What is on main

| Item | PR | What exists | Not done |
|---|---|---|---|
| v1 Guard and demo | T1–T8 | `HexFenceGuard` 0xA061…9748, verified on Etherscan and Sourcify; demo Safe 0x3BCc…FbD5; real L revert, B and P success, removal drill | Payments ran from a script, not a person (H6) |
| A1 Auto-Fence V2 | #32 | Separate `HexFenceGuardV2` 0x0adF…98c7 with opt-in learning; isolated Safe 0x5142…8214 | Scripted P-then-L run done 6 Nov: [P](https://sepolia.etherscan.io/tx/0xfc93f06334211546d1371ed3b2b5fbafc77842a03e227f7197a2e50680d866a5), [L reverted](https://sepolia.etherscan.io/tx/0x2585f5ce7bce79a6c139d19f56e4f125f8c84a7c09fe59d27d2598eb83c328ff). No human wallet run |
| A2 Sentinel (Chainlink CRE) | #29, #35 | Workflow source, WASM build in CI, consumer `HexFenceAlerts` 0x97F6…D80F, Pay Radar reads it | No successful `cre workflow simulate`; no Telegram message; Radar shows no alerts |
| A3 UI | #28 | Shared UI package, Address X-Ray, step navigation | |
| A4 Rescue | #36 | Explorer **Losses** tab: one supported suspected follow-up payment, 303.635007 USDT, published as `hexfence.loss.v1`; downloadable pack with SHA-256 | It is an investigative lead, not a confirmed loss |
| B2 Campaigns | #38 | Explorer **Campaigns** tab: groups records by attack transaction, hourly chart from real block times, match-length model | The hourly chart counts published records, not attacks (see below) |
| B5 Module guard | #41 | `HexFenceModuleGuard` for Safe 1.5.0 at 0xa7Dc…546B, reads V2's list; 8 tests on a real 1.5.0 Safe | **No live Safe uses it; no live module payment has run** |
| B6 Explain layer | #40 | Pay panel "Explain another call (ERC-7730)": shows a pasted descriptor's intent and fields; the verdict stays CANNOT VERIFY | Nothing is fetched; the Guard still does not check those calls |
| B7 Client attestation | #39 | Pages builds publish `SHA256SUMS.txt` and GitHub build attestations | No live Arkiv release record |
| B8 Pay as a Safe App | #31 | Pay runs inside Safe{Wallet} via the Safe Apps SDK | **Not tested by a person inside Safe{Wallet}** |
| C1 Check SDK and MCP | #34 | `@hexfence/check` (offline check + evidence Bloom filter) and `@hexfence/mcp` (stdio server, tool `hexfence_check`) | Offline only: reads no chain data |
| C3 Multi-publisher | #42 | Explorer can read extra publishers from `VITE_ARKIV_EXTRA_PUBLISHERS`; cards say "Published by N of M publishers read" | **No second publisher with records exists, and `pages.yml` does not pass that variable, so the live explorer reads one publisher** |
| T14 Chrome extension | #24 | `apps/extension` builds and has unit tests | Not tested on app.safe.global with a real wallet |

**Not built:** B3 (batch protection) was cut. C2 and C4 were scrapped. B1 was not built because it needs approval to spend tGLM. The separately deployed governance guard (B4) is described in the follow-up below; no live Safe is configured with it.

## Why the Campaigns hourly chart has one tall bar

The live chart's hourly shape comes from how the records were published, not from attack activity. Read from Arkiv on 6 Nov: of the 1,126 records, 125 were published with `publish:arkiv --limit 125`, which takes the most recent attacks, and they all share attack block 26352743. Another 48 were spread evenly across that scan, and the last 953 were selected from a second scan. The detector itself found 47,694 pairs over the same 7,200 blocks, roughly 2,000 an hour. PR `fix/campaign-timeline` retitles the chart "Published records per UTC hour" and adds a computed note when one hour holds most records.

## Open work

| Who | Item | Blocks |
|---|---|---|
| Dhruv | H6: real wallet test on the demo Safe (L refused at E74120, accepted at 344120, reverts; B and P succeed) | T6, the video's live-send step |
| A person, not an AI | H9: check the 30 rows of `apps/detector/labels/h9-sample.csv` on Etherscan. The current labels were assigned by AI and are not human precision | `‹PRECISION›` |
| A native speaker | H10: check the Hindi (`docs/H10_HINDI_CHECK.md`) | T12 |
| A team member | Read `docs/GUARD_REVIEW.md` and the contract, sign off, be named as `‹GUARD_REVIEWER›` | Submission text |
| A person with a Chainlink account | `cre login`, then the simulation in `CHAINLINK.md`; save only real output to `sentinel/SIMULATION.md` | Chainlink entry |
| Dhruv | T14: extension go/no-go with MetaMask on app.safe.global (`apps/extension/TESTING.md`) | Extension claims |
| A person | B8: add Pay as a custom Safe App on a Sepolia Safe and try one payment (`apps/pay/SAFE_APP.md`) | Safe App claims |
| Dhruv | Post-Mumbai sentence at `arkiv/reach.md` | Arkiv reach answer |
| Team | Record the video from `docs/DEMO.md`, upload, fill `‹VIDEO_URL›`, submit by 08:30 | Everything |

## Funds and addresses

Publisher `0x36141ba063390f0d91Af7a5a9dF8dc1d80D699ec` published 1,126 poisoning records and 1 loss record (it holds about 9.79 tGLM after a 10 tGLM faucet claim on 6 Nov). **Do not move tGLM without Dhruv's explicit approval.** Every public address and hash is in `docs/PROGRESS.md` and `docs/SUBMISSION.md`.

## Rules that are easy to break

- **Honesty:** nothing fake or hard-coded. Evidence status is always "suspected". The synthetic Sepolia lookalike only ever gets "resembles your approved payee". Don't claim anything in the "Not done" column above.
- **Public pages lead with what the product does.** Limits live in `README.md` and are answered honestly when asked. Warnings a user needs before signing stay.
- **UI copy:** no "safe" as an adjective, and no "verified", "scam" or "malicious" (Safe the product, "Verify on Ethereum" and "cannot verify" are fine).
- **Privacy:** no per-recipient lookups to any server, no trackers, no remote fonts or CDNs.
- **Secrets:** testnet keys only, in git-ignored `.env`; `.env.example` holds names only. Every `VITE_*` value is public.
- **Contracts:** no changes to v1, V2 or the module guard and their tests. No code from the pre-event Pramaan repo.
- **Do not edit** `AGENTS.md`, `docs/INTERFACES.md` or `docs/planning/`.
- **H9 labels are human work.** AI labels are not human precision.

## How to contribute

```bash
git fetch origin
git switch -c docs/your-change origin/main
corepack pnpm@10.34.9 install --frozen-lockfile
corepack pnpm@10.34.9 -r test
corepack pnpm@10.34.9 -r build
cd contracts && npm install --legacy-peer-deps && npx hardhat test
```

- Never commit to `main` and never force-push. Use a branch and a PR with Conventional Commits. Merge after the PR's build checks pass and delete the branch.
- Commit a lockfile update whenever a `package.json` changes: Pages installs with `--frozen-lockfile`.
- For UI changes, open the page and look at it.
- After changing any state above, update your own row in `docs/PROGRESS.md` and this file in the same PR.

## Known behaviour that looks like a bug

- Pay's Nox route takes 25–40 s to start on the hosted site. **Skip: read directly (not anonymous)** loads the Safe in a few seconds.
- The public Arkiv endpoint is rate-limited. A second explorer load within a minute can sit at "reading Arkiv…"; wait or reload.
- Etherscan shows the Guard's verified source; Blockscout also decodes the `LookalikeOfApprovedPayee` revert reason on the L payment.

## B4 governance guard follow-up

Codex 2 added a separately deployed HexFenceGovernanceGuardV2; [installation scope, separate state, tests and public receipts](../contracts/README_GOVERNANCE.md). No live Safe was switched and Pay remains pinned to original V2. Only Safes selecting the new guard receive its three governance checks. B3 stays cut; B5 is not reimplemented. Source match 58635387 is for this new contract, leaving original V2 unchanged.
