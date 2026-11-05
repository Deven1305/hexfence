# Arkiv: reach

Who the data on Arkiv can reach, and what we have measured. We have no outside users yet, so nothing here claims adoption.

## How much evidence there is
One real detector run (06 Nov, blocks 26343865–26351064, about 24 hours of mainnet USDT and USDC):

| Measure | Value |
|---|---|
| Transfer logs scanned | 1,330,446 |
| Suspected pairs | 43,227 (31,801 zero-value, 11,426 dust) |
| Victim addresses involved | 26,532 |
| Random records re-confirmed against mainnet receipts | 40 of 40 |

These are detector output with status "suspected". Hand-labelled precision (30 records) is task T13 and is still waiting on the human labelling, so we state no precision number yet. Records published to Arkiv: *(filled in after the first publish; the scope is still being decided, see [friction.md](friction.md))*.

## Who can read it, and how
Anyone, with no account and no API key from us:
- **People:** the static explorer searches by lookalike, impersonated or victim address. It has no backend, so anyone can host it.
- **Apps:** HexFence Pay reads the records in bulk and warns on an exact match, so it never sends a per-recipient lookup. Any wallet or tool can do the same with `createdBy(publisher)`.
- **Developers:** one query, in the [README](../README.md#arkiv-publisher--query).

## Who can write it
Anyone can run the MIT-licensed detector and publish under their own wallet, so readers choose which publishers to trust. Because the schema tag is open, readers must filter by publisher, and our readers re-validate every row.

## Limits on reach
- Only Ethereum mainnet USDT and USDC, and only the 4+4 fingerprint rule.
- Records expire after 30 days by design.
- Rabdi is a testnet. Its availability is outside our control, and the Guard does not depend on it.
