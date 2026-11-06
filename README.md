# HexFence

**A Safe Guard that refuses lookalike payments (deny by resemblance), with open address-poisoning evidence on Arkiv.** ETHGlobal Mumbai 2026.

HexFence detects address poisoning, publishes the evidence openly on Arkiv, warns you locally before you sign, and makes a protected Safe refuse to pay a lookalike of an approved supplier, even one nobody has ever reported, while new suppliers still work.

## Architecture
```
Ethereum mainnet USDT/USDC logs
        │
   apps/detector ── evidence.jsonl
        │ publish (idempotent, 30-day expiry)
        ▼
 Arkiv Rabdi testnet: hexfence.poisoning.v1 ──► apps/explorer (search, counts, Verify on Ethereum)
        │ bulk read
        ▼
   apps/pay (HexFence Pay): decode payment → read payees(safe) once → verdict → sign
        │ Safe transaction
        ▼
   HexFenceGuard on Sepolia: refuses a lookalike of an approved payee
```
- **`contracts/`:** `HexFenceGuard`, a Safe transaction guard with no owner and no upgrade path. A recipient that shares a fingerprint (first 4 + last 4 hex characters) with an approved payee, but is a different address, reverts with `LookalikeOfApprovedPayee`. Anyone else still goes through. The Guard reads nothing off-chain.
- **`packages/shared/`:** fingerprint, Safe payment decoder, verdict logic and evidence schema, with a parity test against the real Guard on 411 transactions.
- **`packages/arkiv/`:** the Arkiv schema, bulk readers and idempotent writer.
- **Real evidence and the synthetic test are separate.** Mainnet records are always status "suspected". The synthetic Sepolia L only ever gets "resembles your approved payee".

## What's new vs reused
**Built at this event:** the detector, the Arkiv schema and publisher, the explorer, HexFence Pay, and the shared decoder and verdict logic.

**Reused:**
- the reference `HexFenceGuard` and its tests, which are AI-generated and reviewed (see [docs/AI_USAGE.md](docs/AI_USAGE.md));
- Safe 1.4.1 contracts, Safe Protocol Kit, `@arkiv-network/sdk`, viem, zod, Hardhat, Vite, vitest.

| | Wallet warnings | Allowlist guards | Blocklists | **HexFence** |
|---|---|---|---|---|
| Enforced by the account | ✗ (UI, can be overridden) | ✓ | ✓ | **✓** |
| Stops a never-reported lookalike | ✓ in-app only | ✓ | ✗ | **✓** |
| New suppliers still work | ✓ | ✗ | ✓ | **✓** |
| Open evidence anyone can query | ✗ | n/a | ✗ (closed) | **✓ (Arkiv)** |

## Guard: deploy on Sepolia (test funds only)

The Guard is a Hardhat project in [contracts/](contracts/), tested against the real Safe 1.4.1 contracts.

```bash
cd contracts
npm install --legacy-peer-deps   # safe-contracts declares an old ethers peer; this is expected
npx hardhat test                 # 14 passing
```

1. Put a **testnet-only** key and a Sepolia RPC in the repo-root `.env` (git-ignored; names in [.env.example](.env.example)):
   ```
   SEPOLIA_RPC_URL=https://...
   DEPLOYER_PRIVATE_KEY=0x...
   ```
   Fund the deployer with a little Sepolia ETH.
2. Deploy. The script refuses to run on any chain other than Sepolia (11155111) and checks the Guard interface after deploying:
   ```bash
   cd contracts
   npx hardhat run scripts/deploy.js --network sepolia
   ```
3. To automate the isolated demo setup instead, run from `contracts/`:
   ```bash
   node scripts/setup-demo.js
   ```
   It reads `SEPOLIA_RPC_URL` and `DEPLOYER_PRIVATE_KEY` from the root `.env`, refuses
   every chain ID except 11155111, deploys the unchanged Guard and creates a 1-of-1
   Safe **1.4.1** through Safe's canonical Sepolia factory. It tops the Safe up to
   0.002 test ETH, executes `setGuard` and `approvePayee(P)`, then removes the Guard
   with `setGuard(0)` and re-enables it. Each is a separate real Safe transaction.
   **The deployer key is the Safe's only owner. The Pay wallet must use that same
   testnet-only key.** The owner EOA sends Safe's prevalidated owner signature (`v=1`); no transaction
   service or browser wallet is involved. Output contains only public addresses,
   transaction hashes and `VERSION()`, as Markdown rows for the PROGRESS table.

   To reuse a deployment, put `VITE_GUARD_ADDRESS` and `DEMO_SAFE_ADDRESS` in the
   root `.env` before rerunning. Supplied contracts are checked, deployments are
   skipped, existing payee approval is retained and funding only tops up a deficit.
   A deterministic owner-based salt also reuses the Safe without a supplied address.
   Without `VITE_GUARD_ADDRESS`, a new Guard is deployed; reuse the printed address
   on subsequent runs. A Safe with a different active Guard is refused. The removal
   drill intentionally runs again and costs gas on each run. Keep the printed hashes.
   Do not run the separate deploy command first unless reusing its Guard address.

   Local regression test (chain ID 11155111, real Safe release contracts, no `.env`):
   ```bash
   npx hardhat test --config scripts/setup-demo.hardhat.js scripts/setup-demo.test.js
   ```
   API references: [Safe signatures](https://docs.safe.global/advanced/smart-account-signatures),
   [canonical deployments](https://github.com/safe-global/safe-deployments).

4. For the **human Safe{Wallet} UI drill**, use an **isolated 1-of-1 demo Safe** holding test ETH only. Check the Safe's `VERSION()` (1.4.1 is what the tests use). Then in **Apps → Transaction Builder**, send **one call per transaction**. A batch uses a MultiSend delegatecall, and the Guard refuses delegatecalls. The script does not replace this human UI check.
   1. To the Safe: `setGuard(<guard address>)`. It reverts with `GS300` if the interface check fails.
   2. To the Guard: `approvePayee(<P>)`.
   3. **Removal drill:** to the Safe, `setGuard(0x0000000000000000000000000000000000000000)`, which must succeed. Then re-enable with step 1.

| Item | Value |
|---|---|
| HexFenceGuard (Sepolia) | `0xA061fB511D69e5c92E50E3BE5c789472d6f19748` |
| Demo Safe + `VERSION()` | `0x3BCc3969713778F3Ed26AE1490529eeBAD43FbD5` · `1.4.1` |
| `setGuard` / `approvePayee(P)` | `0x2de356a6c196cb3f2040e3b8d4170ebe0cbc1b2684b0c05e26344756db6278e9` / `0x13baea5038b830810e1a9f68fbed3ae1069f981af4810cbd43c50f7b0d7d1af2` |
| Removal drill `setGuard(0)` / re-enable | `0x5edf08eb6489d78c13f0748283e43bab8c015c851d0d40e86b030dd6794ad8e0` / `0xd1c7db48a18647713c34384afc51b116888546dd837359eecad0938a5ebe9743` |
| L payment (reverted) / B payment / P payment | `0xa43b0eeef7253281a741deca144e5ddf0c465da9cc6f48d54673a9aa9c0f6d8f` / `0x2455ca8f1ce612149f15e80325f372202bffeb0258f808bd84acfb1f904de5ca` / `0xea209e9e3c5a9eed080e95dd0ca752b79686400da820ea67b87f98552d2992df` |

### Synthetic demo pair (not a real attack)
`node contracts/scripts/make-lookalike-pair.js` finds two keys whose addresses share a fingerprint (a birthday search, usually 1–2 minutes). We use this ready-made pair **as recipients only**:
- fingerprint `0x4e184120`
- **P** (approved payee) `0x4E185e251Ac7fB83E9DE10723EAda46cadE74120`
- **L** (lookalike) `0x4E185a3FC4B530244aB9ed0dE38167b403344120`

## Run steps
Needs Node 22 and pnpm (`corepack enable`, or prefix commands with `corepack pnpm@10.34.9`). Copy [.env.example](.env.example) to `.env` in the repo root. It lists every name, and `.env` is git-ignored. Use testnet keys only.

```bash
pnpm install
pnpm -r test     # all workspace tests
pnpm -r build    # type-check and build
```

**Detector** (read-only on mainnet; needs `MAINNET_RPC_URL`, and the public `https://ethereum-rpc.publicnode.com` works):
```bash
pnpm --filter @hexfence/detector detect                         # latest 7,200 blocks → out/evidence.jsonl
pnpm --filter @hexfence/detector publish:arkiv --limit 25       # needs ARKIV_PRIVATE_KEY and tGLM; a re-run creates 0
```

**Explorer** (`VITE_ARKIV_PUBLISHER`; `VITE_MAINNET_RPC_URL` for Verify on Ethereum; optional `VITE_ARKIV_ACCESS_KEY`):
```bash
pnpm --filter @hexfence/explorer dev
pnpm --filter @hexfence/explorer build    # dist/ works from any path on static hosting
```

**HexFence Pay** (`VITE_GUARD_ADDRESS`, `VITE_SEPOLIA_RPC_URL`, a browser wallet on Sepolia; optional `VITE_ARKIV_PUBLISHER` turns on the "listed in public evidence" signal, and without it the page says the signal is off):
```bash
pnpm --filter @hexfence/pay dev
pnpm --filter @hexfence/pay build
```

The `VITE_*` values end up in the public bundle, so never put a secret in one. Restrict an Arkiv access key to your origins at hub.arkiv.network.

## Arkiv publisher + query
Schema: [arkiv/schema.md](arkiv/schema.md) (Rabdi testnet, chain 7794095, `hexfence.poisoning.v1`, 30-day expiry). Also see [why-arkiv](arkiv/why-arkiv.md), [how we use it](arkiv/how-you-use-arkiv.md), [friction](arkiv/friction.md) and [reach](arkiv/reach.md).

- **Publisher wallet:** `0x36141ba063390f0d91Af7a5a9dF8dc1d80D699ec`

One query judges can run, with `P` set to the publisher wallet:
```bash
cd packages/arkiv
P=0x36141ba063390f0d91Af7a5a9dF8dc1d80D699ec pnpm exec tsx -e 'import("./src/index.ts").then(async ({ arkivReadClient, fetchAllEvidence }) => { const r = await fetchAllEvidence(arkivReadClient(), process.env.P); console.log(r.length, "records", r[0] ?? ""); })'
```

## Live links
- Explorer: https://deven1305.github.io/hexfence/explorer/
- HexFence Pay: https://deven1305.github.io/hexfence/pay/

## CROPS
- **C:** The Guard is non-upgradeable and has no owner. It keeps refusing lookalikes even if our detector, explorer, client and Arkiv records all disappear. The detector is open source: anyone can run it and publish under their own wallet.
- **O:** MIT licence. Everything builds and runs from the repo, and RPC endpoints are configurable.
- **P:** The client checks recipients locally, without sending payment-specific threat lookups to a security provider. It reads the Safe's payees in bulk. There are no trackers.
  - **RPC reads:** Pay tries Nox (Sphinx mixnet) for its Sepolia RPC reads and shows the active route. During start-up, Safe and payee reads wait: wait for the route status, or choose **Skip: read directly (not anonymous)**. A failed start-up uses a labelled direct fallback, which is not anonymous. Once Nox is active, later read failures surface as errors and do not silently switch to direct.
  - **Not covered by Nox:** the one bootstrap read of the routing contract and the Arkiv bulk reads are direct, and signing and sending still go through the wallet.
  - **Still visible:** your wallet, Safe's transaction service (when you use the Safe UI) and the public chain all see the payment.
- **S (lead property):**
  - the account enforces the rule;
  - payees are approved only by owner-signed Safe transactions;
  - duplicate fingerprints are rejected;
  - delegatecall fails closed;
  - removal is tested through real Safe transactions, but not guaranteed;
  - the demo Safe is isolated and holds test funds only;
  - the limits are stated.

## Limits
- Nox covers the configured Sepolia RPC read route only (see CROPS, P). Hosted Nox and Guard or payee reads through Nox are untested. Nox start-up took about 9 seconds in one browser check and more than 20 seconds (not timed) in another; neither is a benchmark.
- Module transactions bypass transaction guards.
- MultiSend is refused (it's a delegatecall).
- Only ETH, `transfer` and `transferFrom` are inspected; other calls are allowed and clients show "cannot verify".
- A 4+4 fingerprint doesn't catch weaker lookalikes.
- Evidence covers only Ethereum mainnet USDT and USDC, and every record is "suspected", not a finding about any person.
- Detector output has no hand-labelled precision figure yet (T13 is waiting on the human labels).
- Safe warns that a broken guard can lock a Safe: the demo Safe is isolated, holds test funds only, and the removal drill is tested.

## Licence
MIT, see [LICENSE](LICENSE).
