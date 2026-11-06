# Arkiv: friction we hit

Measured against SDK 1.0.1 and Rabdi. [Official limits](https://docs.arkiv.network/docs/reference/limits) and [documentation index](https://docs.arkiv.network/llms.txt) were checked before this update.

| Expectation | Observation | Response |
|---|---|---|
| Spec assumed 200-row pages and hasNextPage | Pinned SDK caps pages at 100; no such helper | Production reader orders by entity key and continues after the last key. The 1,126-record public query needs 12 pages. This is not an atomic snapshot during concurrent writes. |
| We initially misread creator filtering | createdBy(address) exists | Restrict reads to the selected publisher, revalidate returned records, and document that attribution is not truth. |
| Any Node version | SDK requires >=22.10 | Node 22 run path. |
| Clear insufficient-funds errors | Early writes reached low-level execution errors | Publisher preflights public balance and stops without dumping a signed request. No new faucet or funds transfer is part of this pass. |
| Arbitrarily large string fields | The release-record prototype uses str for a 5,601-byte manifest; str is limited to 128 UTF-8 bytes | Reproduced rejection with pinned SDK str('x'.repeat(129)). Store long content as bytes (limit 128 KiB), retain short indexed hashes. This is our integration bug, not an Arkiv outage; no live release write is claimed. |
| Free public reads imply an availability guarantee | Public RPC worked without an access key but is documented as heavily rate limited | Optional access key and explicit unavailable states. A browser key is public; restrict origins. |

## Actual scale and cost

Historical scan blocks 26345544–26352743 read 1,366,618 mainnet logs and produced 47,694 suspected pairs. Only a deliberate subset was published: [fresh read](../docs/research/arkiv-snapshot-2026-11-06-1126.json) returned 1,126 unique records, 651 zero-value and 475 dust, after a second scan (blocks 26349302-26356501, 1,479,334 logs, 58,739 suspected pairs). These numbers do not establish precision or adoption.

The first 25 records cost 0.007013472 tGLM. An additional 100 cost 0.026641686 in four batches. The 125-record rerun created zero and sent zero transactions. The final 953 cost 0.255031221 tGLM in 39 transactions, about 0.00027 per record. These are historical measurements, not price estimates. [Live results](../docs/T8_LIVE_RESULTS.md), [reach](reach.md).

Explorer now bulk-loads all pages with progress and searches locally; Pay also bulk-loads before local comparisons. Earlier first-page/indexed-search descriptions no longer match these clients. Bulk reads improve query privacy but grow with dataset size; there is no demonstrated full-dataset production scale benchmark. Indexed variant counts remain useful without downloading all content.

## What worked and feedback

Typed defineSchema, creator filtering, expiry and executeBatch made static-client reads and idempotent publication straightforward. Our production writer batches 25 creates; a repeat skips existing IDs.

We would value a prominent migration/pagination example, a manifest-size example distinguishing str from bytes, actionable insufficient-funds errors, and preflight batch-cost guidance. The query shape and SDK limits are documented; our earlier assumptions were wrong. Reproduce the working public read with [query.ts](query.ts), requiring no wallet, key or write. Do not generate or fund an account just to reproduce these observations.

B7 follow-up: [the release encoder](../packages/arkiv/src/release.ts) now uses bytes and validates digest/size/path shape; tests reproduce the old str rejection and cover the corrected write/idempotence path. The prototype's earlier size defect is fixed in code. No live release record is claimed; [attestation guide](../docs/ATTESTATIONS.md).
