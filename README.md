# HexFence

**A Safe Guard that refuses lookalike payments (deny by resemblance), with open address-poisoning evidence on Arkiv.** ETHGlobal Mumbai 2026.

> Draft. Sections marked *(T7)* are filled in by task T7; tx hashes are filled in after the Sepolia run (T8).

HexFence detects address poisoning, publishes the evidence openly on Arkiv, warns you locally before you sign, and makes a protected Safe refuse to pay a lookalike of an approved supplier, even one nobody has ever reported, while new suppliers still work.

## Architecture *(T7)*
Detector (Ethereum mainnet) → Arkiv (`hexfence.poisoning.v1`) → client (HexFence Pay) → `HexFenceGuard` on Sepolia.

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
3. In **Safe{Wallet}** on Sepolia, use an **isolated 1-of-1 demo Safe** holding test ETH only. Check the Safe's `VERSION()` (1.4.1 is what the tests use). Then in **Apps → Transaction Builder**, send **one call per transaction**. A batch uses a MultiSend delegatecall, and the Guard refuses delegatecalls.
   1. To the Safe: `setGuard(<guard address>)`. It reverts with `GS300` if the interface check fails.
   2. To the Guard: `approvePayee(<P>)`.
   3. **Removal drill:** to the Safe, `setGuard(0x0000000000000000000000000000000000000000)`, which must succeed. Then re-enable with step 1.

| Item | Value |
|---|---|
| HexFenceGuard (Sepolia) | *(after deploy)* |
| Demo Safe + `VERSION()` | *(after set-up)* |
| `setGuard` / `approvePayee(P)` | *(tx hashes)* |
| Removal drill `setGuard(0)` / re-enable | *(tx hashes)* |
| L payment (reverted) / B payment / P payment | *(tx hashes)* |

### Synthetic demo pair (not a real attack)
`node contracts/scripts/make-lookalike-pair.js` finds two keys whose addresses share a fingerprint (a birthday search, usually 1–2 minutes). We use this ready-made pair **as recipients only**:
- fingerprint `0x4e184120`
- **P** (approved payee) `0x4E185e251Ac7fB83E9DE10723EAda46cadE74120`
- **L** (lookalike) `0x4E185a3FC4B530244aB9ed0dE38167b403344120`

## Run steps *(T7)*
## Arkiv publisher + query *(T4)*
## CROPS *(T7)*

## Limits
- Module transactions bypass transaction guards.
- MultiSend is refused (it's a delegatecall).
- Only ETH, `transfer` and `transferFrom` are inspected; other calls are allowed and clients show "cannot verify".
- A 4+4 fingerprint doesn't catch weaker lookalikes.
- Safe warns that a broken guard can lock a Safe: the demo Safe is isolated, holds test funds only, and the removal drill is tested.

## Licence
MIT, see [LICENSE](LICENSE).
