# HexFence: PROGRESS (the single source of truth for every agent and human)

> **PARALLEL MODE (3 lanes):** see `docs/PARALLEL_PLAN.md`. Lane A (Claude #1, this laptop): T2, T4a, T3, T4b, T1, T13. Lane B (Claude #2): T6, T10, T11, T12. Lane C (Codex): T5, T9, T7, demo. Each agent updates **only its own task rows** here, and writes its session log in `docs/lanes/LANE_*.md`. The H-boxes and addresses here are for the humans and Lane A.
> Status: ☐ todo · ▶ in progress · ✔ done · ⏸ waiting on humans

## Now
- **Current task:** T13 prep (Lane A); T4b ⏸ H5, T1 ⏸ H1+H2
- **Agent working:** Claude Code
- **Last updated:** 06 Nov 02:16 IST
- **Tests:** contracts 14 · `@hexfence/shared` 33 (incl. 411-case Guard parity) · `@hexfence/arkiv` 4 (+2 live) · `@hexfence/detector` 11 (+1 live)
- **Next step for whoever comes next:** humans: **H5** first (it unblocks the gate's real evidence, T5 and T10), then H1–H3. Lane A: T13 labelling sheet, then T4b live as soon as H5 is ticked.

## Tasks (strict order)

| ID | Tier | Task | Done when | Status | Commit | Agent | Notes |
|---|---|---|---|---|---|---|---|
| T0 | P0 | Repo set-up. The layout from AGENTS.md, MIT LICENSE, `.gitignore`, `.env.example` (names only), the pnpm workspace, `contracts/` copied from 11_HexFence_Guard_reference, spec PDF + MD in `docs/planning/` | `cd contracts && npm i --legacy-peer-deps && npx hardhat test` → 13 passing; `pnpm i` works | ✔ | 545ac36 | Claude Code | MIT LICENSE was already on GitHub (kept). Root `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `.env.example`, `.gitattributes` (LF). Package dirs are created by their own tasks. Tested on Node 20.20 (Node 22 not installed on the driver laptop; see Decisions log). |
| T1 | P0 | Guard. Review the reference, keep its behaviour, document the Sepolia deploy in the README draft | 13 passing; deploy works once H1 is done | ⏸ | ba07540 | Claude Code | Reviewed: logic matches §3.1, unchanged. Added: Hardhat loads root `.env`; `deploy.js` refuses non-Sepolia chains and checks `supportsInterface(0xe6d7a83a)`; a test for the ready-made §3.5 pair → **14 passing**. README draft has the deploy + Safe{Wallet} steps. ⏸ only for the live deploy (H1, H2); H3 is needed by T8. |
| T2 | P0 | `packages/shared`: `fingerprint()`, the Safe payment decoder (SafeTx typed data; `execTransaction` `0x6a761202`; `transfer` / `transferFrom`), the PoisoningEvidence zod schema | vitest green, including USDT→`0xdac11ec7`, USDC→`0xa0b8eb48`, zero→`0x00000000`, both addresses of the ready pair→`0x4e184120` | ✔ | 90f8b05 | Claude Code | Implements `docs/INTERFACES.md` exactly: `fingerprint`, `sameFingerprint`, `SafeCall`, `safeCallFromTypedData`, `safeCallFromExecTransaction`, `decodeSafeCall`, `verdictFor`, `hexFenceGuardAbi`, `PoisoningEvidence` + `PoisoningEvidenceSchema`, `evidenceId`, `MAINNET_USDT/USDC`. **30 vitest** (vectors, the Guard's decode cases, every verdict branch, 200 random junk calldata blobs, ABI vs compiled artifact). Import from `@hexfence/shared` (`workspace:*`); it exports TS source, so Vite and tsx consume it directly. |
| T3 | P0 | `apps/detector`: mainnet USDT/USDC Transfer logs (latest 7,200 blocks, 100-block windows), zero-value + dust rules → `evidence.jsonl` | Unit tests on fixture logs pass; a real run (needs H4) finds ≥5 pairs | ✔ | aaa233c | Claude Code | `@hexfence/detector`: streaming `PoisoningDetector` (zero-value + dust rules, 7,200-block window, block/log order), 100-block `getLogs` windows that halve on RPC errors, `out/evidence.jsonl` merged by `evidenceId`. 11 unit tests on fixture logs. **Real run 06 Nov 02:06 IST (blocks 26343865–26351064, public RPC `https://ethereum-rpc.publicnode.com`, no key needed): 1,330,446 logs → 43,227 suspected pairs** (31,801 zero-value, 11,426 dust; 26,532 victims). Live check: **40/40 random records confirmed against mainnet receipts** (`DETECTOR_LIVE=1`). Run: `pnpm --filter @hexfence/detector detect`. |
| T4 | P0 | Arkiv writer: `hexfence.poisoning.v1`, 30-day expiry, idempotent by `evidenceId`, publisher wallet; one README query | A re-run creates 0 duplicates; the query returns the records (needs H5) | ⏸ | d56bee3 | Claude Code | **T4a ✔ (read side, S2):** `@hexfence/arkiv` exports `PoisoningSchema`, `arkivReadClient`, `fetchAllEvidence`, `findEvidenceByAddress` (createdBy + key paging, ≤100 rows/page, every row re-validated); `arkiv/schema.md`. **T4b code done:** `writeEvidence` (idempotent single write), `publishEvidence` (one bulk read of what the publisher has, then `executeBatch` of 25 creates, 30-day expiry), CLI `pnpm --filter @hexfence/detector publish:arkiv [--limit N]` with a tGLM balance check. Dry run on live Rabdi with an unfunded throwaway key got through the reads and stopped only at the balance ("total cost … exceeds the balance"). **⏸ on H5** for the live publish + duplicate re-run. |
| T5 | P0 | `apps/explorer`: a static Vite app reading Arkiv (search, Etherscan links, counts, label "Ethereum mainnet evidence · status: suspected") | Builds; shows real records | ☐ | | | |
| T6 | P0 | `apps/pay` (HexFence Pay): connect a wallet, load the Safe (Protocol Kit), build an ETH/ERC-20 payment, read `guard.payees(safe)` once, verdicts RED/AMBER/GREEN/GREY with the exact spec strings, 6-character friction, sign + execute | Unit tests for the verdict logic pass; manual Sepolia test (H6) | ☐ | | | |
| T7 | P0 | Docs draft: README (run steps, architecture, **CROPS**, limits), `arkiv/*.md` (5 files), `docs/AI_USAGE.md` (from the session log) | Real content; placeholders only for tx hashes | ☐ | | | |
| T8 | GATE | End to end on Sepolia: L reverts, B succeeds, P succeeds, removal-drill hashes recorded, the explorer shows real evidence | Every hash in the table below (H7) | ☐ | | | |
| T9 | P1 | Explorer "Verify on Ethereum" (receipt check) | ✓ on a real record; "could not verify" on a broken one | ☐ | | | |
| T10 | P1 | HexFence Pay: the "listed in public evidence" signal (exact match, bulk Arkiv read) | Test: a listed address → RED listed; the synthetic L → only RED resembles | ☐ | | | |
| T11 | P1 | Anon-RPC for the client's RPC reads (`@anon-rpc/browser-harness`), with a labelled fallback | The demo shows reads going through Anon-RPC | ☐ | | | |
| T12 | P1 | Hindi strings in the verdict | A native speaker has checked them | ☐ | | | |
| T13 | P1 | ≥20 pairs + precision on 30 hand-labelled samples | The numbers are in the README | ☐ | | | Needs H9 |
| T14 | P2 | Chrome extension (Plan A). Only if every task above is ✔ | | ☐ | | | |

## Waiting on humans (tick the box when done; then the agent continues)
- [ ] **H1:** `cp .env.example .env` in the repo root. Fill `SEPOLIA_RPC_URL` (e.g. an Alchemy/Infura Sepolia URL) and `DEPLOYER_PRIVATE_KEY` (a **new, testnet-only** key: `node -e "console.log(require('ethers').Wallet.createRandom().privateKey)"` from `contracts/`). Send ~0.05 Sepolia ETH to it from a faucet. Never commit `.env`.
- [ ] **H2:** `cd contracts && npx hardhat run scripts/deploy.js --network sepolia`. It prints `HexFenceGuard deployed at: 0x…` and `Deploy tx: 0x…`; paste both into the table below and into `.env` as `VITE_GUARD_ADDRESS`.
- [ ] **H3:** in Safe{Wallet} on Sepolia, create a 1-of-1 demo Safe and fund it with test ETH. In Transaction Builder, one call per transaction: `setGuard(guard)`, then `approvePayee(P)`. Then the removal drill: `setGuard(0x0…0)` → re-enable. Paste the hashes below.
- [ ] **H4:** `MAINNET_RPC_URL` in `.env`. *Not blocking:* T3 ran on the free public RPC `https://ethereum-rpc.publicnode.com`; put your own RPC here only if that one rate-limits you.
- [ ] **H5 (blocks T4b, the gate's "real evidence on Arkiv", T5 and T10):**
  1. Make a NEW testnet-only publisher key: `cd packages/arkiv && node -e "const a=require('viem/accounts');const k=a.generatePrivateKey();console.log('key',k);console.log('address',a.privateKeyToAccount(k).address)"`. Put the key in `.env` as `ARKIV_PRIVATE_KEY` (never commit it); keep the address.
  2. Get an access key at https://hub.arkiv.network/access-keys → `.env` as `ARKIV_ACCESS_KEY`.
  3. Fund the address at https://hub.arkiv.network/faucet (tGLM on Rabdi).
  4. Tell Lane A "H5 done, publisher 0x…". Lane A then runs `pnpm --filter @hexfence/detector publish:arkiv --limit 25`, re-runs it (must say `0 created`), measures the cost per batch, and decides the publish scope.
- [ ] **H6:** test HexFence Pay with a wallet on Sepolia
- [ ] **H7:** run the demo payments (L, B, P) and paste the tx hashes
- [ ] **H8:** record the video (2:30–3:00, ≥720p)
- [ ] **H9:** hand-label 30 detector outputs on Etherscan
- [ ] **H10 (T12):** a native Hindi speaker checks the two Hindi verdict lines in HexFence Pay and writes "checked by <name>" in the T12 row.
- [ ] **H11 (submission):** host the two static apps and paste the URLs in the table below: `pnpm --filter <explorer|pay> build`, then upload each `dist/` to static hosting (e.g. Vercel or GitHub Pages; set the `VITE_*` values in the host's env). Spec §8 needs both live links.
- [ ] **H12 (submission):** commits from **all four** accounts (spec §8). Baqir: commit the Sepolia addresses/hashes (H2, H3, H7). Akshat: a README/CROPS review commit. Also copy every GPT/Claude plan, prompt and report you used into `docs/planning/`.

## Addresses and tx hashes (public values only)

| Item | Value |
|---|---|
| HexFenceGuard (Sepolia) | |
| Demo Safe (Sepolia) + `VERSION()` | |
| P (approved payee) / L (lookalike) / B (new supplier) | P `0x4E185e251Ac7fB83E9DE10723EAda46cadE74120` · L `0x4E185a3FC4B530244aB9ed0dE38167b403344120` · B (fill in) |
| `setGuard` / `approvePayee(P)` | |
| Removal drill `setGuard(0)` / re-enable | |
| L payment (reverted) / B payment / P payment | |
| Arkiv publisher wallet + README query | |
| Explorer URL / HexFence Pay URL | |

## Decisions log
- 06 Nov: the P0 client is **HexFence Pay** (Plan B). Extension interception wasn't verified by the 01:00 checkpoint, so the extension moved to T14 (P2). If the team has already verified interception, swap T6 and T14 here.
- 06 Nov (Claude Code): **Arkiv SDK 1.0.1 differs from spec §3.2; following the docs.** (a) ~~There is no `createdBy(addr)`~~ **Correction (T4a):** `createdBy(addr)` does exist in 1.0.1 (shorthand for `eq("$creator", …)`) and is used. (b) A page holds **≤100** rows (not 200) and there is no `hasNextPage()`; page by key with `orderBy(asc("$key"))` + `gt("$key", key(last))`. (c) The SDK asks for Node ≥22.10.
- 06 Nov (Claude Code): the driver laptop has Node 20.20, not 22. Workspace `engines` is `>=20`; `.nvmrc` says 22. If the Arkiv SDK fails on Node 20, install Node 22 before running the detector.

- 06 Nov 02:16 (Claude Code): **The detector finds far more than the spec expected: 43,227 suspected pairs in 24 hours** (spec: ≥5 at the gate, ≥20 by submission). They look real: 40/40 random records confirmed against receipts; the share of 10-character matches is ~9× what chance gives (attackers grind longer matches); attack txs poison 170+ victims each; median 74 blocks from the real payment to the attack. **Open decision for T4b:** publishing all of them is ~1,730 `executeBatch` txs of 25 on Arkiv. Either publish all (if tGLM and time allow) or publish a clearly labelled subset and state the full count. Decide after H5 shows the cost per batch.
- 06 Nov 02:16 (Claude Code): added a **Guard ↔ client parity test**: `contracts/scripts/parity-vectors.js` records what the real `HexFenceGuard` does for 411 transactions; `packages/shared/test/parity.test.ts` checks that `verdictFor(decodeSafeCall(…))` predicts every one (RED resembles ⇔ `LookalikeOfApprovedPayee` with the same addresses; GREY delegatecall ⇔ `DelegateCallNotAllowed`; never RED when the Guard allows). A planted decoder bug made it fail, so it has teeth.

## Session log (append one line per task or stop)

| Time (IST) | Agent | Task | Result | Commit |
|---|---|---|---|---|
| 06 Nov 01:33 | Claude Code | T0 | ✔ contracts 13 passing; `pnpm i` works | 545ac36 |
| 06 Nov 01:35 | Claude Code | T1 | ⏸ review done, 14 passing; waiting on H1+H2 for the deploy | ba07540 |
