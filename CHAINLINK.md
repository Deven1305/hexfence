# Chainlink CRE: Sentinel

**Status: source, tests, WASM build, Sepolia consumer and Pay reader are merged. Successful CRE CLI simulation is still missing. Do not claim Chainlink qualification yet.**

Selected track: **Best workflow with CRE**. Its requirements are on the [official Mumbai prize page](https://ethglobal.com/events/mumbai/prizes). Simulation can qualify; production DON deployment is not required. A WASM build or a deployed consumer alone does not satisfy the successful-run requirement. No CCIP integration or CCIP prize is claimed.

## What CRE does here

Sentinel is the proposed Watch stage between a planted token-transfer log and an advisory warning in Pay:

1. Two finalized Sepolia EVM log triggers select outgoing and incoming Transfer logs for configured Safes.
2. Classify outgoing zero-value spoofing or positive incoming dust below one token; ignore self-transfers and removed logs.
3. Bulk-read `payees(Safe)` for v1 or `knownRecipients(Safe)` for V2. Compare the shared first-four/last-four fingerprint locally.
4. Read the Safe's bounded alert list, skip a pair already retained, generate `runtime.report(...)`, and call `EVMClient.writeReport(...)`.
5. Optionally POST a notification through `HTTPClient` to Telegram, using a CRE secret. Pay bulk-reads `alertsOf(Safe)` through its existing read client/Nox route.

The Guard reads neither alerts nor Chainlink. A missing workflow, failed API or fabricated advisory report cannot lower Pay's payment verdict or change Guard storage.

## Evidence on main

| Item | Proof | Limit |
|---|---|---|
| Workflow source and SDK configuration | [main.ts](sentinel/hexfence-sentinel/main.ts), [project](sentinel/project.yaml), [workflow](sentinel/hexfence-sentinel/workflow.yaml), [secrets declaration](sentinel/secrets.yaml) | Prepared directly because `cre init` required authentication |
| Classifier and consumer tests | [classifier tests](sentinel/hexfence-sentinel/logic.test.ts), [consumer tests](contracts/test/alerts.test.js) | Synthetic unit fixtures are not live evidence |
| Actual WASM compilation | [successful CI run](https://github.com/Deven1305/hexfence/actions/runs/42188654422) | Compilation is not simulation |
| Consumer | [0x97F6f25D51DD52565FF30D22286392686A1ED80F](https://sepolia.etherscan.io/address/0x97F6f25D51DD52565FF30D22286392686A1ED80F), [deployment receipt](https://sepolia.etherscan.io/tx/0x6fa36eef483077cfa825de7d5273484011e3c2b0c528d9e8bd2eec196ba4a8c9), [record](sentinel/deployments/sepolia.json) | Public simulation forwarder, not DON-authenticated production reports |
| Public source match | Sourcify exact creation/runtime match **58607325**, [lookup](https://sourcify.dev/server/v2/contract/11155111/0x97F6f25D51DD52565FF30D22286392686A1ED80F) | Source matching is not an audit |
| Real trigger input | [zero-value USDC transaction](https://sepolia.etherscan.io/tx/0x7494d97df9468b822e32aa7008e8f336979b584558053457a03ef32e00b9af15), event index **0**, [record](sentinel/deployments/trigger-sepolia.json) | Synthetic Sepolia demonstration; no tokens moved; not mainnet evidence |
| Pay integration | [Radar](apps/pay/src/radar.ts), [wiring tests](apps/pay/test/upgrade.test.ts), [read-only browser check](apps/pay/e2e/upgrade-visual.mjs), [PR #35](https://github.com/Deven1305/hexfence/pull/35) | Actual consumer reads returned an empty list; no CRE-produced alert shown yet |
| Successful CRE simulation / Telegram receipt | **Missing** | CLI 1.39.0 attempts stop at authentication; no bot token was provided |

The 32-slot ring deduplicates `(Safe, lookalike)` while the pair is retained. Eviction permits a later report for the same pair. Reports bind the chain ID and receiver address. The documented ReceiverTemplate also has owner-controlled permissions; production needs the production KeystoneForwarder and workflow identity restrictions. The public mock forwarder does not prove DON execution.

## Exact human steps left

The agent does not create accounts, accept terms, log in or obtain tokens. A human must:

1. Install the official CRE CLI and Bun; create the Chainlink account if needed, then run `cre login` personally. Implementation was checked with CLI **1.39.0**, SDK **1.23.0**, Bun **1.4.4**.
2. From the repo root run `corepack pnpm@10.34.9 install --frozen-lockfile`. Copy [config.example.json](sentinel/hexfence-sentinel/config.example.json) to ignored `sentinel/hexfence-sentinel/config.json`; its public addresses reuse the existing deployments.
3. Put an **existing funded Sepolia testnet** signing key in ignored root `.env` as `CRE_ETH_PRIVATE_KEY`. Do not display it, create a key for this step, request a faucet or move funds through the agent.
4. For the external-API demonstration, a human creates/starts the Telegram bot/chat, sets `TELEGRAM_BOT_TOKEN_ALL` in ignored root `.env`, and sets `telegram.enabled=true` plus the opted-in `chatId` in ignored `config.json`. A Telegram-disabled run does not demonstrate the external API stage.
5. From `sentinel`, run:

```sh
cre workflow simulate hexfence-sentinel --target staging-settings --env ../.env --non-interactive --trigger-index 0 --evm-tx-hash 0x7494d97df9468b822e32aa7008e8f336979b584558053457a03ef32e00b9af15 --evm-event-index 0 --broadcast
```

6. Require actual CLI success, a consumer receipt containing `PoisoningAttempt` for the expected Safe/pair, and the actual Telegram notification. Confirm both write status and receiver execution status. Save the **actual** command/output and alert transaction hash to `sentinel/SIMULATION.md`; do not write a transcript from expectation.
7. Reload [Pay on the v1 demonstration Safe](https://deven1305.github.io/hexfence/pay/?safe=0x3BCc3969713778F3Ed26AE1490529eeBAD43FbD5). Show the simulation-labelled Radar alert and its X-Ray. Record the real CLI, receipt, notification and banner in the video.

Until those steps succeed, the third sponsor's runtime requirements remain gaps. Do not replace them with a hand-inserted alert or call a unit test a CRE simulation.

## Privacy and operational limits

Telegram receives the opted-in chat ID, public Safe/pair addresses and transaction hash. CRE runtime nodes process the bot secret when enabled. Sepolia RPC reads expose monitored Safes/contracts to the RPC provider; Pay uses the route actually displayed, while CLI simulation uses its configured RPC. No per-recipient HTTP threat lookup is made. Telegram notification caching is best-effort; the block-gap throttle can suppress notifications, and failed notifications are not retried after recording an alert. Finality delays alerts. Current payee state can differ from state at an old trigger block.

SDK 1.23.0 uses DON-runtime `getSecret` and HTTP cache settings `store`/`maxAge`; older prose examples used different APIs. The [Decisions log](docs/PROGRESS.md#decisions-log) records this. The CRE SDK has its own BUSL-1.1 license; HexFence source remains MIT. See [official sources and detailed workflow limits](sentinel/README.md).
