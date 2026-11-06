# Judge readiness: evidence and gaps

Checked **6 Nov 2026** against main **8c3c175** (after PRs #34, #36, #38, #39, #40, #41, #42). It describes merged code and recorded observations only. Sources: the [official prize page](https://ethglobal.com/events/mumbai/prizes) and [submission rules](https://ethglobal.com/events/mumbai/details). Chosen partners: **Arkiv, EF CROPS, Chainlink CRE**. Final eligibility is the organisers' decision.

## General rules

| Requirement | State | Evidence / what is left |
|---|---|---|
| Built at the event; reused material named | Team confirms | [AI usage](AI_USAGE.md), [reference Guard record](../contracts/README.md), [commit history](https://github.com/Deven1305/hexfence/commits/main). No pre-event Pramaan code. |
| Incremental version history | Met | Small commits through PRs. |
| Public source and run steps | Met | [MIT licence](../LICENSE), [README run steps](../README.md#run-steps), locked dependencies. |
| AI disclosure and meaningful human contribution | Partial | [AI_USAGE](AI_USAGE.md) lists what AI wrote. Human Guard sign-off, H6, H9 and H10 are still open. An AI review is not a human review. |
| Spec files, prompts and plans in the repo | Team checks | [docs/planning/](planning/) and `docs/planning/agent-reports/`. A person must confirm nothing used is missing. |
| Video 2–4 min, ≥720p, human voice | Open | [3:00 script](DEMO.md). No uploaded video yet. |
| At most three partner prizes | Human action | Arkiv, EF, Chainlink, and Chainlink only if real CRE output exists. |

## Arkiv: Build on Arkiv (from scratch)

| Requirement | State | Evidence |
|---|---|---|
| Writes to the Arkiv testnet with the SDK | Met | [Writer](../packages/arkiv/src/write.ts). 1,126 `hexfence.poisoning.v1` records and 1 `hexfence.loss.v1` record by publisher `0x36141ba063390f0d91Af7a5a9dF8dc1d80D699ec`, Rabdi chain 7794095. Re-runs write 0. |
| A user-visible feature reads it | Met | [Live explorer](https://deven1305.github.io/hexfence/explorer/) loads 1126 of 1126 (checked 6 Nov); Losses and Campaigns tabs; Pay's bulk evidence read. |
| README names the publisher and gives a query | Met | [README query](../README.md#arkiv-publisher--query), [query.ts](../arkiv/query.ts). |
| schema, friction, reach, why-arkiv, how-you-use-arkiv | Present | [arkiv/](../arkiv/). Reach: no measured external users; post-Mumbai plan unconfirmed. |
| Licence and AI statement | Present | [LICENSE](../LICENSE), [AI_USAGE](AI_USAGE.md). |
| Multi-publisher reading (C3) | Code only | The explorer can read extra publishers from `VITE_ARKIV_EXTRA_PUBLISHERS`, but **no second publisher with records exists and `pages.yml` does not pass the variable**. The live explorer reads one publisher. |
| Release records (B7) | Not live | Code and tests only; no release record on Arkiv. |

Data note: the 1,126 records are a chosen subset of two 24-hour detector runs (47,694 and 58,739 pairs). 125 of them come from one attack block (26352743), so the Campaigns hourly chart is about publication, not attack rate (fix in PR `fix/campaign-timeline`).

## Ethereum Foundation: Best CROPS App

| Requirement | State | Evidence |
|---|---|---|
| Open source and run steps | Met | MIT; the optional CRE SDK is BUSL-1.1 and named as such. |
| README CROPS section, 1–2 lines per letter | Present | [README CROPS](../README.md#crops). Security leads. |
| ≤3:00 video showing the lead property | Open | [DEMO](DEMO.md). The decisive moment is the v1 L revert with Pay out of the path. |
| No trackers; keys and data protected | Met in source | Self-hosted UI and fonts, [Nox routing](../apps/pay/src/anon.ts), [privacy table](../README.md#privacy-and-trust). |
| Lead property shown for real | Met for v1 | [L revert](https://sepolia.etherscan.io/tx/0xa43b0eeef7253281a741deca144e5ddf0c465da9cc6f48d54673a9aa9c0f6d8f) and [direct-script L revert outside Pay](https://sepolia.etherscan.io/tx/0xe77e6a7a8ba5b6f9742ec953826bc47c69ffffdced3a4d40b8fe3a220e1bb46f). Both were sent by script, not by a person. |
| One EF prize per project | Plan matches | Enter Best CROPS App only. Nox is a component, not a separate Anon-RPC entry. |

## Chainlink: Best workflow with CRE

| Requirement | State | Evidence |
|---|---|---|
| CRE runs a stage of the project | Source and build only | [workflow](../sentinel/hexfence-sentinel/main.ts), WASM build in CI, [CHAINLINK.md](../CHAINLINK.md). |
| Blockchain plus an external API | Code only | Sepolia log triggers and reads, report write, Telegram HTTP call. Telegram is disabled; no bot token. |
| Successful CRE simulation or deployment | **Not met** | `sentinel/SIMULATION.md` does not exist. The CRE CLI is not installed on this laptop and no one has run `cre login`. |
| Used in the product | Wired, empty | Pay Radar reads consumer 0x97F6…D80F and shows "Sentinel simulation: no alerts returned for this Safe" (live, 6 Nov). |

**Do not claim the Chainlink prize until real CRE output is saved in `sentinel/SIMULATION.md`.** Steps: [CHAINLINK.md](../CHAINLINK.md#exact-human-steps-left).

## Every feature on main, and what it does not prove

| Item | On main | Not proven |
|---|---|---|
| v1 Guard | 14 tests; Etherscan and Sourcify verified; live L revert, B/P success, removal drill | No person-run wallet payment (H6) |
| A1 V2 Guard | Deployed, isolated Safe, removal/restore receipts, local Safe 1.4.1 tests, [scripted P](https://sepolia.etherscan.io/tx/0xfc93f06334211546d1371ed3b2b5fbafc77842a03e227f7197a2e50680d866a5) and [refused L](https://sepolia.etherscan.io/tx/0x2585f5ce7bce79a6c139d19f56e4f125f8c84a7c09fe59d27d2598eb83c328ff) on Sepolia | No human wallet run on V2 |
| A2 Sentinel | Source, WASM, consumer, real zero-value trigger tx | No CRE run, no Telegram, no alert |
| A4 Rescue | One supported suspected follow-up payment, 303.635007 USDT, on Arkiv; downloadable pack | A lead, not a confirmed loss or cause |
| B2 Campaigns | Grouping, real block-time hourly chart, match model | Counts describe published records only |
| B5 Module guard | Safe 1.5.0 module guard, 8 tests, deployed 0xa7Dc…546B | **No live Safe uses it; no live module payment** |
| B6 Explain layer | ERC-7730 panel in Pay; verdict unchanged | Pasted descriptors only; no registry |
| B7 Attestation | Build attestations and `SHA256SUMS.txt` | No Arkiv release record |
| B8 Safe App | Pay runs in Safe{Wallet} through the SDK, tested with a stand-in parent | **Not tested by a person in Safe{Wallet}** |
| C1 Check SDK and MCP | `@hexfence/check`, `@hexfence/mcp` with `hexfence_check` | Offline comparison only |
| C3 Multi-publisher | Explorer agreement counts | One publisher live |
| T14 Extension | Builds, unit tests | Not tested on app.safe.global |
| Not built | B3 batch protection was cut; C2 and C4 were scrapped; B1 needs approval to spend tGLM | |

## Claim rules for the submission

- Mainnet records are **suspected**. The synthetic Sepolia L only **resembles your approved payee**.
- No loss totals beyond the one supported suspected case; no wallet-warning coverage ratios.
- AI-assigned H9 labels are not human precision.
- Never describe a scripted payment as a Safe{Wallet} or human test.
- Human work left: H6, H9, H10, Guard sign-off, CRE login and run, T14, B8, video, submission.

## B4 governance follow-up

[PR #47](https://github.com/Deven1305/hexfence/pull/47) adds the separately deployed HexFenceGovernanceGuardV2 at 0x108ea016F84d9817364b65Df6A133afe9CA33855, exact Sourcify match 58635387. It refuses lookalike new owner/module addresses in three specified self-calls, while leaving setGuard unchecked. [Scope, receipts and limits](../contracts/README_GOVERNANCE.md). Only Safes that install this new transaction guard get these checks; no live Safe was switched and Pay remains pinned to original V2. Local contract tests: 68 passing; full workspace checks and the v1 browser regression passed in CI. No live governance operation is claimed.
