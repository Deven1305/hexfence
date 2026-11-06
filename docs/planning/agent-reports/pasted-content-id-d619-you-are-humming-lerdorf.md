# Lane B (HexFence Pay): Sonnet session plan

## Plain-language summary

**What we are building.** HexFence stops a specific scam. A scammer creates a wallet address whose start and end match someone you really pay, hoping you copy the wrong one. HexFence Pay is the website where a Safe (shared crypto account) owner sends a payment. Before anything is signed, it compares the recipient with the Safe's approved list and shows a coloured verdict. Separately, a contract on the Safe (the Guard) refuses the lookalike payment on the blockchain, even if our website is not involved.

**What changes, in order:**
1. **Your local copy** is updated from GitHub. It is 31+ commits behind and has none of the lane documents yet.
2. **A new Sonnet session starts** as the only Lane B builder. It first reads the documents and tells me what it understood, without writing code. I check that against this plan, then tell it to go. I do not build anything myself.
3. **The Pay website (`apps/pay/`) is created.** It connects a wallet, loads a Safe, builds an ETH or token payment, shows the verdict, makes you type 6 characters on a red warning, then signs and sends. It also shows why the blockchain refused a payment.
4. **Public scam evidence check (T10, same folder).** It downloads all the evidence once and warns if the exact address is listed.
5. **Private reads (T11, same folder).** The website's blockchain reads go through an anonymising network, and the screen says so if it has to fall back.
6. **Hindi (T12, same folder).** A language switch shows the two Hindi warnings the spec provides.
7. **Lane paperwork.** `docs/PROGRESS.md` (Lane B's rows only) and `docs/lanes/LANE_B_claude2.md` (log, next step) are updated after each task. `pnpm-lock.yaml` changes because of new packages, and `.env.example` gains new setting names only.
8. **GitHub.** Work is pushed to `lane-b`, and finished work goes up as pull requests for a person to merge. Nothing is committed to `main` by the agent.

Nothing else changes: no contracts, no shared packages, no explorer, no interface file.

**What you still have to do:** merge the T6 pull request before the 14:00 gate, create `.env`, run the manual Sepolia test (H6), and get a native speaker to check the Hindi.

---

## Context

- **Time:** Fri 6 Nov, ~02:10 IST. Gate is Fri 14:00; submission Sat 09:00.
- **State of the repo:** `@hexfence/shared` (S1) and the `@hexfence/arkiv` read side (S2) are on `origin/main`, so T6b and T10 are unblocked. Guard is not deployed yet (S3, H1 to H3). This laptop has no `.env`, Node 22.14, no pnpm. `gh` is logged in as `dhruv4740` with WRITE access to `Deven1305/hexfence`.
- **Spec check:** the Downloads PDF is byte-identical to `docs/planning/10_FINAL...pdf`. `deep-research-report (2).md` predates the v4 lock, so it is not binding and its scope stays out.

## Decisions

| Conflict | Decision | Source |
|---|---|---|
| Lane plan says merge to `main`; global rule says never commit to `main` | **PRs only.** The agent never commits to or merges into `main` | Your answer |
| Spec says no P1 before gate; lane order runs into T10 | **Keep building P1 on `lane-b`, hold it out of `main`.** T6 gate bugs preempt P1. P1 PRs stay draft until T8 is ✔ | You left it to me; chosen so no time is lost and `main` stays gate-clean |
| Your paste says Dhruv should test Safe interception first; PROGRESS says the 01:00 deadline passed and Plan B was chosen | **Build Pay.** No interception spike. PROGRESS allows a swap only if interception was already verified; I found no evidence of that | Lane prompt + Decisions log |
| Repo `CLAUDE.md` bans subagents | Sonnet session **is** the single Lane B agent; this session stops touching git and `apps/pay/`. It spawns no subagents | Your instruction |
| `[B] T<n>:` vs Conventional Commits | `[B] T<n>: ...` for this repo | Your paste |

**PR mechanics.** `lane-b` keeps moving, so a PR opened directly from it would absorb later P1 commits. When a task's code is done, push a frozen snapshot and PR from that:
`git push origin lane-b:refs/heads/feat/pay-t6` then `gh pr create --base main --head feat/pay-t6`. T10, T11 and T12 do the same as drafts until T8 is ✔. No auto-merge. Record this exception in the lane log, since `docs/PARALLEL_PLAN.md` itself can't be edited.

## Steps

### This session
1. `git pull --ff-only` on `main`, as you asked.
2. Load `start_session`; start with `initiation: "user_asked"`, `model: "sonnet"`, `context: "fresh"`, `use_worktree: false`. One session for T6 to T12, continued with `SendMessage`.
3. Sonnet's first turn: read docs, then reply with ~10 lines of understanding + its T6a plan, no code. I check it against the "Must-haves" below, correct it if needed, send go.
4. As task notes arrive: check the result, not just the note, and check usage for the lane's 5% stop rule. Otherwise idle.

### Sonnet session, setup
- `git fetch origin && git checkout lane-b && git pull --rebase && git merge --no-edit origin/main`. The pasted prompt is the older version; `docs/AGENT_PROMPTS.md` has the current one.
- `corepack enable` may need admin rights here. Use `corepack pnpm@10.34.9 install` (or `npm i -g pnpm@10.34.9`). Matches `packageManager` in the root `package.json`.
- Before every commit: `git pull --rebase`, `git merge --no-edit origin/main`. After every task: push `lane-b`.
- On `pnpm-lock.yaml` conflict during that merge: `git checkout --theirs pnpm-lock.yaml`, `pnpm install`, commit.
- **`docs/PROGRESS.md` will conflict even with clean row discipline:** T6 sits between Lane C's T5 and T7, and T10 to T12 between T9 and T13, and git treats adjacent line edits as conflicts. Resolve by keeping each lane's own row.
- Decisions go in the lane file or Lane B's own row notes, not the PROGRESS Decisions log (Lane A's section).

### T6a, T6b (P0)
Vanilla TypeScript + Vite, no UI framework. Suggested files under `apps/pay/src/`: `config.ts`, `rpc.ts`, `safe.ts`, `payment.ts`, `verdictCopy.ts`, `friction.ts`, `revert.ts`, `main.ts`. Set Vite `envDir: "../.."` because `.env` lives in the repo root.

Flow: connect wallet (EIP-6963, then `window.ethereum`) → Sepolia check → enter Safe → read guard + `payees(safe)` once → build payment → `decodeSafeCall` → `verdictFor` → verdict → friction if RED → sign → simulate → execute → show hash + decoded result.

**Must-haves (Sonnet is likely to miss these):**

1. **Force the lookalike payment on-chain.** Read from Protocol Kit source: `execTransaction` calls `estimateGas` unless `options.gasLimit` is set. The Guard reverts during estimation, so without a gas limit no transaction is sent, there is no reverted hash, and demo ① fails.
   - After signing, simulate with the viem public client: `getEncodedTransaction(signedTx)` then `call`, and decode with `decodeErrorResult({ abi: hexFenceGuardAbi })`. Simulate after signing because (from memory, confirm in the Safe source) Safe checks signatures before the Guard.
   - Do not use `isValidTransaction`: its source catches every error and returns `false`, losing the reason.
   - If the decoded error is `LookalikeOfApprovedPayee`, call `executeTransaction(tx, { gasLimit: 200_000 })` (measured cost ~68k).
   - Any other revert: show the reason, do not send.
   - Also confirm `createTransaction` doesn't trigger the Guard during its own gas handling.
2. **Check the Guard before claiming protection** (point 3 of your review). `safe.getGuard()` must equal `VITE_GUARD_ADDRESS`.
   - Active: show the §3.4 strings exactly.
   - Not active: "Your protected Safe will refuse this payment" would be false. Show the first two sentences verbatim and replace the last with a separate state saying the Guard isn't active on this Safe. Friction stays. Log this as the one deviation from the fixed strings.
   - A Safe too old to support guards counts as not active.
3. **One read layer from day one, so T11 is a one-file change.** One viem public client: `http(VITE_SEPOLIA_RPC_URL, { fetchFn })`. Give Protocol Kit a composite EIP-1193 provider: accounts, signing and sending go to the injected wallet; everything else goes to that client. Check how `SafeProvider` uses the provider before relying on this.
4. **No trackers or leaks:** leave `onchainAnalytics` unset and don't use `api-kit` / the Transaction Service. Never call `isApprovedPayee` or `payeeByFingerprint` per recipient.
5. **Copy rules:** UI text never uses "safe" as an adjective, or "verified", "scam", "malicious". "Safe" the product is fine. Unit test scans all UI strings.
6. **Friction:** last 6 hex characters, case-insensitive. Test vector: L must take `344120` and refuse P's `E74120`. Applies to both RED reasons. Reject cancels with no wallet prompt.
7. **No mocks:** token address comes from the user, `decimals()` read on-chain. Missing env values produce a clear error, never a fallback to invented payees or tokens.
8. **Honest limits:** no universal protection claims. Modules, MultiSend and weaker lookalikes are not covered (review point 2, spec §3.1).

Done when: unit tests cover string selection (all five signals), friction, decoded-revert handling, payment building; UI opened in the built-in browser with a screenshot described (no wallet there, so it covers layout and error states only). Then row ⏸ on H6, write exact H6 steps in the lane file, open the T6 PR.

### T10 (P1): listed signal
`fetchAllEvidence` once in bulk → `Map<lowercase address, evidenceIds>` → `verdictFor(..., listed)`.
- **Key the map on `lookalike` only.** `victim` and `impersonated` are innocent parties; including them would flag your real payee as RED.
- Arkiv read failure gets a labelled "evidence unavailable" state, never implied clean.
- "See the explorer" link: add `VITE_EXPLORER_URL` to `.env.example` under a Lane B section, plain text if unset.
- Test: listed address → RED listed; L → only RED resembles.

### T11 (P1): Anon-RPC
`@anon-rpc/browser-harness` 0.4.0. Pass `worker.fetch` as the read layer's `fetchFn`. Facts from the official `adopters.json5` + wallet guide:
- **Never use the passthrough specifier `0x4fd7...8d27` as "Anon-RPC".** The docs' quick-start example uses it, and it anonymises nothing. Labelling it private would break the "nothing fake" rule.
- Try in order, with the first that works live in the browser becoming default:
  - **Nox** `0x35133267A8F7EC35046a83DCA0f4Ca8A6e1b7A9A` (specifier on Sepolia, so bootstrap uses an RPC we already have);
  - **tor-js** `0x700dA3193D35fA54Cd3fBf29B66f2a2A0385659e` (mainnet bootstrap; demo gateway "may disappear");
  - **Nym** `0x3aCD9742C68F6d993066Ae25533e09b9e1f60eD0` (mainnet bootstrap; ~18 MB bundle).
- The UI labels the active route and the fallback. Some RPC providers refuse Tor traffic. The one bootstrap read is not anonymised; say so. Wallet signing and sending still go through the wallet.
- If none works here, T11 stays ⏸ with what was tried. Don't fake it.

### T12 (P1): Hindi
Toggle with English one tap away. The spec has Hindi for **only RED resembles and AMBER**; do not invent the others, which stay English. Row stays ⏸ until a native speaker checks.

### Before marking any task ✔
`cd contracts && npx hardhat test`; `pnpm -r test`; `pnpm -r build`. AGENTS.md requires all three.

## Verification

| Check | Who | Covers |
|---|---|---|
| The three commands above | Sonnet | Logic, types, no regressions |
| Browser run + screenshot | Sonnet | Layout, error states, Anon-RPC route |
| H6: L reverts, B succeeds, P succeeds on Sepolia with a real wallet | **You**, after S3 | Signing, on-chain revert, the explicit-gas path |
| T8 gate | Humans + all lanes | End to end |

**Can't be verified before H6:** whether your wallet lets you send a transaction it predicts will fail, even with gas supplied. I expect a warning you can click through, but that is a guess. Run H6 as early as S3 allows, because demo ① depends on it.

## What breaks if this is wrong

- **Wallet blocks the reverting send:** the app still shows the decoded refusal but no on-chain hash, so demo ① needs another wallet or Safe{Wallet}.
- **Composite provider confuses Protocol Kit:** fall back to giving it the injected provider and label that those reads go through the wallet, not Anon-RPC. T11's claim narrows.
- **No Anon-RPC worker works from here:** T11 stays open. Only the EF Anon-RPC track is affected; the gate isn't.
- **`feat/pay-*` PRs wait on a human:** if nobody merges T6 before 14:00, the gate has no client on `main`.

## Notes for other lanes (no Lane B action)

- **Lane A / Baqir:** Etherscan names `LookalikeOfApprovedPayee` only if the Guard is verified there (my understanding, not tested). Verify it at deploy for demo ①.
- **Team:** review item 1 (reference Guard written after kickoff) is a human eligibility check. I can't settle it from here.
- **Demo step 5** (pay L with the client off) goes through Safe{Wallet}, not Pay, so Lane C's demo script should say so.
- **OneDrive:** the repo lives in a OneDrive folder. OneDrive wasn't running when I checked, but syncing `node_modules` could cause trouble if it starts. That's a guess, not something I tested.
