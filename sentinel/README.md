# HexFence Sentinel

Testnet workflow source; CRE execution is pending human authentication. This is **not an always-on deployed service**.

Sentinel watches Sepolia token Transfer logs, reads each protected Safe's full payee list, compares the shared 4+4 fingerprint, and submits a signed CRE report to `HexFenceAlerts`. An optional Telegram POST sends an advisory notification. The Guard never depends on this workflow. A synthetic demonstration only shows an address that resembles an approved payee, not mainnet evidence.

## Run

Install Node 22, Bun >=1.2.21 and CRE CLI (tested CLI version: 1.39.0); `corepack pnpm@10.34.9 install` from the repo root. A human creates the Chainlink account and runs `cre login`; the agent does neither. `cre init --project-name <new-project> --workflow-name hexfence-sentinel --template hello-world-ts --non-interactive` also requires login. This repo supplies the project files directly because init was authentication-blocked.

1. In the ignored root `.env`, use an **existing testnet** `DEPLOYER_PRIVATE_KEY` and `SEPOLIA_RPC_URL`. Set `SENTINEL_GUARD_ADDRESS` and `SENTINEL_SAFE_ADDRESS` to the Guard and Safe to monitor.
2. From `contracts`, run `npx hardhat run scripts/deploy-alerts.js --network sepolia`. It refuses other chains and insufficient existing balance. It writes the public deployment record and ignored `sentinel/hexfence-sentinel/config.json`.
3. Set `CRE_ETH_PRIVATE_KEY` in the ignored root `.env` to an existing Sepolia signer. No funding, faucet or key creation is performed by this workflow. Optionally set `TELEGRAM_BOT_TOKEN_ALL`; enable Telegram and set the opted-in chat ID in the ignored config. A human creates the bot, starts its chat and provides its token.
4. From `sentinel`, run the following with an **actual** Sepolia poisoning demonstration transaction and its event index (not the transaction index):

```sh
cre workflow simulate hexfence-sentinel --target staging-settings --env ../.env --non-interactive --trigger-index 0 --evm-tx-hash <actual-tx-hash> --evm-event-index <actual-event-index> --broadcast
```

Trigger 0 is `from = protected Safe`, trigger 1 is `to = protected Safe`. Zero-value `transferFrom(Safe, lookalike, 0)` needs an emitted Transfer event; do not assume a token emits one without checking its receipt. Confirm `PoisoningAttempt` in the resulting consumer receipt and `alertsOf(Safe)`. Save the CLI's actual output and hash in `SIMULATION.md` **only after success**. There is no simulation transcript yet.

## Tests and limits

`corepack pnpm@10.34.9 --filter hexfence-sentinel test` and `build`; consumer tests run with the other Hardhat tests. Classification tests use explicitly synthetic fixtures. No test fixture is served as evidence or alert data.

Two finalized log triggers watch at most five Safes and five token contracts with configured decimals. The workflow handles outgoing zero-value spoofing and positive incoming dust below one token. It ignores removed logs and self-transfers. V1 reads `payees(Safe)`; V2 reads `knownRecipients(Safe)`. All list and alert reads are bulk per Safe, with no per-recipient service queries. Finality adds latency; an RPC failure stops a run. Current state may differ from state when an old log was emitted.

The consumer keeps 32 distinct alerts per Safe in chronological insertion order, evicting the oldest. Deduplication lasts while the pair is in the ring; it is not permanent. Reports include the chain ID and consumer address to prevent cross-chain / cross-consumer replay. Telegram is best-effort: the workflow skips a notification when another alert was observed within the configured block gap (300 by default). Concurrent unfinalized runs can still duplicate notifications, cache reuse is best-effort, and failed Telegram sends are not retried after the alert is recorded.

Simulation uses the **public MockKeystoneForwarder**, which does not prove DON execution. Its alerts must be described as simulation data. Production requires the documented KeystoneForwarder and workflow identity restrictions (`setExpectedWorkflowId`, optionally author/name) before claiming authenticated monitoring. The vendored `ReceiverTemplate` is Chainlink's documented template with owner-controlled permissions; the owner can change or disable validation. It is not an immutable trust boundary.

Telegram receives the chat ID, Safe address, two public addresses and public transaction hash; Telegram and CRE nodes process the bot token. The RPC learns the monitored Safes and Guard, token subscriptions and alert contract. No analytics or per-recipient HTTP lookups are used.

## Official references checked before implementation

- [Log triggers](https://docs.chain.link/cre/guides/workflow/using-triggers/evm-log-trigger-ts)
- [EVM reads](https://docs.chain.link/cre/guides/workflow/using-evm-client/onchain-read-ts)
- [Reports and delivery](https://docs.chain.link/cre/guides/workflow/using-evm-client/onchain-write/overview-ts)
- [Consumer template](https://docs.chain.link/cre/guides/workflow/using-evm-client/onchain-write/building-consumer-contracts)
- [Forwarder directory](https://docs.chain.link/cre/guides/workflow/using-evm-client/forwarder-directory-ts)
- [HTTP POST](https://docs.chain.link/cre/guides/workflow/using-http-client/post-request-ts), [simulation secrets](https://docs.chain.link/cre/guides/workflow/secrets/using-secrets-simulation-ts), [simulation](https://docs.chain.link/cre/guides/operations/simulating-workflows)

SDK 1.23.0 differs from older prose examples: `getSecret` belongs to the DON runtime, and HTTP cache settings use `store` and `maxAge`. The code follows the installed official SDK types. Workflow source is MIT; the CRE SDK dependency carries its own BUSL-1.1 license.

## Recorded Sepolia preparation (06 Nov 2026)

Consumer: [0x97F6f25D51DD52565FF30D22286392686A1ED80F](https://sepolia.etherscan.io/address/0x97F6f25D51DD52565FF30D22286392686A1ED80F); [deployment transaction](https://sepolia.etherscan.io/tx/0x6fa36eef483077cfa825de7d5273484011e3c2b0c528d9e8bd2eec196ba4a8c9). Sourcify v2 reports exact creation/runtime match, match ID 58607325. This consumer is configured for simulation, with no production identity claim.

[Actual zero-value USDC trigger transaction](https://sepolia.etherscan.io/tx/0x7494d97df9468b822e32aa7008e8f336979b584558053457a03ef32e00b9af15), event index **0**, block 12075412. It is a synthetic demonstration of a lookalike that resembles the approved payee, not evidence of a real attack. The corresponding CRE command still stops at authentication. Public machine-readable records are in `deployments/`.

All three required check commands and WASM compilation passed in the [Linux CI run](https://github.com/Deven1305/hexfence/actions/runs/42188282403). WASM compilation is not a CRE simulation. `cre init` and `cre workflow simulate` were attempted with CLI 1.39.0 and both rejected for missing login. No `SIMULATION.md` output has been fabricated.
