# Three-minute demo and hard Q&A

Use a human narrator, >=720p, normal-speed footage and exactly 3:00 to fit EF's maximum and the event's video window. Record real application/terminal/receipt views. No AI narration, simulated notification, edited receipt or fabricated successful CLI output. [Requirement evidence](JUDGE_READINESS.md) is the submission source of truth.

## Timed script: actual checked-main state

| Time | Screen and action | Narration |
|---|---|---|
| 0:00–0:15 | Pay address comparison beside the v1 Guard source | “Address poisoning puts a lookalike in transaction history. HexFence compares locally, and a configured Safe Guard refuses a different address sharing an approved payee's first four and last four hex characters.” |
| 0:15–0:40 | Live explorer, suspected badge, one record's two actual Ethereum receipts; public query count | “Our Rabdi publication has 173 suspected records: 147 zero-value and 26 dust. They are a deliberate subset of a mainnet scan, not confirmed intent or user adoption. Anyone can bulk-read the same publisher and inspect both transfers.” |
| 0:40–1:05 | Sentinel source, successful WASM CI, actual zero-value Sepolia log, actual empty Radar | “Sentinel's CRE workflow connects token logs, bulk Guard reads, report writing and optional Telegram. The consumer is deployed and Pay reads it. CRE login is still a human step: this build has no successful simulation or delivered Telegram alert yet.” |
| 1:05–1:50 | Preserve v1 flow: synthetic L comparison, six-character friction, historical L revert and B/P success receipts | “This synthetic address only resembles our approved payee. The client warns before signing. The real recorded L transaction reverted, while the new supplier B and approved P succeeded. These transactions used a scripted wallet; they are not a Safe{Wallet} manual test.” |
| 1:50–2:20 | Local real Safe 1.4.1 V2 tests learn P/refuse L, then deployed isolated Safe and remove/restore receipts | “V2 is a separate contract. Opt-in learning records successful recognized execution and refuses a later lookalike. Local real Safe tests cover success, failure and nested calls. The deployed new 1-of-1 Safe is configured but unfunded: no positive-value live V2 payment has been run.” |
| 2:20–2:40 | Open client-off v1 receipt, then actual removal/restoration receipts | “With Pay out of the path, a direct Safe script still hit the Guard's rule. Owners can remove the Guard through a Safe transaction, as these recovery receipts show. That also means owner authority and module bypass remain part of the trust model.” |
| 2:40–3:00 | README CROPS and limits | “Security is our lead CROPS property: an account rule independent of evidence availability. Source is public, comparisons are local, and RPC visibility is disclosed. First use can be wrong; arbitrary call semantics and modules are outside this Guard's coverage. This is a testnet prototype, not an audit.” |

Only after a successful human CRE run, replace 0:40–1:05 with actual CLI output, consumer report receipt, opted-in Telegram delivery and the resulting Radar alert. Say precisely whether it is a CLI simulation or DON deployment. Do not keep “no simulation” narration after closing the gap; do not claim the gap closed from a compile or forged mock-forwarder report. Only after the human-funded V2 run, replace its local-only sentence with the actual P-success/L-revert receipts. Keep the v1 proof path.

## Proof links and run preparation

- V1 Safe [0x3BCc…FbD5](https://sepolia.etherscan.io/address/0x3BCc3969713778F3Ed26AE1490529eeBAD43FbD5), Guard [0xA061…9748](https://sepolia.etherscan.io/address/0xA061fB511D69e5c92E50E3BE5c789472d6f19748). Approved P `0x4E185e251Ac7fB83E9DE10723EAda46cadE74120`; synthetic L `0x4E185a3FC4B530244aB9ed0dE38167b403344120`; B `0xcB0a33f755826307CcaC3f4b4833e7e19d38cEb6`.
- V1 [L revert](https://sepolia.etherscan.io/tx/0xa43b0eeef7253281a741deca144e5ddf0c465da9cc6f48d54673a9aa9c0f6d8f), [B success](https://sepolia.etherscan.io/tx/0x2455ca8f1ce612149f15e80325f372202bffeb0258f808bd84acfb1f904de5ca), [P success](https://sepolia.etherscan.io/tx/0xea209e9e3c5a9eed080e95dd0ca752b79686400da820ea67b87f98552d2992df), [direct-script L refusal](https://sepolia.etherscan.io/tx/0xe77e6a7a8ba5b6f9742ec953826bc47c69ffffdced3a4d40b8fe3a220e1bb46f).
- V1 [remove](https://sepolia.etherscan.io/tx/0x5edf08eb6489d78c13f0748283e43bab8c015c851d0d40e86b030dd6794ad8e0), [restore](https://sepolia.etherscan.io/tx/0xd1c7db48a18647713c34384afc51b116888546dd837359eecad0938a5ebe9743).
- [V2 deployment/setup and human demo steps](../contracts/README_V2.md), [Sentinel exact human commands](../CHAINLINK.md#exact-human-steps-left), [actual Arkiv query observation](research/arkiv-snapshot-2026-11-06.json), [historic live results](T8_LIVE_RESULTS.md).
- Open the real v1 preview with P, L and B; prepare receipts and local test output in tabs before recording. Preserve their scripted/local/historical labels. Do not initiate new payments merely to record this script without the appropriate human authorization.

## Hard judge questions

| Question | Answer grounded in this build |
|---|---|
| Isn't this an allowlist? | V1 allows a previously unknown fingerprint. It refuses a different address colliding with an approved fingerprint. V2 adds opt-in first-use recording; unknown fingerprints still pass. |
| What about a 5+5 match, or 3+3? | A 5+5 match necessarily shares the 4+4 fingerprint and is refused when the holder differs. A 3+3-only match is outside the rule. No full-address authenticity guarantee follows. |
| What if the first payment is wrong? | V2 can record the wrong address. It is trust on first use, not independent identity proof. Evidence can warn; it does not change Guard enforcement. Sentinel has not yet produced a demonstrated report in this checkpoint. |
| Wallets already warn. What's new here? | The combination is an account-level rule, optional recorded history, shared expiring evidence and local comparison. We make no first-ever claim and no unsupported wallet-warning coverage ratio. |
| Why Arkiv instead of Postgres? | Static clients share wallet-attributed records with network expiry without our own data API. Postgres could implement an API too; it introduces an operator dependency. Arkiv RPC and publisher trust remain dependencies. |
| What if Chainlink or Arkiv goes down? | Both Guards enforce entirely from their own storage. Evidence/Radar may become unavailable; the client labels that state. The CRE workflow still needs an authenticated successful run. |
| False positives? | Uniform independent addresses collide on 4+4 with probability 2^-32 per pair; more holders increase aggregate chance and adversarial addresses are intentionally ground. A collision is resemblance, not intent. V2 approve/forget and owner recovery are explicit correction powers. |
| What's the gas overhead? | Local Safe 1.4.1 prevalidated ETH measurements were 182,927 gas for a new V2 recipient and 72,839 for a repeat. These are whole Safe calls under stated conditions, not a universal quote or only two storage writes. |
| Who pays, and who uses it? | DAO treasuries and accounts-payable tooling are intended users. There are no proved paying users, pilots or external usage measurements. The team has not confirmed post-Mumbai maintenance. |
| Why is this different from MetaMask/Safe? | An account Guard adds an enforceable narrow rule independent of the current client. We do not claim those products lack warnings. Rescue/campaign features cannot be claimed until merged and evidenced. |
| Can a forged alert freeze a treasury? | Alerts are advisory and do not govern either Guard. The deployed consumer trusts the public mock forwarder and is explicitly simulation data. Production needs an authenticated forwarder/workflow identity configuration. |
| Does successful execution prove a token payment? | No. V2 records recognized EVM-successful execution, including false-returning token-shaped calls and some zero-value shapes. It does not prove ERC-20 balance movement. |
| What about MultiSend, modules and governance? | V1/V2 reject delegatecall; they do not decode arbitrary nested calls. Existing modules can bypass transaction guards. Owner thresholds authorize administration/removal. Follow-up contracts need separate tests and declared limits. |
| Can a compromised website still harm me? | It can mislead first use, unsupported semantics or owner-approved configuration. Source/bundle attestation is provenance, not an audit. The Guard's narrow on-chain rule still applies when installed. |
| Are recipient queries private? | Threat comparisons use bulk evidence/payee reads locally. RPC simulations, wallet/services and public chain transactions can reveal recipients. Nox's routing, bootstrap and resolver boundaries are disclosed; no universal anonymity claim. |
| Is your precision 100%? | No human-labelled precision is established. H9 labels were assigned by AI; counts of detected patterns or receipt checks are not human precision. |
| Has a human checked it? | Guard sign-off, a real wallet manual flow, Hindi and precision review remain human work. CI, scripted transactions and AI review are separately disclosed. |

[Submission checklist](SUBMISSION.md) covers event provenance, prompt completeness, actual reviewer names, final video upload and the human dashboard deadline.
