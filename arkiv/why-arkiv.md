# Why Arkiv

Answers for [Build on Arkiv (from scratch)](https://ethglobal.com/events/mumbai/prizes/arkiv), checked 6 November 2026. The live dataset has **173 suspected records**. See [reach](reach.md) for the measured count and [query.ts](query.ts) for a runnable public read.

## What would users lose with Postgres or another database?

Users would lose this deployment's shared, wallet-attributed data source independent of a HexFence API. The [hosted explorer](https://deven1305.github.io/hexfence/explorer/) queries Rabdi directly. Another static client can query the same schema and publisher; createdBy(publisher) makes its source explicit. Entity ownership and 30-day expiry are network rules rather than our API's authentication and cleanup jobs.

Postgres could implement bulk downloads, filters, authentication and expiry too, but we would need to operate or delegate that API. Users would depend on its operator for access and attribution. This is an architectural tradeoff, not a claim that SQL cannot provide these functions. Arkiv still has RPC availability/rate-limit dependencies, and the selected publisher remains a trust choice.

The derived dataset connects victim, impersonated payee and lookalike to two Ethereum transactions. Raw Ethereum logs supply the transfers; our detector supplies the suspected relationship. Users can search those address fields and independently re-check receipts. The hosted browser displayed 173 records and verified the first record's receipts. Receipt verification does not prove malicious intent: status stays **suspected**.

Pay bulk-reads evidence and compares recipients locally, avoiding a per-recipient request. That privacy property comes from the client design; another database could also support bulk reads. Explorer's address search and check also run on bulk-downloaded records, so the address is not sent to the Arkiv RPC.

## What did we keep off Arkiv, and why?

| Data | Location and reason |
|---|---|
| Guard enforcement and approved payees | Sepolia Safe/Guard storage. The Guard never reads Arkiv; protection must survive evidence outages. |
| Raw logs and full detector output | Ethereum RPC and ignored local evidence.jsonl. The published dataset is a measured subset, not a raw-log mirror. |
| Keys and signing material | Ignored .env/Node or the user's wallet; never public entities. |
| Pending payments and friction input | Pay's local UI; publishing intent would reveal planned recipients. |
| Receipts | Ethereum remains authoritative; entities carry hashes/block references for verification. |
| Human labels and precision | Repository CSV after human review; no invented precision result. |

No synthetic Sepolia L record is published as evidence. Source: [schema](schema.md), [reader](../packages/arkiv/src/read.ts), [writer](../packages/arkiv/src/write.ts). **post-Mumbai plan: team to confirm**.

## V2 and Sentinel boundary

V2 recorded recipients and learning settings also live in Sepolia Guard storage. Sentinel alerts live in a separate Sepolia consumer; optional Telegram messages expose their configured public Safe/pair/transaction and chat information. Neither is the Arkiv evidence schema. The release-record prototype is not proof of a working live publication: its full-manifest str field exceeds the SDK limit at this checkpoint. The later merged loss schema is separate; campaign features remain unclaimed. [Current main assessment](../docs/JUDGE_READINESS.md).
