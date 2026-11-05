# Why Arkiv

**Poisoning evidence should be open data anyone can query and check, not a closed feed that a vendor controls.** Arkiv lets us publish it as queryable records without running a server.

## What it replaces
Today, address-threat data mostly sits behind vendor feeds and closed blocklists. Using one means asking a provider about each recipient, which tells that provider who you are about to pay. We wanted the reverse: a dataset a client can read in bulk and check locally.

## What Arkiv gives us that the alternatives don't

| Option | Why not |
|---|---|
| Our own API and database | A server we must keep running. Users have to trust it, and it sees their queries. It also conflicts with our no-backend explorer |
| Events on Ethereum or an L2 | Permanent and costly for short-lived evidence, and filtering by address needs a separate indexer |
| A file on IPFS or GitHub | Easy to publish, but no queries: every reader downloads everything and filters it themselves |
| **Arkiv** | Indexed attributes mean a static page can search by address. Built-in expiry fits evidence that goes stale. Records are attributable to a publisher wallet |

## The features we rely on
- **Attributable writes:** `createdBy(publisher)` makes trust explicit, since each reader decides which publisher to believe.
- **Expiry:** records last 30 days. Old poisoning evidence is stale for warnings, and expiry keeps the dataset and its cost bounded.
- **Indexed queries from a browser:** the explorer has no backend.
- **Counts without downloads:** `client.count()` gives totals by variant in one call.

## What Arkiv is not doing
The on-chain Guard is the enforcement, and it **never reads Arkiv**. If every record vanished, a protected Safe would still refuse lookalikes. Arkiv carries the public evidence. It is not a dependency of the protection, and we would rather say so than overstate its role.
