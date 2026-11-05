# HexFence: PROGRESS (the single source of truth for every agent and human)

> Agents: read this first; update it after EVERY task and commit it with the task. Only one agent works at a time.
> Status: ☐ todo · ▶ in progress · ✔ done · ⏸ waiting on humans

## Now
- **Current task:** T0
- **Agent working:** (none)
- **Last updated:** (time IST)
- **Tests:** contracts (not run yet) · packages (not run yet)
- **Next step for whoever comes next:** start T0

## Tasks (strict order)

| ID | Tier | Task | Done when | Status | Commit | Agent | Notes |
|---|---|---|---|---|---|---|---|
| T0 | P0 | Repo set-up. The layout from AGENTS.md, MIT LICENSE, `.gitignore`, `.env.example` (names only), the pnpm workspace, `contracts/` copied from 11_HexFence_Guard_reference, spec PDF + MD in `docs/planning/` | `cd contracts && npm i --legacy-peer-deps && npx hardhat test` → 13 passing; `pnpm i` works | ☐ | | | |
| T1 | P0 | Guard. Review the reference, keep its behaviour, document the Sepolia deploy in the README draft | 13 passing; deploy works once H1 is done | ☐ | | | Needs H1–H3 |
| T2 | P0 | `packages/shared`: `fingerprint()`, the Safe payment decoder (SafeTx typed data; `execTransaction` `0x6a761202`; `transfer` / `transferFrom`), the PoisoningEvidence zod schema | vitest green, including USDT→`0xdac11ec7`, USDC→`0xa0b8eb48`, zero→`0x00000000`, both addresses of the ready pair→`0x4e184120` | ☐ | | | |
| T3 | P0 | `apps/detector`: mainnet USDT/USDC Transfer logs (latest 7,200 blocks, 100-block windows), zero-value + dust rules → `evidence.jsonl` | Unit tests on fixture logs pass; a real run (needs H4) finds ≥5 pairs | ☐ | | | |
| T4 | P0 | Arkiv writer: `hexfence.poisoning.v1`, 30-day expiry, idempotent by `evidenceId`, publisher wallet; one README query | A re-run creates 0 duplicates; the query returns the records (needs H5) | ☐ | | | |
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
- [ ] **H1:** a testnet-only deployer key + `SEPOLIA_RPC_URL` in `.env` (never commit them)
- [ ] **H2:** deploy the guard: `cd contracts && npx hardhat run scripts/deploy.js --network sepolia` → paste the address below
- [ ] **H3:** in Safe{Wallet} on Sepolia, create a 1-of-1 demo Safe and fund it with test ETH. In Transaction Builder, one call per transaction: `setGuard(guard)`, then `approvePayee(P)`. Then the removal drill: `setGuard(0x0…0)` → re-enable. Paste the hashes below.
- [ ] **H4:** `MAINNET_RPC_URL` in `.env`
- [ ] **H5:** an Arkiv access key (hub.arkiv.network) + faucet tGLM for the publisher wallet; the `ARKIV_*` variables in `.env`
- [ ] **H6:** test HexFence Pay with a wallet on Sepolia
- [ ] **H7:** run the demo payments (L, B, P) and paste the tx hashes
- [ ] **H8:** record the video (2:30–3:00, ≥720p)
- [ ] **H9:** hand-label 30 detector outputs on Etherscan

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

## Session log (append one line per task or stop)

| Time (IST) | Agent | Task | Result | Commit |
|---|---|---|---|---|
