# Arkiv schema: `hexfence.poisoning.v1`

One entity = one deduplicated **suspected** lookalike/impersonated pair seen on **Ethereum mainnet** (chain 1), written by the HexFence detector to the Arkiv **Rabdi testnet** (chain 7794095, `https://rpc.rabdi.db-chain.testnet.arkiv.network`).

Defined once in code: [`packages/arkiv/src/schema.ts`](../packages/arkiv/src/schema.ts) (`defineSchema`, `@arkiv-network/sdk` 1.0.1). Every record is also validated by `PoisoningEvidenceSchema` in [`packages/shared/src/evidence.ts`](../packages/shared/src/evidence.ts), both before it is written and after it is read.

## Columns

| Column | Arkiv type | Indexed | Meaning |
|---|---|---|---|
| `evidenceId` | `str` | ✓ | Idempotency key, see below |
| `chainId` | `dec` | ✓ | Where the attack happened. Always `1` (Ethereum mainnet) |
| `lookalike` | `addr` | ✓ | Address resembling `impersonated`; controller intent is not established |
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

**Why this split:** only indexed columns can be filtered on. Address indexes support other clients; our apps bulk-read and search locally. The single-record writer looks up `evidenceId` and the batch writer bulk-reads existing IDs, and the rest is stored for display and verification without paying for an index. There is deliberately **no confidence score**: the record carries the two transaction hashes, so anyone can check it on Ethereum.

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
Records are read **in bulk per publisher**: `createdBy(publisher)`, `orderBy(asc("$key"))`, pages of ≤ 100 rows (the SDK's `MAX_LIMIT`), continued with `gt("$key", lastKey)`. Clients never send a per-recipient lookup. Code: `fetchAllEvidence` in [`packages/arkiv/src/read.ts`](../packages/arkiv/src/read.ts).

Anyone can write an entity with this schema tag, so **trust comes from the publisher address**, and readers re-validate every row (fingerprint match, `evidenceId`, `status`) before showing it.

Publisher: `0x36141ba063390f0d91Af7a5a9dF8dc1d80D699ec`. [Public query](query.ts) and [fresh snapshot](../docs/research/arkiv-snapshot-2026-11-06-1126.json).


## `hexfence.loss.v1` (upgrade)

Loss entities live for 90 days (SDK `ExpirationTime.fromDays(90)`). Indexed fields: `evidenceId`, `victim`, `lookalike`, `lossBlock`. Plain fields: `token`, exact base-unit string `amount`, `lossTx`, `repeat`, `packHash`, `status` (always `suspected`). The plain `context` is `bytes` containing the full normalized record and bounded outgoing-transfer leads; a string column has a documented 128-byte limit. Context duplicates are checked against the indexed/plain attributes on every read. All records pass the shared loss schema; invalid or conflicting records fail the bulk read.

Writer idempotency is by `(evidenceId, lossTx)`, including input deduplication and one bulk read of existing publisher records. Each create is a separate transaction to keep the larger context bounded. Readers use publisher-scoped key pagination with at most 100 rows per page. There are no per-victim or per-lookalike queries. The canonical Rescue Markdown is generated locally from that immutable context; `packHash` is its SHA-256. Current balance and receipt recheck results are a separately dated local supplement. Expiry and idempotence do not establish that a suspected loss was caused by poisoning.

Publisher: `0x36141ba063390f0d91Af7a5a9dF8dc1d80D699ec`. Run the read-only [query.ts](query.ts) with the [README command](../README.md#arkiv-publisher--query). The [6 Nov observation](../docs/research/arkiv-snapshot-2026-11-06-1126.json) returned 1,126 unique records, all suspected.

The ID deliberately excludes victim and attack transaction: one representative context is retained for a pair/version, not every incident. This poisoning schema is distinct from the later loss schema. Expiry is a storage policy, not a guarantee that a pattern stops mattering after 30 days. Key continuation prevents offset drift but is not an atomic snapshot while writes occur; no fixed-block read is currently used.

## Separate release-record prototype

`hexfence.release.v1` in [release.ts](../packages/arkiv/src/release.ts) indexes commit and manifest hash, stores SHA256SUMS and requests 90-day expiry. At the research checkpoint it stores a 5,601-byte manifest in `str`, exceeding the official 128 UTF-8 byte limit. No live release record or user-facing reader is proved. This is a gap, not evidence that the poisoning writer failed. See [readiness](../docs/JUDGE_READINESS.md) for subsequent separately evidenced fixes.

## B7 follow-up: tested bytes representation

The later release encoder fixes the manifest field to bytes, with a 64 KiB cap and digest validation before network access. Indexed commit/hash and 90-day expiry are unchanged. No old-row migration, live write or browser reader is claimed. [Provenance evidence, limits and human publication steps](../docs/ATTESTATIONS.md).
