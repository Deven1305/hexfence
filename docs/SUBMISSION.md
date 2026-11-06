# Submission copy and human checklist

HexFence is an account-level resemblance rule for Safe payments, with openly readable suspected address-poisoning patterns and local recipient comparisons. The v1 Guard refuses a different address sharing the first four and last four hex characters of an approved payee; new fingerprints remain usable. A separate opt-in V2 records recipients after successful recognized execution. Neither Guard depends on an evidence service.

Repository: https://github.com/Deven1305/hexfence. [Live apps](https://deven1305.github.io/hexfence/), [requirements and gaps](JUDGE_READINESS.md), [3:00 video script and Q&A](DEMO.md). No final uploaded video URL has been provided.

## Selected partners

| Entry | Concrete integration | Remaining qualification gaps |
|---|---|---|
| Arkiv: Build on Arkiv, from scratch | Rabdi SDK writes and visible bulk reads of 173 unique suspected records, observed 6 Nov. Publisher, runnable query, schema, costs and four criterion documents are in [README](../README.md#arkiv-publisher--query) and [arkiv](../arkiv/how-you-use-arkiv.md). | Human event provenance; no measured external adoption; team has not confirmed post-Mumbai maintenance. The release-record prototype is separate and not a proved live write. |
| Ethereum Foundation: Best CROPS App | Security leads: a real v1 Guard refusal outside Pay survives removal of the client. MIT source, local comparisons, optional Nox transport and explicit privacy/trust boundaries. [CROPS](../README.md#crops). | Final <=3:00 human-narrated video, human wallet/manual checks, Guard sign-off, Hindi and precision reviews. No separate Anon-RPC prize claim. |
| Chainlink: Best workflow with CRE | Sentinel source and WASM orchestrate Sepolia logs, bulk Guard reads, consumer reporting and optional Telegram. Consumer deployed and Radar reads it. [CHAINLINK](../CHAINLINK.md). | **Not qualified yet:** no successful authenticated CRE simulation/DON run, Telegram receipt or genuine CRE alert displayed. Compile/deployment alone do not satisfy this requirement. |

The full requirement-by-requirement evidence table is [JUDGE_READINESS](JUDGE_READINESS.md). Select at most these three partners in the human submission dashboard. Do not claim CCIP, Arkiv Mirror/Swarm, or features that exist only on a branch.

## Proof available now

- V1: [L reverted](https://sepolia.etherscan.io/tx/0xa43b0eeef7253281a741deca144e5ddf0c465da9cc6f48d54673a9aa9c0f6d8f), [B succeeded](https://sepolia.etherscan.io/tx/0x2455ca8f1ce612149f15e80325f372202bffeb0258f808bd84acfb1f904de5ca), [P succeeded](https://sepolia.etherscan.io/tx/0xea209e9e3c5a9eed080e95dd0ca752b79686400da820ea67b87f98552d2992df). The second [client-off L refusal](https://sepolia.etherscan.io/tx/0xe77e6a7a8ba5b6f9742ec953826bc47c69ffffdced3a4d40b8fe3a220e1bb46f) was a direct script, not Safe{Wallet}. [Live results](T8_LIVE_RESULTS.md).
- V2: separate deployed Guard and new isolated 1-of-1 Safe, learning enabled, successful remove/restore. [Deployment and semantic limits](../contracts/README_V2.md). No live positive-value P/L demonstration: this Safe was unfunded at setup. Real Safe 1.4.1 local tests cover learning/refusal, nested state isolation and failures; 414 actual parity vectors compare shared prechecks.
- Evidence: [fresh public observation](research/arkiv-snapshot-2026-11-06.json): 173 unique records, 147 zero-value, 26 dust, all suspected. A historical scan produced 47,694 suspected pairs; the published subset is neither comprehensive coverage nor an adoption measure.
- Chainlink: [real zero-value trigger log](https://sepolia.etherscan.io/tx/0x7494d97df9468b822e32aa7008e8f336979b584558053457a03ef32e00b9af15); no tokens moved. Radar's actual read returned no alerts. No successful simulation output exists to quote.
- Validation checkpoint: 32 contract tests, 38 shared tests and 63 Pay tests; [full checks/WASM](https://github.com/Deven1305/hexfence/actions/runs/42196239620), [v1 scripted regression and actual-data visual checks](https://github.com/Deven1305/hexfence/actions/runs/42196239447). V1 contract and its 14 tests remain unchanged.

## Human actions before submitting

1. Complete [CRE/Telegram steps](../CHAINLINK.md#exact-human-steps-left). Save only actual output/receipts. Keep the honest incomplete status if authentication or delivery remains blocked.
2. If desired, fund and run the isolated V2 demo using [the supplied steps](../contracts/README_V2.md#sepolia-deployment-and-isolated-setup). This agent did not fund it or execute positive-value live payments.
3. Complete real wallet tests, human Guard review, Hindi review and independent precision review. AI-assigned H9 labels are not human precision; leave their provenance intact. Enter actual reviewer names/results only after completion.
4. Confirm event start/provenance, meaningful human contributions and completeness of every used plan/prompt in the repository. AI assistance is disclosed in [AI_USAGE](AI_USAGE.md). No pre-event Pramaan code was used in this pass.
5. Confirm whether the team will maintain the deployment after Mumbai; current answer is unconfirmed. Confirm public repository access and dependency licenses, including optional CRE SDK BUSL-1.1.
6. Record and upload exactly 3:00 at >=720p with a human voice, without AI narration, footage speed-up or filming a screen with a phone. Use [DEMO](DEMO.md); fill the actual video link in the dashboard and here after upload.
7. Submit through the human dashboard by 7 Nov 09:00 IST; aim for 08:30. Recheck organizer rules and the final deployed build. An agent has not submitted or accepted terms.

Never describe synthetic Sepolia L as real attack evidence. It only resembles the approved payee. Mainnet data status remains suspected. Unknown first use, arbitrary calldata, modules and owner-approved configuration changes remain important limits.
