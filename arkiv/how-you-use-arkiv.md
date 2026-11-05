# How HexFence uses Arkiv

```
Ethereum mainnet logs → detector → Arkiv (Rabdi, hexfence.poisoning.v1) → explorer (search, counts)
                                                                        → HexFence Pay (bulk read, exact match)
```

Fields, indexes and the idempotency rule are in [schema.md](schema.md).

## Writing: `apps/detector`, `packages/arkiv/src/write.ts`
- The detector turns USDT and USDC Transfer logs into records, each carrying the attack and reference transaction hashes.
- `publishEvidence` does one bulk read of what the publisher already has, skips those records, and creates the rest with `executeBatch`, 25 at a time, using `ExpirationTime.fromDays(30)`.
- `evidenceId = keccak256(chainId, lookalike, impersonated, detectorVersion)` makes a re-run create 0 duplicates.

## Reading

| Reader | Call | Why |
|---|---|---|
| Explorer totals | `client.count().from(PoisoningSchema).createdBy(p).where(eq("variant", v))` | Totals without downloading tens of thousands of rows |
| Explorer list | one page: `select().from(PoisoningSchema).createdBy(p).orderBy(asc("$key")).limit(100)`, then `gt("$key", last)` | Renders at once and loads more on request |
| Explorer search | `findEvidenceByAddress`: `or(eq("lookalike", a), eq("impersonated", a), eq("victim", a))` | The three address columns are indexed, so the node does the filtering |
| HexFence Pay | `fetchAllEvidence`, once, in bulk | A client never reveals a specific recipient through a lookup |

Every row is re-validated by `PoisoningEvidenceSchema` (fingerprint match, `evidenceId`, status "suspected") before it is shown. Only the chosen publisher's rows are read, because anyone can write an entity with this schema tag.

## Don't trust it, check it
Records make a claim about Ethereum, so Arkiv does not have to be believed. The explorer's **Verify on Ethereum** button fetches both receipts from a mainnet RPC and checks for the `Transfer` log from the canonical token, the right from and to, the variant's value rule, and that the reference came first. It shows ✓ or "could not verify".

## Run it yourself
Commands are in the [README](../README.md): `detect`, `publish:arkiv`, and one query against the publisher.
