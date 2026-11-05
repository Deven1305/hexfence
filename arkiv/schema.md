# Arkiv schema: `hexfence.poisoning.v1`

One entity = one **suspected** address-poisoning attack seen on **Ethereum mainnet** (chain 1), written by the HexFence detector to the Arkiv **Rabdi testnet** (chain 7794095, `https://rpc.rabdi.db-chain.testnet.arkiv.network`).

Defined once in code: [`packages/arkiv/src/schema.ts`](../packages/arkiv/src/schema.ts) (`defineSchema`, `@arkiv-network/sdk` 1.0.1). Every record is also validated by `PoisoningEvidenceSchema` in [`packages/shared/src/evidence.ts`](../packages/shared/src/evidence.ts), both before it is written and after it is read.

## Columns

| Column | Arkiv type | Indexed | Meaning |
|---|---|---|---|
| `evidenceId` | `str` | ✓ | Idempotency key, see below |
| `chainId` | `dec` | ✓ | Where the attack happened. Always `1` (Ethereum mainnet) |
| `lookalike` | `addr` | ✓ | The attacker-controlled address that imitates `impersonated` |
| `impersonated` | `addr` | ✓ | The real recipient the victim paid before |
| `victim` | `addr` | ✓ | The account that was targeted |
| `variant` | `str` | ✓ | `zero-value`: `Transfer(victim → lookalike, 0)`, or `dust`: `Transfer(lookalike → victim, 0 < v < 1 token)` |
| `attackBlock` | `dec` | ✓ | Block of the attack transfer |
| `detectorVersion` | `str` | ✓ | Detector release that produced the record |
| `token` | `addr` |  | Mainnet USDT `0xdAC1…1ec7` or USDC `0xA0b8…eB48` |
| `attackTx` | `str` |  | Attack transaction hash |
| `referenceTx` | `str` |  | The victim's earlier real payment (≥ 1 token) to `impersonated` |
| `referenceBlock` | `dec` |  | Block of the reference payment (always ≤ `attackBlock`) |
| `prefixLen` | `dec` |  | Leading hex characters `lookalike` and `impersonated` share (≥ 4) |
| `suffixLen` | `dec` |  | Trailing hex characters they share (≥ 4) |
| `status` | `str` |  | Always `"suspected"`. Never "malicious" or "scammer" |

The named schema also tags every entity with the indexed system attribute `arkiv.schema = "hexfence.poisoning.v1"`.

**Why this split:** only indexed columns can be filtered on. The explorer searches by any of the three addresses, the writer looks up `evidenceId`, and the rest is stored for display and verification without paying for an index. There is deliberately **no confidence score**: the record carries the two transaction hashes, so anyone can check it on Ethereum.

## Match rule (what makes a record)
`fingerprint(a)` = the first 4 hex characters followed by the last 4 (`0x2ef9…8bf7` → `0x2ef98bf7`), the same function the on-chain Guard uses. A record is written when:
- `fingerprint(lookalike) == fingerprint(impersonated)` and `lookalike != impersonated`;
- the victim paid `impersonated` ≥ 1 token (the reference) **before** the attack (block, then log index), within 7,200 blocks;
- the attack is a zero-value or a dust transfer of the same token family (USDT/USDC).

## Idempotency
```
evidenceId = keccak256(abi.encode(uint256 chainId, address lookalike, address impersonated, string detectorVersion))
```
One lookalike of one address is one record per detector version, however many victims or transactions it involves. Before creating, the writer queries `where(eq("evidenceId", id))` + `createdBy(publisher)` and skips existing ones, so a re-run creates 0 duplicates.

## Expiry
`ExpirationTime.fromDays(30)`. Evidence older than a month is stale for warning purposes, and expiring keeps the dataset (and its cost) bounded.

## Reading it
Records are read **in bulk per publisher**: `createdBy(publisher)`, `orderBy(asc("$key"))`, pages of ≤ 100 rows (the SDK's `MAX_LIMIT`), continued with `gt("$key", lastKey)`. Clients never send a per-recipient lookup. Code: `fetchAllEvidence` / `findEvidenceByAddress` in [`packages/arkiv/src/read.ts`](../packages/arkiv/src/read.ts).

Anyone can write an entity with this schema tag, so **trust comes from the publisher address**, and readers re-validate every row (fingerprint match, `evidenceId`, `status`) before showing it.

The publisher wallet and a query judges can run are added here when the first real records are written (T4b).
