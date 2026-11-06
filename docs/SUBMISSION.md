# Submission pack: ETHGlobal Mumbai 2026

Copy-paste text for the ETHGlobal project page and the partner prizes (Arkiv: Build on Arkiv; Ethereum Foundation: Best CROPS App, Best Use of Anon-RPC). Source: spec §0, §5, §6, §8 (`docs/planning/10_FINAL_What_To_Build_HexFence.md`) and the README. Submissions are due **Sat 7 Nov 2026, 09:00 IST** (spec aim: submit by 08:30).

Values below come from the live T8 run (`docs/T8_LIVE_RESULTS.md`) unless the last column says a human still owes them. Anything still written as `‹NAME›` does not exist yet: fill it from the source named beside it, and do not publish text that still contains one.

| Name | Value | Source |
|---|---|---|
| GUARD_ADDRESS | 0xA061fB511D69e5c92E50E3BE5c789472d6f19748 | `docs/PROGRESS.md` (HexFenceGuard, Sepolia) |
| SAFE_ADDRESS | 0x3BCc3969713778F3Ed26AE1490529eeBAD43FbD5 | same (demo Safe, `VERSION()` 1.4.1) |
| TX_SETGUARD | 0x2de356a6c196cb3f2040e3b8d4170ebe0cbc1b2684b0c05e26344756db6278e9 | same |
| TX_APPROVE_P | 0x13baea5038b830810e1a9f68fbed3ae1069f981af4810cbd43c50f7b0d7d1af2 | same |
| TX_L_REVERT | 0xa43b0eeef7253281a741deca144e5ddf0c465da9cc6f48d54673a9aa9c0f6d8f | same (L payment, reverted) |
| TX_B_OK | 0x2455ca8f1ce612149f15e80325f372202bffeb0258f808bd84acfb1f904de5ca | same (B payment, succeeded) |
| TX_P_OK | 0xea209e9e3c5a9eed080e95dd0ca752b79686400da820ea67b87f98552d2992df | same (P payment, succeeded) |
| TX_REMOVE | 0x5edf08eb6489d78c13f0748283e43bab8c015c851d0d40e86b030dd6794ad8e0 | same (removal drill, `setGuard(0)`) |
| TX_REENABLE | 0xd1c7db48a18647713c34384afc51b116888546dd837359eecad0938a5ebe9743 | same (removal drill, re-enable) |
| TX_L_REVERT_2 | 0xe77e6a7a8ba5b6f9742ec953826bc47c69ffffdced3a4d40b8fe3a220e1bb46f | `docs/T8_LIVE_RESULTS.md` (direct script transaction, not Safe{Wallet}) |
| ARKIV_PUBLISHER | 0x36141ba063390f0d91Af7a5a9dF8dc1d80D699ec | README "Publisher wallet" |
| RECORD_COUNT | 125 | `docs/T8_LIVE_RESULTS.md` (124 zero-value, 1 dust, all suspected) |
| EXPLORER_URL | https://deven1305.github.io/hexfence/explorer/ | Pages workflow, PROGRESS H11 |
| PAY_URL | https://deven1305.github.io/hexfence/pay/ | same |
| REPO_URL | https://github.com/Deven1305/hexfence | the public repo |
| ‹PRECISION› | still owed | printed by `pnpm --filter @hexfence/detector precision` after the H9 labels exist: "N of M labelled rows were poisoning". Leave the sentence out if H9 is not done |
| ‹VIDEO_URL› | still owed | the uploaded video |
| ‹GUARD_REVIEWER› | still owed | the team member who actually reviewed the Guard; `docs/AI_USAGE.md` still needs this name |

Decoded revert and verified Guard source are on Blockscout, not Etherscan (the Guard is not verified on Etherscan): [reverted L payment](https://eth-sepolia.blockscout.com/tx/0xa43b0eeef7253281a741deca144e5ddf0c465da9cc6f48d54673a9aa9c0f6d8f), [Guard source](https://eth-sepolia.blockscout.com/address/0xA061fB511D69e5c92E50E3BE5c789472d6f19748).

## 1. Project name and tagline

**HexFence**

> A Safe Guard that refuses lookalike payments, with open address-poisoning evidence on Arkiv.

## 2. Short description (about 100 characters)

HexFence makes a Safe refuse to pay a lookalike of an approved supplier, and publishes the evidence on Arkiv.

## 3. Description

Address poisoning is when an attacker sends a tiny or zero-value transfer from an address that matches the first and last characters of one you pay, hoping you copy it from your history next time. Wallet warnings help, but they live in the interface and can be ignored. Blocklists only know attackers someone already reported.

HexFence detects address poisoning, publishes the evidence openly on Arkiv, warns you locally before you sign, and makes a protected Safe refuse to pay a lookalike of an approved supplier, even one nobody has ever reported, while new suppliers still work.

The core is `HexFenceGuard`, a Safe transaction guard with no owner and no upgrade path. The Safe's owners approve payees with owner-signed Safe transactions. If a payment's recipient has the same first 4 and last 4 hex characters as an approved payee but is a different address, the Guard reverts with `LookalikeOfApprovedPayee`. Anyone else still goes through, so this is not an allowlist. The Guard reads nothing off-chain, so it keeps working if every other part of HexFence disappears.

Around it:
- **Detector:** reads Ethereum mainnet USDT and USDC transfer logs and finds lookalike pairs. Every record is marked "suspected".
- **Arkiv:** the pairs are written as `hexfence.poisoning.v1` records with 30-day expiry, idempotently (a re-run creates 0 duplicates).
- **Explorer:** searches the Arkiv records, links both transactions on Etherscan, and re-checks the receipts in the browser with "Verify on Ethereum".
- **HexFence Pay:** decodes a Safe payment, reads the Safe's payees once, and shows a verdict (red: resembles an approved payee; amber: new recipient; green: approved). To send a red payment anyway the user must type 6 characters. It has two Hindi verdict lines and tries the Nox mixnet for its Sepolia reads.

The demo is in two clearly separate parts. Part 1 is real mainnet evidence read live from Arkiv. Part 2 is a **synthetic re-enactment on Sepolia** using a pair of addresses we generated ourselves, not a real attack: paying the lookalike reverts on-chain, paying a new supplier succeeds, paying the approved payee succeeds, and the lookalike still reverts with our client switched off.

Limits (stated in the README): module transactions bypass guards; MultiSend is refused; only ETH, `transfer` and `transferFrom` are inspected; a 4+4 fingerprint does not catch weaker lookalikes; evidence covers only mainnet USDT and USDC and says "suspected", not a finding about any person.

## 4. How it's made

- **Guard:** Solidity, Hardhat, tested against the real Safe 1.4.1 contracts, including the removal of the Guard through a real Safe transaction and the rejection of a second payee with the same fingerprint. The reference Guard and its tests are AI-generated; an AI agent checked them against the spec and ‹GUARD_REVIEWER› reviewed them (`docs/AI_USAGE.md`).
- **Shared logic:** TypeScript package with the fingerprint, the Safe payment decoder, the verdict logic and the evidence schema (zod). A parity test checks the TypeScript fingerprint rule against the real Guard on 411 transactions.
- **Detector:** TypeScript and viem, reading Ethereum mainnet USDT/USDC `Transfer` logs through a public RPC. Read-only.
- **Arkiv:** `@arkiv-network/sdk` on the Rabdi testnet. Records are bulk-read and written idempotently. One publisher wallet signs.
- **Explorer:** static Vite app that reads Arkiv from the browser and verifies receipts against Ethereum mainnet in the browser.
- **HexFence Pay:** Vite and TypeScript, Safe Protocol Kit 8, viem, a browser wallet on Sepolia. RPC reads can go through Anon-RPC's Nox route (Sphinx mixnet).
- **Tooling:** pnpm workspace, Node 22, vitest. Contracts are a standalone npm Hardhat project.
- **AI:** we used Claude Code and Codex as coding agents under written rules (`AGENTS.md`, `docs/PARALLEL_PLAN.md`). All plans, prompts and reports are kept in `docs/planning/`; `docs/AI_USAGE.md` lists what was AI-generated.
- **What's new vs reused:** built at this event: the detector, the Arkiv schema and publisher, the explorer, HexFence Pay and the shared logic. Reused: the reference Guard and its tests, Safe 1.4.1 contracts, Safe Protocol Kit, `@arkiv-network/sdk`, viem, zod, Hardhat, Vite, vitest. No code from any pre-event project.

## 5. Prize tracks

### 5.1 Arkiv: Build on Arkiv

Paste:

> HexFence uses Arkiv as the open evidence layer for address poisoning. The detector reads Ethereum mainnet USDT/USDC logs and writes each suspected pair as a `hexfence.poisoning.v1` entity on the Rabdi testnet with a 30-day expiry. Each record carries the victim, the impersonated address, the lookalike and both transaction hashes, and is always marked "suspected". Writes are idempotent, so a re-run creates 0 duplicates. The explorer and HexFence Pay read the records in bulk and never look up one address at a time, so no reader tells a server which address they care about. The explorer can re-check any record against Ethereum receipts in the browser. We chose Arkiv because the evidence should be queryable by anyone, expire when it stops being useful, and not sit in a vendor's closed feed. Currently 125 records, published by 0x36141ba063390f0d91Af7a5a9dF8dc1d80D699ec. Schema, friction notes, reach, why-Arkiv and how-we-use-it are in `/arkiv/`.

Links to give: https://github.com/Deven1305/hexfence/tree/main/arkiv, https://deven1305.github.io/hexfence/explorer/, and the publisher wallet 0x36141ba063390f0d91Af7a5a9dF8dc1d80D699ec. The one query judges can run is in the README ("Arkiv publisher + query").

### 5.2 Ethereum Foundation: Best CROPS App

Paste the README CROPS section as it stands (kept true to what ships). Short form:

> **C (censorship resistance):** the Guard is non-upgradeable and has no owner. It keeps refusing lookalikes even if our detector, explorer, client and Arkiv records all disappear. The detector is open source, so anyone can run it and publish under their own wallet.
> **O (open source):** MIT licence. Everything builds and runs from the repo; RPC endpoints are configurable.
> **P (privacy):** the client checks recipients locally and sends no payment-specific threat lookup to a security provider. It reads the Safe's payees in bulk. No trackers. HexFence Pay tries Nox for its Sepolia RPC reads and shows which route is active. Not covered by Nox: the one bootstrap read of the routing contract, the Arkiv bulk reads, and your wallet's own signing and sending. Your wallet, Safe's transaction service (when you use the Safe UI) and the public chain still see the payment.
> **S (security, our lead property):** the account enforces the rule; payees are approved only by owner-signed Safe transactions; duplicate fingerprints are rejected; delegatecall fails closed; removal of the Guard is tested through real Safe transactions but not guaranteed; the demo Safe is isolated and holds test funds only; the limits are stated.

EF places a project in one track only, so the form may ask you to pick; the spec lists Best CROPS App as the main one.

### 5.3 Ethereum Foundation: Best Use of Anon-RPC

Enter this track only if the submission form offers it and the Nox route was actually shown working in the video. Paste:

> HexFence Pay routes its Sepolia RPC reads (Safe data, payees, balances) through Anon-RPC's Nox route (Sphinx mixnet) by default. A route counts as active only after a real Sepolia `eth_chainId` read has gone through it and returned 11155111. The page names the active route and never calls the direct path anonymous. If start-up fails, the user sees a labelled, non-anonymous direct fallback; once Nox is active, later read failures surface as errors and do not silently switch to direct. We state what is not covered: the single start-up read of the routing contract and the Arkiv bulk reads are direct, and the wallet signs and sends itself. Hosted Nox and Guard or payee reads through Nox are untested.

Do not claim a latency figure unless you measured one for the video. The README records about 9 seconds in one browser check and more than 20 seconds (not timed) in another; neither is a benchmark.

## 6. Demo video

- 2:30 to 3:00, at least 720p. This meets ETHGlobal (2 to 4 minutes) and EF CROPS (3 minutes at most).
- Narration script: `docs/DEMO.md`.
- Link: ‹VIDEO_URL›

## 7. Required links and items (tick before submitting)

ETHGlobal and partner forms:
- [ ] Public repo, created after kickoff, MIT licence: https://github.com/Deven1305/hexfence
- [ ] No code from the pre-event Pramaan repo
- [ ] Live explorer: https://deven1305.github.io/hexfence/explorer/
- [ ] Live HexFence Pay (or install steps): https://deven1305.github.io/hexfence/pay/
- [ ] Video 2:30 to 3:00, 720p or better: ‹VIDEO_URL›
- [ ] No trackers; testnet keys only; no keys or seed phrases committed (`git log -p` search before submitting)

In the repo:
- [ ] `docs/planning/`: the locked spec plus every plan, prompt and report
- [ ] `docs/AI_USAGE.md` names the reference Guard as AI-generated and reviewed
- [ ] README: run steps, architecture, new vs reused, CROPS section, limits
- [ ] README table filled in: 0xA061fB511D69e5c92E50E3BE5c789472d6f19748, 0x3BCc3969713778F3Ed26AE1490529eeBAD43FbD5 (with `VERSION()`), 0x2de356a6c196cb3f2040e3b8d4170ebe0cbc1b2684b0c05e26344756db6278e9, 0x13baea5038b830810e1a9f68fbed3ae1069f981af4810cbd43c50f7b0d7d1af2, 0xa43b0eeef7253281a741deca144e5ddf0c465da9cc6f48d54673a9aa9c0f6d8f, 0x2455ca8f1ce612149f15e80325f372202bffeb0258f808bd84acfb1f904de5ca, 0xea209e9e3c5a9eed080e95dd0ca752b79686400da820ea67b87f98552d2992df, 0x5edf08eb6489d78c13f0748283e43bab8c015c851d0d40e86b030dd6794ad8e0, 0xd1c7db48a18647713c34384afc51b116888546dd837359eecad0938a5ebe9743
- [ ] README: Arkiv publisher wallet 0x36141ba063390f0d91Af7a5a9dF8dc1d80D699ec and the query output
- [ ] `arkiv/schema.md`, `friction.md`, `reach.md`, `why-arkiv.md`, `how-you-use-arkiv.md`
- [ ] README and `docs/DEMO.md` contain no leftover `‹...›` or "(after ...)" placeholders

Human boxes that change what you may claim:
- [ ] H9 labels done: only then may the text state a precision (‹PRECISION›). Otherwise leave it out, as the README does
- [ ] H10 Hindi check done (`docs/H10_HINDI_CHECK.md`): otherwise say the Hindi lines are "not yet reviewed by a native speaker"
- [ ] Safe{Wallet} UI removal drill done by a person: otherwise say the removal drill was run by script only
