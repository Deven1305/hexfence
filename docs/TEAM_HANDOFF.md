# Team handoff: read this before working on HexFence

For teammates and their coding agents. Last updated Fri 6 Nov 2026 after the Hindi and copy pass. Check `git log` and open PRs for anything newer.

**Deadline:** submission Sat 7 Nov 2026, 09:00 IST (aim for 08:30). Proposed feature freeze: Fri 22:00 IST, then rebuild the video, record the voiceover and submit. The team has not confirmed the freeze time.

**Read next, in this order:** `AGENTS.md`, `docs/PROGRESS.md` (task table, waiting-on-humans, Decisions log), then the files named in the section you are working on. The locked spec is `docs/planning/10_FINAL_What_To_Build_HexFence.md`.

## What it is

The Detector reads Ethereum mainnet USDT and USDC logs and publishes suspected address-poisoning records to Arkiv (Rabdi testnet). The explorer shows them. HexFence Pay checks a Safe payment against approved payees before signing. `HexFenceGuard` on Sepolia refuses a lookalike of an approved payee on-chain.

| Live page | URL | Needs |
|---|---|---|
| Landing | https://deven1305.github.io/hexfence/ | Nothing |
| Explorer | https://deven1305.github.io/hexfence/explorer/ | Nothing |
| Pay, read-only preview | https://deven1305.github.io/hexfence/pay/?safe=0x3BCc3969713778F3Ed26AE1490529eeBAD43FbD5 | Nothing; cannot sign or send |
| Pay, full flow | https://deven1305.github.io/hexfence/pay/ | Sepolia wallet that owns the Safe |

URLs are case-sensitive: `/Pay/` is a 404. Pages deploys from `main` through `.github/workflows/pages.yml`. If you see the old plain page, hard-refresh.

## Added today (6 Nov), all merged to `main`

Dhruv approved this scope beyond "P2 only if every P1 task is ✔"; see the PROGRESS Decisions log.

| PR | What changed | Where | State |
|---|---|---|---|
| [#22](https://github.com/Deven1305/hexfence/pull/22) | Real landing page; explorer and Pay restyled to match | `apps/site/`, `apps/*/src/style.css`, `apps/*/index.html` | Live and checked in a browser |
| [#23](https://github.com/Deven1305/hexfence/pull/23) | Explorer loads every record, adds data views, and searches or checks addresses in the browser | `apps/explorer/src/main.ts`, `dashboard.ts` | Live and checked in a browser |
| [#23](https://github.com/Deven1305/hexfence/pull/23) | Scheduled publisher, every 6 hours, capped at 10 new records per run by default | `.github/workflows/publish-evidence.yml`, `docs/LIVE_EVIDENCE.md` | **Writes nothing until the secret is added**; never run with a key |
| [#21](https://github.com/Deven1305/hexfence/pull/21) | Pay read-only preview without a wallet | `apps/pay/src/main.ts`, `safe.ts` | Live; L gives RED and P gives GREEN on the hosted site |
| [#21](https://github.com/Deven1305/hexfence/pull/21) | Pay owner setup: enable or disable the Guard, approve or remove payees, warnings first | `apps/pay/src/setup.ts`, `setup.css` | **Unit-tested only; no real wallet has used it** |
| [#24](https://github.com/Deven1305/hexfence/pull/24) | Chrome extension for `app.safe.global` | `apps/extension/`, `TESTING.md` | **Go/no-go still open: not tested on Safe{Wallet}** |

Tests on the combined code before the final merge: contracts 14 passing; workspace 169 passing and 4 skipped (shared 32, arkiv 12, extension 22, detector 19, pay 48, explorer 36); recursive build passes.

## Open work

| Who | Item | Blocks |
|---|---|---|
| Dhruv | Extension go/no-go: MetaMask on `app.safe.global`, following `apps/extension/TESTING.md` | Claiming the extension works (T14) |
| Dhruv or a teammate | Try Pay setup with a real wallet on an **isolated** Sepolia Safe, not the demo Safe | Claiming setup works |
| Dhruv | H6 human wallet test on the demo Safe; the T8 wallet was scripted | T6 |
| A human, not an AI | H9: hand-label `apps/detector/labels/h9-sample.csv` on Etherscan | `‹PRECISION›`, T13 |
| A native speaker | H10: check the Hindi (`docs/H10_HINDI_CHECK.md`) | T12 |
| A team member | Review the Guard and be named as `‹GUARD_REVIEWER›` | Submission text, `docs/AI_USAGE.md` |
| Repo admin (Deven) | Add secret `ARKIV_PRIVATE_KEY`, testnet publisher key only. Dhruv's account has no admin rights | Scheduled publisher |
| Repo admin (Deven) | Turn on Settings → General → "Automatically delete head branches". Dhruv's attempt returned 404 for the same reason | Merged branches pile up |
| Dhruv | Write the post-Mumbai sentence at `arkiv/reach.md:38` | Arkiv answers |
| Team | Rebuild the video after freeze, add voiceover, upload | `‹VIDEO_URL›`, T14 row in the video if the extension passes |
| Team | Choose the submission option and submit by 08:30 | Everything |

### Decisions still open

1. **Hindi wording.** Dhruv felt the current verdict text sounds unnatural. Changing it needs `apps/pay/src/verdictCopy.ts`, the Hindi tests in `apps/pay/test/pay.test.ts`, and a logged spec deviation.
2. **Languages.** The हिन्दी button translates the Pay page and every verdict; technical errors and the setup warnings stay in English. Landing and explorer have no language button. Marathi is not built (P2 in the spec). All Hindi still needs the native check in H10.
3. **Video.** The existing silent cut predates today's UI, so its footage no longer matches the site.

## Funds and addresses

Balances read from Rabdi on 6 Nov: publisher `0x36141ba063390f0d91Af7a5a9dF8dc1d80D699ec` holds 0.0535 tGLM after publishing 173 records (125 at T8 plus 48 spread across the scan, from a detector run of 47,694); Dhruv's wallet `0x0f7e6EAdB11d0780ba1F24f30B5B5859DaFd2803` holds 9.90 tGLM. **Do not move tGLM without Dhruv's explicit approval.** All other public addresses and hashes are in `docs/PROGRESS.md` and `docs/SUBMISSION.md`.

## Rules that are easy to break

- **Honesty:** nothing fake or hard-coded. Evidence status is always "suspected". The synthetic Sepolia lookalike only ever gets "resembles your approved payee". Do not claim the extension or the setup panel works until the checks above pass. Do not claim universal protection.
- **Public pages lead with what the product does.** Dhruv's decision on 6 Nov: no lists of limits on the landing page or in the apps. Limits live in `README.md` and are answered honestly when asked. Every sentence on a page must still be true, and warnings a user needs before signing stay.
- **UI copy:** no "safe" as an adjective, and no "verified", "scam" or "malicious" (Safe the product, "Verify on Ethereum" and "cannot verify" are fine).
- **Privacy:** no per-recipient lookups to any server, no trackers, no remote fonts or CDNs. The explorer's address checks must stay on downloaded records.
- **Secrets:** testnet keys only, in git-ignored `.env`; `.env.example` holds names only. Never print or commit a key. Every `VITE_*` value is public.
- **Contracts:** no Guard behaviour changes. Do not use code from the pre-event Pramaan repo.
- **Do not edit** `AGENTS.md`, `docs/INTERFACES.md` or `docs/planning/`.
- **H9 labels are human work.** No AI may fill them.
- **Agents in this repo:** one agent per session, no subagents (`CLAUDE.md`).

## How to contribute

Lane ownership is lifted for this pass, so ignore the "edit only your lane" part of `AGENTS.md` and `docs/PARALLEL_PLAN.md`. Coordinate through open PRs instead: run `gh pr list` first and avoid files another open PR is changing.

```bash
git fetch origin
git switch -c feat/your-change origin/main
corepack pnpm@10.34.9 install
```

Before opening a PR, run all three:

```bash
corepack pnpm@10.34.9 -r test
corepack pnpm@10.34.9 -r build
```

```bash
cd contracts && npm install --legacy-peer-deps && npx hardhat test
```

- Never commit to `main` and never force-push. Use a `feat/`, `fix/` or `docs/` branch and a PR.
- Commit a lockfile update whenever a `package.json` changes: Pages installs with `--frozen-lockfile` and fails otherwise.
- For UI changes, open the page and look at it. Run the build with the public variables from `gh variable list`, or the explorer reports that `VITE_ARKIV_PUBLISHER` is unset.
- After changing any state above, update `docs/PROGRESS.md` and this file in the same PR.

## Known behaviour that looks like a bug

- Pay's Nox route took 26–38 s to start in hosted runs and timed out at 60 s during a network outage. **Skip: read directly (not anonymous)** loaded the Safe in about 4 s. These are single observations, not benchmarks.
- `/hexfence/explorer/` logs one 404 in the console; probably the favicon, not confirmed.
- Blockscout decodes the revert reason because the Guard is verified there. It is not verified on Etherscan, so do not use Etherscan to show the reason.

## Codex 2 upgrade handoff, 6 Nov

Merged sequentially: Sentinel #29, Auto-Fence #32, Pay Radar/V2 #35. V1 and its 14 tests remain unchanged. [Judge readiness](JUDGE_READINESS.md), [Chainlink](../CHAINLINK.md), [V2](../contracts/README_V2.md) and [submission](SUBMISSION.md) contain exact proofs and human steps. CRE login/simulation/Telegram and funded V2 positive payments remain incomplete; never invent SIMULATION.md output. Actual Radar reads are empty. Readiness is tied to a main checkpoint, not another agent's feature branch. B7's oversized str manifest is the first optional follow-up; no live release record is proved.
