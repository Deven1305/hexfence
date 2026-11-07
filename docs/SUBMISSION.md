# Submission pack: ETHGlobal Mumbai 2026

Copy-paste text for the ETHGlobal project page and three partner prizes: **Arkiv** (Build on Arkiv, from scratch), **Ethereum Foundation** (Best CROPS App) and **Chainlink** (Best workflow with CRE, only if the gate in §5.3 is met). Checked against `main` at 8c3c175 on 6 Nov 2026. Due **Sat 7 Nov 2026, 09:00 IST**; aim for 08:30.

Three placeholders remain on purpose. Do not publish text that still contains one:
- `‹VIDEO_URL›`: the uploaded video.
- `‹GUARD_REVIEWER›`: the team member who read `docs/GUARD_REVIEW.md` and the contract and signed off.
- `‹PRECISION›`: a human-checked precision from H9. The current 30 labels were assigned by AI. If no person checks them, delete the sentence that contains `‹PRECISION›`.

## Values

| Name | Value |
|---|---|
| Repo | https://github.com/Deven1305/hexfence (MIT) |
| Landing | https://deven1305.github.io/hexfence/ |
| Explorer | https://deven1305.github.io/hexfence/explorer/ |
| Pay (preview, no wallet) | https://deven1305.github.io/hexfence/pay/?safe=0x3BCc3969713778F3Ed26AE1490529eeBAD43FbD5 |
| HexFenceGuard v1 (Sepolia) | 0xA061fB511D69e5c92E50E3BE5c789472d6f19748, verified on Etherscan and Sourcify |
| Demo Safe (Safe 1.4.1) | 0x3BCc3969713778F3Ed26AE1490529eeBAD43FbD5 |
| L payment, reverted | 0xa43b0eeef7253281a741deca144e5ddf0c465da9cc6f48d54673a9aa9c0f6d8f |
| B payment, succeeded | 0x2455ca8f1ce612149f15e80325f372202bffeb0258f808bd84acfb1f904de5ca |
| P payment, succeeded | 0xea209e9e3c5a9eed080e95dd0ca752b79686400da820ea67b87f98552d2992df |
| L again, direct script without Pay, reverted | 0xe77e6a7a8ba5b6f9742ec953826bc47c69ffffdced3a4d40b8fe3a220e1bb46f |
| Guard removed / restored | 0x5edf08eb6489d78c13f0748283e43bab8c015c851d0d40e86b030dd6794ad8e0 / 0xd1c7db48a18647713c34384afc51b116888546dd837359eecad0938a5ebe9743 |
| HexFenceGuardV2 / isolated V2 Safe | 0x0adF080DE3DA9D672fDc7330B8750a0579A698c7 / 0x5142C7E9DE82726CaCb847c5469D460508738214 |
| HexFenceModuleGuard (Safe 1.5.0) | 0xa7Dc08C6fb15fCdBF4De484FaE393fea052c546B (scripted drill on isolated Safe 0x36cc3F281129C6375B8057faB536caDD83C577b2) |
| HexFenceAlerts (CRE consumer) | 0x97F6f25D51DD52565FF30D22286392686A1ED80F |
| Arkiv publisher (Rabdi, chain 7794095) | 0x36141ba063390f0d91Af7a5a9dF8dc1d80D699ec |
| Records | 1,126 `hexfence.poisoning.v1` (651 zero-value, 475 dust, all suspected) + 1 `hexfence.loss.v1` |

All payments above were sent by a script wallet, not by a person in Safe{Wallet}.

## 1. Name and tagline

**HexFence**

> Your Safe refuses to pay a lookalike of a supplier you approved.

## 2. Short description

HexFence makes a Safe refuse lookalike payments on-chain and publishes open address-poisoning evidence on Arkiv.

## 3. Description

Address poisoning plants a lookalike address in your history: a zero-value or tiny transfer from an address with the same first and last characters as someone you pay. Next time you copy from history, you pay the attacker. Wallet warnings help, but you can click through them.

HexFence puts the rule in the account. `HexFenceGuard` is a Safe transaction guard with no owner and no upgrade path. Owners approve payees with Safe transactions. If a payment goes to a different address with the same first 4 and last 4 hex characters as an approved payee, the Guard reverts with `LookalikeOfApprovedPayee`. New suppliers still go through, so it is not an allowlist, and it reads nothing off-chain.

Around the Guard:
- **Detector:** reads Ethereum mainnet USDT and USDC transfer logs and finds lookalike pairs. One 7,200-block run found 47,694 suspected pairs.
- **Arkiv evidence:** 1,126 selected records from two scans are published as `hexfence.poisoning.v1` records with 30-day expiry, plus one suspected follow-up payment (303.635007 USDT) as `hexfence.loss.v1`. Every record is "suspected".
- **Explorer:** reads Arkiv in the browser; after a failed live read, it uses a dated `evidence-saved.json` copy when available and shows the read time. Evidence, Losses (a downloadable rescue pack with a SHA-256), Campaigns (records grouped by attack transaction), and a private "Check my address" that runs on downloaded records.
- **HexFence Pay:** loads a Safe, reads its approved payees once, and gives a verdict in the browser before signing: RED for a lookalike, AMBER for a new recipient, GREEN for an approved payee. Sending a RED payment needs 6 typed characters. Reads go through the Nox mixnet by default. Pay can also run as a Safe App (not yet tried by a person inside Safe{Wallet}) and has a Hindi mode (not yet checked by a native speaker).
- **For agents:** `@hexfence/check` (offline check SDK) and `@hexfence/mcp` (an MCP tool, `hexfence_check`) give the same verdict to AI agents before they sign.

The demo has two clearly separate parts: real mainnet evidence read from Arkiv (live, or from a dated saved copy with an on-page notice after a failed live read), and a **synthetic re-enactment on Sepolia** with addresses we generated. Paying the lookalike reverted on-chain, paying a new supplier succeeded, paying the approved payee succeeded, and the lookalike still reverted with our client out of the path.

An opt-in learning Guard (V2) has a scripted Sepolia run: it learned the first recipient, then refused the lookalike. A module guard for Safe 1.5.0 and a governance guard also have scripted Sepolia drills on new isolated Safes: each refused the synthetic lookalike in a mined revert and allowed the non-lookalike case. No person has run these from a wallet. Limits are in the README.

## 4. How it's made

- **Contracts:** Solidity and Hardhat, tested against the real Safe 1.4.1 (and 1.5.0 for the module guard) contracts. The v1 Guard and its tests started from an AI-generated reference; an AI review is in `docs/GUARD_REVIEW.md`, and ‹GUARD_REVIEWER› reviewed it.
- **Shared logic:** TypeScript fingerprint, Safe payment decoder, verdicts and zod schemas, with parity tests against the real Guard.
- **Detector:** TypeScript and viem over a public mainnet RPC. Read-only.
- **Arkiv:** `@arkiv-network/sdk` on Rabdi; idempotent batch writes; key-paged bulk reads filtered by publisher.
- **Apps:** Vite and TypeScript, Safe Protocol Kit, Safe Apps SDK, viem, Anon-RPC's Nox route. Static pages on GitHub Pages with build attestations.
- **Chainlink CRE:** a Sentinel workflow in TypeScript compiled to WASM, plus an on-chain consumer that Pay reads.
- **AI:** Claude Code and Codex wrote most of the code under written rules (`AGENTS.md`). All plans, prompts and reports are in `docs/planning/`; `docs/AI_USAGE.md` says what AI generated and what people did.

## 5. Partner prizes

### 5.1 Arkiv: Build on Arkiv (from scratch)

> HexFence uses Arkiv as the open evidence layer for address poisoning. Our detector reads Ethereum mainnet USDT/USDC logs and writes each suspected pair as a `hexfence.poisoning.v1` entity on Rabdi with a 30-day expiry, and suspected follow-up payments as `hexfence.loss.v1`. Writes are idempotent: re-runs create 0 duplicates. The explorer and HexFence Pay read records in bulk by publisher with key paging, and never look up one address on a server, so reading evidence doesn't reveal which address a reader cares about. The one address-specific read is optional: on the Losses tab a reader can click to read a token balance held by a published lookalike, sent to the Ethereum RPC. The explorer re-checks any record against its Ethereum receipts in the browser. Today: 1,126 suspected poisoning records and 1 suspected loss record, published by 0x36141ba063390f0d91Af7a5a9dF8dc1d80D699ec. The explorer can already combine several publishers and show how many published each record; only one publisher exists today. Schema, friction, reach, why-Arkiv and how-we-use-it are in `/arkiv/`.

Links: https://github.com/Deven1305/hexfence/tree/main/arkiv, https://deven1305.github.io/hexfence/explorer/. The query is in the README ("Arkiv publisher + query").

### 5.2 Ethereum Foundation: Best CROPS App

> **Lead property: Security.** The rule lives in the account. HexFenceGuard refuses a lookalike of an approved payee even when our website, detector and Arkiv records are gone; our video shows a lookalike payment reverting with Pay out of the path.
> **C:** the Guard has no owner and no upgrade path, and needs no HexFence service. Anyone can run the detector and publish under their own wallet.
> **O:** MIT licence; everything builds from the repo; RPC endpoints are configurable.
> **P:** recipients are compared in the browser against bulk reads; no per-recipient lookup, no trackers; Pay's Sepolia reads go through the Nox mixnet by default and the page says which route is active.
> **S:** payees are approved only by Safe transactions; keys stay in the user's wallet; the demo Safe holds test funds only; limits are stated in the README.

EF places a project in one EF prize. Enter Best CROPS App only.

### 5.3 Chainlink: Best workflow with CRE

**Gate: paste this only after `sentinel/SIMULATION.md` holds the real output of a successful `cre workflow simulate` run.** As of 8c3c175 that file does not exist, so do not select Chainlink yet.

> HexFence Sentinel is a CRE workflow that watches Sepolia token-transfer logs for Safes using HexFence. It flags a zero-value transfer or incoming dust from an address that shares the fingerprint of the Safe's approved payee, reads the Safe's payees from the Guard in bulk, writes a report to our HexFenceAlerts consumer (0x97F6f25D51DD52565FF30D22286392686A1ED80F) and can notify Telegram. HexFence Pay reads the consumer and shows the alert as advisory. The Guard never reads alerts, so a missing or wrong alert cannot change what the Safe allows. Our simulation run is recorded in `sentinel/SIMULATION.md`.

## 6. Demo video

- 2:30 to 3:00, at least 720p, a person's own voice (no text-to-speech or AI voiceover).
- Script: `docs/DEMO.md`.
- Link: ‹VIDEO_URL›

## 7. Optional precision sentence

> In a random sample of 30 published records, ‹PRECISION›.

Delete this if no person checked the H9 rows.

## 8. Checklist before submitting

- [ ] No `‹…›` left in the text you paste
- [ ] Video 2:30–3:00, ≥720p, human voice, uploaded
- [ ] Partners: Arkiv + EF (CROPS) + Chainlink only if §5.3's gate is met
- [ ] `git log -p` search shows no keys or seed phrases
- [ ] `docs/planning/` holds every plan and prompt used
- [ ] `docs/AI_USAGE.md` names the human Guard reviewer, or says no human review was done
- [ ] Hindi described as "not yet reviewed by a native speaker" unless H10 is done
- [ ] Scripted payments described as scripted
