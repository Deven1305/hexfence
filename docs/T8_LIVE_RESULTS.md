# T8 live gate — 6 November 2026

T8 passed with a **scripted EIP-1193 wallet**, not Safe{Wallet}. H6 remains unticked. No Guard code changed. Keys stayed in ignored root .env and the Node signer. Dhruv's authorisation is recorded in PROGRESS Decisions.

## Live results

- Guard deployment: 0x02311f96b37101ade733a9ee27f4093d71969bb3d2187f336b975ec59c57e132.
- Original setup-demo.js: Safe creation, funding, setGuard, approvePayee(P), setGuard(0), re-enable passed. Safe VERSION() = 1.4.1.
- Production Pay browser at 1280×960: Nox loaded real Guard/payees first attempt in 29,485 ms. No Skip used. RED L refused E74120 and accepted 344120; gas 200000 produced a mined revert decoded by UI. Fresh B AMBER and P GREEN succeeded.
- Direct L: 0xe77e6a7a8ba5b6f9742ec953826bc47c69ffffdced3a4d40b8fe3a220e1bb46f, gas 200000, mined revert. **Direct script, not Safe{Wallet}.** Both check-t8.js invocations exited 0 and replayed LookalikeOfApprovedPayee(L, P).
- Fresh mainnet detector scan: 1,366,618 logs, blocks 26345544–26352743; 47,694 suspected pairs (36,382 zero-value; 11,312 dust).
- publish:arkiv --limit 25 without ARKIV_ACCESS_KEY: 25 created in 0xe0b88b37643fb0ff1c730ea2cc662789dd6992b1e38c5ac4fc13dfa70c7bf0ea. Rerun: **0 created, 25 already on Arkiv, 0 transactions**. Public fetchAllEvidence query returned 25 records, status suspected.
- Local and hosted explorer: 25 real suspected records; Verify on Ethereum: “✓ Both receipts match this record on Ethereum”.
- [Hosted explorer](https://deven1305.github.io/hexfence/explorer/); [hosted Pay](https://deven1305.github.io/hexfence/pay/). Pages [run 42156170418](https://github.com/Deven1305/hexfence/actions/runs/42156170418) passed. Hosted Pay loaded actual Safe/Guard/payees via Nox in 38,085 ms, read-only scripted wallet; no hosted payment broadcast.

## Public checker rows

| Item | Value |
|---|---|
| HexFenceGuard (Sepolia) | 0xA061fB511D69e5c92E50E3BE5c789472d6f19748 |
| Demo Safe | 0x3BCc3969713778F3Ed26AE1490529eeBAD43FbD5 |
| VERSION() | 1.4.1 |
| P (approved payee) | 0x4E185e251Ac7fB83E9DE10723EAda46cadE74120 |
| L (synthetic lookalike) | 0x4E185a3FC4B530244aB9ed0dE38167b403344120 |
| B (new supplier) | 0xcB0a33f755826307CcaC3f4b4833e7e19d38cEb6 |
| setGuard tx | 0x2de356a6c196cb3f2040e3b8d4170ebe0cbc1b2684b0c05e26344756db6278e9 |
| approvePayee(P) tx | 0x13baea5038b830810e1a9f68fbed3ae1069f981af4810cbd43c50f7b0d7d1af2 |
| Removal drill setGuard(0) tx | 0x5edf08eb6489d78c13f0748283e43bab8c015c851d0d40e86b030dd6794ad8e0 |
| Removal drill re-enable tx | 0xd1c7db48a18647713c34384afc51b116888546dd837359eecad0938a5ebe9743 |
| L payment (reverted) | 0xa43b0eeef7253281a741deca144e5ddf0c465da9cc6f48d54673a9aa9c0f6d8f |
| B payment | 0x2455ca8f1ce612149f15e80325f372202bffeb0258f808bd84acfb1f904de5ca |
| P payment | 0xea209e9e3c5a9eed080e95dd0ca752b79686400da820ea67b87f98552d2992df |
| Second L (direct script, not Safe{Wallet}) | 0xe77e6a7a8ba5b6f9742ec953826bc47c69ffffdced3a4d40b8fe3a220e1bb46f |

## Verification and limitations

The pinned Hardhat verifier failed with HTTP 404: Sourcify API v1 removed. The new verify-sourcify.js submits the same compiler build info to documented v2, without keys. Live result: exact creation/runtime match, matchId 58580359; repeat lookup passed. Etherscan browser still displayed **Verify and Publish**, so Etherscan verification is not claimed. The Guard is verified on Blockscout, which decodes the reverted L payment as LookalikeOfApprovedPayee(recipient, approvedPayee): https://eth-sepolia.blockscout.com/tx/0xa43b0eeef7253281a741deca144e5ddf0c465da9cc6f48d54673a9aa9c0f6d8f and https://eth-sepolia.blockscout.com/address/0xA061fB511D69e5c92E50E3BE5c789472d6f19748. Etherscan-key configuration remains available.

No product bug found in this run. No H6 or Safe{Wallet} test occurred. H8's final narrated 2:30–3:00 video, H9 labels, H10 Hindi review, human Guard review and H12 participant/submission requirements remain human work. README/DEMO/SUBMISSION changes fill public values only; their existing untested-route prose and Safe{Wallet} script are not rewritten, so consult this report for observed results. The second Safe{Wallet} placeholder remains unfilled deliberately.

## Validation

- npx hardhat test: 14 passed.
- corepack pnpm@10.34.9 -r test: 121 passed; 3 opt-in integration tests skipped.
- corepack pnpm@10.34.9 -r build: passed; existing browser-externalization/chunk warnings.
- Earlier local real-contract Playwright E2E: 1 passed; setup/checker scripts: 12 passed; Etherscan V2 adapter scripted HTTP test: 1 passed.
- Live runner modes pay, direct-l, explorer, hosted-pay, hosted-explorer: all passed. check-t8 twice: exit 0.

## Captures outside git

Directory: C:/hexfence-work/live-artifacts/. All videos are 1280×960.

| Capture | File |
|---|---|
| L/B/P production Pay, scripted wallet | b4083cfda634454ae9323e66722bee5b.webm |
| Local explorer + Verify on Ethereum | 2f4bd1aa21d2ea273add0380be5a9798.webm |
| Hosted Pay read-only | 105407c8641dd22f3995ead1fceef8e4.webm |
| Hosted explorer + Verify on Ethereum | 5244e2df7c8078980b370aa05f5417be.webm |
| Reverted L screen | pay-lpay.png |
| Explorer list / Ethereum verification | explorer-records.png / explorer-verified.png |

The reverted-L screenshot shows the Nox route, visibly named scripted wallet, Safe 1.4.1 and active Guard, RED resemblance warning, entered 344120, real transaction link, and decoded LookalikeOfApprovedPayee(L, P). The synthetic pair is not labelled evidence. Pay's first run preceded publication, so that screenshot correctly shows 0 public records; the hosted check loaded the subsequently published data.

VITE_* values are public JavaScript. Required repository variables: VITE_ARKIV_PUBLISHER, VITE_GUARD_ADDRESS, VITE_SEPOLIA_RPC_URL. Also set VITE_MAINNET_RPC_URL for receipt verification. Only public or restricted values belong there; all values set in this pass are public addresses/endpoints. Deven's Pages Source is confirmed GitHub Actions; no workaround.

## Post-T8 evidence expansion (same branch)

Using only the publisher existing 0.092986528 tGLM, publish:arkiv --limit 125 created 100 more records in four batches, leaving 0.066344842 tGLM. No further funding transfer occurred. Rerun: **0 created, 125 already on Arkiv, 0 transactions**. Public arkiv/query.ts returned 125 unique IDs: 124 zero-value and 1 dust, all suspected. Hosted explorer loaded all 125 through Load more and verified the first record receipts again. Capture: 5c501326657bae203e392f6e21439ea6.webm, with updated explorer-records.png/explorer-verified.png, outside git.

Additional public transaction hashes:

- 0xfadb29df57c9863d8b51433aa8f237001e0f78a16768da03c7fca66e647efcca
- 0xf04c97df1da6a4727b1cfb17d765aad038305df5f1fd092821876bf0f0fd1cd6
- 0xbe14fde50d22d562d94432f60d3aca67ec9fa1aab784a2e66c9d70870467e130
- 0xeafdf124d27904dcab298d91366e8e78913b7df3f61412bca8c0af3760ffb019

Arkiv reach, rationale and usage documents now answer the official from-scratch questions, including off-Arkiv choices, ownership, expiry, visible reads and honest adoption limits. Feedback includes reproduction and concrete improvements. **post-Mumbai plan: team to confirm**. A plain bash README query initially failed when pasted through Windows argument quoting; equivalent file-based query passed and is provided as arkiv/query.ts. No product bug was involved.

Human H6 without importing the generated owner key: use an existing wallet to create a separate isolated Safe 1.4.1 on Sepolia; fund it with test ETH; execute one call per transaction, setGuard(the deployed Guard), then Guard.approvePayee(P). In hosted Pay connect that wallet, load that Safe, test L friction (refuse E74120, accept 344120), mined revert, then fresh B and P success. In Safe{Wallet} send a second L payment with manual gas 200000 and record the reverted hash, wallet/version and new Safe/setup hashes. The current scripted Safe is solely owned by the Node signer; no human wallet test is claimed.
