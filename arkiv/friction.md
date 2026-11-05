# Arkiv: friction we hit

What actually slowed us down building on `@arkiv-network/sdk` 1.0.1 and the Rabdi testnet. Every item comes from this repo's build.

| What we expected | What we found | What we did |
|---|---|---|
| Pages of 200 with `hasNextPage()`, as our spec said | A page holds at most 100 rows (`MAX_LIMIT`) and there is no `hasNextPage()` | Page by key: `orderBy(asc("$key"))` + `gt("$key", key(last))`. It also reads each row exactly once while the detector is still writing, which offset paging can't promise |
| No `createdBy` on the builder (we misread this at first) | `createdBy(addr)` exists, as shorthand for `eq("$creator", …)` | Used it, and corrected our decisions log. Filtering by creator is the whole trust model here, so it deserves a prominent place in the docs |
| Any recent Node works | The SDK asks for Node ≥ 22.10 | Pinned 22 in `.nvmrc` |
| An unfunded publisher gets a clear error | A low-level execution error, not a plain "fund this wallet" message | The detector's `publish` command checks the tGLM balance first and names the faucet |
| Reads work without an account | They do, but the SDK warns the public endpoint is "heavily rate limited" | Browser apps accept an optional `VITE_ARKIV_ACCESS_KEY`. A browser build exposes that key, so restrict it to your origins at hub.arkiv.network |

## Volume is the open question
The detector found **43,227 suspected pairs in 24 hours**, far above what we planned for. At 25 creates per `executeBatch` that is about 1,730 transactions a day. That raises three questions we had to design for:
- **Showing totals:** downloading everything to count it would mean about 430 page requests. `client.count()` with a `where` on the indexed `variant` answers in one call per variant. It is the most useful thing we found in the SDK, and it is what the explorer uses.
- **First paint:** the explorer loads one page at a time and leaves narrowing down to indexed address search.
- **What to publish:** the publish scope depends on the cost per batch, which we can only measure once the publisher wallet is funded. See the note in [reach.md](reach.md).

## What was easy
`defineSchema` with `.indexed()` columns was a clean way to state which fields are queryable, and the same schema gave us typed reads and writes. Reading from a static page needed no backend and no proxy: the explorer's `count` and `select` calls worked from the browser straight away.
