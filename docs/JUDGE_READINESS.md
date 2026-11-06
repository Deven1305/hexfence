# Judge readiness: evidence and gaps

Checked **6 Nov 2026** against main **59201da**, after [Sentinel #29](https://github.com/Deven1305/hexfence/pull/29), [Auto-Fence #32](https://github.com/Deven1305/hexfence/pull/32) and [Pay wiring #35](https://github.com/Deven1305/hexfence/pull/35). This report describes merged code and recorded observations, not planned features. Later additions need their own evidence.

Sources: the user-provided `prizes.txt` and `details.txt`, checked against the [official prize page](https://ethglobal.com/events/mumbai/prizes) and [submission rules](https://ethglobal.com/events/mumbai/details). Chosen partners: **Arkiv / EF CROPS / Chainlink CRE**. No Swarm, CCIP, separate Anon-RPC prize or other sponsor integration is claimed. Final eligibility is the organizers' decision.

## Requirement-by-requirement assessment

### General rules

| Requirement | Assessment | Evidence / remaining action |
|---|---|---|
| Classic-track project starts at the event; distinguish reused material | Human confirmation remains | [AI usage/provenance](AI_USAGE.md), [reference Guard record](../contracts/README.md), [incremental history](https://github.com/Deven1305/hexfence/commits/main). Team must confirm event provenance and no pre-event project code. |
| Incremental version history | Present | Feature PRs preserve commits; no direct-to-main feature commits in this pass. |
| Public source and a reproducible run path | Present | [MIT license](../LICENSE), [README](../README.md), locked dependencies, [full checks](https://github.com/Deven1305/hexfence/actions/runs/42196239620). Dependencies retain their own licenses. |
| Disclose AI assistance and meaningful human participation | Partial | [AI_USAGE](AI_USAGE.md) names generated code and workflows. Human product decisions/funding are recorded; human Guard sign-off is still absent. Do not describe AI review as human review. |
| Include directed-development plans/prompts | Human check required | [Planning directory](planning/) must contain every used artifact. The external upgrade plan/prompts need a human completeness check; this agent is forbidden from editing that directory. |
| Video format and submission | Gap | [3:00 script](DEMO.md) exists; no uploaded final video URL. Record at least 720p with a human voice, without speeding footage or AI narration. Aim to submit by 08:30 IST, before the 09:00 IST 7 Nov deadline. |
| Select at most three partners in the dashboard | Human action | Select Arkiv, EF and Chainlink only if the corresponding materials are truthful. No dashboard submission has been made by this agent. |

### Arkiv: Build on Arkiv (from scratch)

| Requirement | Assessment | Evidence / remaining action |
|---|---|---|
| New event build, subject to general rules | Human provenance confirmation | General table above; no pre-event Pramaan code used in this pass. |
| Current testnet writes with SDK/API, plus a visible read feature | Met for poisoning records | [Writer](../packages/arkiv/src/write.ts), [publications](T8_LIVE_RESULTS.md), [live explorer](https://deven1305.github.io/hexfence/explorer/), [Pay bulk reader](../apps/pay/src/evidence.ts). Rabdi chain 7794095. |
| README names the writer wallet and provides a query | Met | [README query](../README.md#arkiv-publisher--query), [query.ts](../arkiv/query.ts). Publisher `0x36141ba063390f0d91Af7a5a9dF8dc1d80D699ec`. |
| Schema documents queried fields, authority and retention | Met for current evidence; release prototype has a gap | [schema](../arkiv/schema.md). Evidence expires after 30 days. `hexfence.release.v1` is code-only; its current full-manifest `str` field exceeds Arkiv's 128-byte limit. No live release record is claimed. |
| Feedback criterion file | Present, grounded | [friction](../arkiv/friction.md): pagination assumptions, funding errors, actual cost observations and the reproduced 129-byte `str` rejection. |
| Reach criterion file | Present; adoption gap | [reach](../arkiv/reach.md). No measured external users/pilots. Continued team maintenance after Mumbai is unconfirmed. Data volume is not adoption. |
| Why-Arkiv criterion file | Present | [why-arkiv](../arkiv/why-arkiv.md): wallet attribution/shared access/expiry versus operating a separate API, plus explicit off-Arkiv choices. |
| How-use criterion file | Present | [feature mapping](../arkiv/how-you-use-arkiv.md). Distinguishes indexed capabilities from filters actually used and code-only schemas from live data. |
| Public license and AI disclosure | Present, with general human-participation caveat | [LICENSE](../LICENSE), [AI_USAGE](AI_USAGE.md). |
| Real reads, not merely an installed SDK or unread log | Met | Fresh read-only query at 09:47:52 UTC returned **173 unique records**, 147 zero-value + 26 dust, all `suspected`: [machine-readable observation](research/arkiv-snapshot-2026-11-06.json). No new writes or funds moved. |
| One Arkiv track award per team | Entry plan matches | Select Build on Arkiv; do not represent this as Mirror, Node Tooling or Swarm work. |

Arkiv's core integration is evidenced. The strongest remaining weaknesses are general event/human-provenance confirmation, no external adoption measure and no team-confirmed maintenance plan. The release-record issue does not invalidate the existing poisoning dataset; it prevents claiming that release publication works.

### Ethereum Foundation: Best CROPS App

| Requirement | Assessment | Evidence / remaining action |
|---|---|---|
| Public free/open project source and run instructions | Present | [MIT](../LICENSE), [run steps](../README.md#run-steps). Third-party licenses are disclosed; the optional CRE SDK is BUSL-1.1. |
| README section named CROPS with concise C/O/P/S answers | Present in this update | [CROPS](../README.md#crops), with detailed privacy/trust disclosures separately. Security is the lead property. |
| A video no longer than three minutes showing the lead property at the decisive moment | Gap | [DEMO](DEMO.md) specifies exactly 3:00 and the client-off v1 receipt. An actual final recorded/uploaded video remains human work. |
| No client trackers; keys/data stay local or exposure is explained | Source checks support this; boundaries disclosed | Self-hosted UI/fonts, [RPC routing](../apps/pay/src/rpc.ts), [Nox selection](../apps/pay/src/anon.ts), [privacy table](../README.md#privacy-and-trust). Public-chain, RPC, resolver, wallet and optional Telegram visibility are not hidden. |
| One structural lead property without concealing tradeoffs | Demonstrated for v1; V2 local proof plus live setup | [direct-script L revert outside Pay](https://sepolia.etherscan.io/tx/0xe77e6a7a8ba5b6f9742ec953826bc47c69ffffdced3a4d40b8fe3a220e1bb46f), [v1 tests](../contracts/test/guard.test.js), [V2 real Safe tests](../contracts/test/guard-v2.test.js). Neither Guard reads Arkiv or Sentinel. |
| One EF award per project | Entry plan matches | Lead with CROPS. Nox is a privacy component, not a claim of separately completing the Anon-RPC prize. |

Human wallet testing, Hindi review, Guard sign-off and precision review are still gaps. The recorded scripted transactions are real, but do not tick H6 or establish Safe{Wallet} UI behavior. V2's deployed Safe is unfunded: no positive-value Sepolia P/L demo has run. Its positive-value learning/refusal behavior is tested on a local EVM using real Safe 1.4.1 contracts.

### Chainlink: Best workflow with CRE

| Requirement | Assessment | Evidence / remaining action |
|---|---|---|
| CRE orchestrates a project stage | Source/build present; runtime pending | [workflow](../sentinel/hexfence-sentinel/main.ts), [WASM CI](https://github.com/Deven1305/hexfence/actions/runs/42188654422), [CHAINLINK](../CHAINLINK.md). |
| Blockchain plus an external API/system/data source | Implemented, not demonstrated end to end | Sepolia triggers/reads/report write and Telegram HTTP code exist. Bot token/chat and an actual API notification are missing. Telegram is disabled in the sample config. |
| Successful CRE CLI simulation or live CRE deployment | **Not met** | CLI 1.39.0 init/simulation attempts stop at authentication. A WASM compile and a deployed mock-forwarder consumer are not substitutes. `sentinel/SIMULATION.md` has no fabricated output. |
| Meaningful use in the project | Wired; live alert gap | [Pay Radar](../apps/pay/src/radar.ts) reads the actual deployed consumer. [Browser proof](https://github.com/Deven1305/hexfence/actions/runs/42196239447) returned an empty list in all four layouts. Need a genuine CRE report, notification and displayed alert. |

**Chainlink is not ready to be described as qualified.** Follow the exact [human run steps](../CHAINLINK.md#exact-human-steps-left); only actual output/receipts can close the gap. CCIP's state-change requirement belongs to its separate track; no CCIP claim is made.

## Current implementation versus the upgrade plan

| Item | What exists on checked main | Gap / scope |
|---|---|---|
| V1 demo | Preserved contract and 14 tests; real P/B successes, two L reverts and removal receipts | Scripted wallet; H6 remains human-only |
| Auto-Fence | New contract, 14 real Safe tests, 414 actual parity vectors, deployed V2 and isolated Safe, successful live removal/restoration | No funded positive-value Sepolia P/L demonstration; no external audit |
| Sentinel | Source, four classifier tests, four consumer tests, WASM build, deployed consumer, real zero-value trigger receipt | CRE login/simulation and Telegram receipt missing; simulation forwarder permits untrusted reports |
| Pay upgrade | V2 snapshots/verdicts, recorded-execution dates, advisory Radar and same-client bulk reads | Actual consumer has no CRE-produced alert; new V2 text is English pending native review |
| A3 UI / Safe App | Merged #28 / #31; production visual checks | Safe{Wallet} host manual test remains distinct from unit/browser tests |
| A4 Rescue / B2 campaigns | Not in checked main | Do not claim loss totals, Rescue packs or campaign metrics from a branch or plan |
| B7 attested client | Main workflow attests published files; downloaded Pay index matched its 5,601-byte manifest | Local `gh attestation verify` failed to initialize a Sigstore verifier. Arkiv release `str` size issue and no proved live release publication remain |
| B3 / B5 / B4 | Not in checked main | Batch, module and governance protection are follow-up work, not primary Guard claims |

## Claim controls and exact human work

- Real mainnet records remain **suspected**. Synthetic Sepolia L only resembles the approved/recorded payee; do not call it evidence or label its controller.
- Leave global loss statistics, wallet-warning coverage ratios and the plan's loss totals out unless separately verified. They are unnecessary to demonstrate the core rule.
- Do not use H9's AI-assigned labels as human precision. Do not edit those labels in this pass. A human must review them, and separately review Hindi and the Guard.
- Keep the v1 demo path. Use the actual source-linked receipts; never relabel direct-script execution as Safe{Wallet}.
- Human CRE login, Telegram setup and the exact real-trigger command: [CHAINLINK](../CHAINLINK.md#exact-human-steps-left).
- Human V2 funding/payment command and public isolated Safe: [README_V2](../contracts/README_V2.md#sepolia-deployment-and-isolated-setup). No new fund transfers are authorized to the agent.
- Human completeness check of plans/prompts, meaningful contribution descriptions and reviewer names; [submission checklist](SUBMISSION.md).
- Record/upload the [3:00 human-narrated video](DEMO.md), then fill the real video link and submit through the human dashboard. Do not claim all partner requirements are met while these gaps remain.


## Main update during review

Before opening this PR, main advanced to **5c60874**, merging [A4 #36](https://github.com/Deven1305/hexfence/pull/36). The earlier table is a timestamped checkpoint, not a claim that A4 remains absent. [loss-run.json](../apps/explorer/public/loss-run.json) records a completed bulk-log scan and call-shape review: one supported suspected payment, 303.635007 USDT, USDC zero, 239 raw candidate transactions. Raw automated movements are excluded from the supported headline. Five initial raw records were withdrawn; the final supported record was published and a repeat wrote zero transactions. See the manifest's real publication/retraction receipts and [loss schema](../arkiv/schema.md). Amounts are not confirmed losses, a USD conversion or established causation. This agent did not perform those writes. A4's own browser proof and limitations belong to its merged PR. B2 campaigns remain absent at this checkpoint.

## B7 follow-up

The manifest representation is corrected to bytes with preflight digest/size/path validation and conflict rejection. The historical Pay index's GitHub provenance was successfully checked with strict workflow/ref/commit/runner policy after selecting a writable Sigstore cache. [Actual result and exact commands](ATTESTATIONS.md), [verification JSON](research/pay-provenance-59201da.json). This closes the earlier local-verifier gap and the code's str-size bug; it does not close the live Arkiv release-publication gap. The inspected CI job explicitly skipped for a missing publisher secret. No tGLM write or secret configuration was performed by this agent.
