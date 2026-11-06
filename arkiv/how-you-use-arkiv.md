# How HexFence uses Arkiv

Answers for [Build on Arkiv (from scratch)](https://ethglobal.com/events/mumbai/prizes/arkiv). Mainnet logs flow through the detector into Rabdi entities, then into the static explorer and Pay's bulk read. Actual writes and user-visible reads use the SDK.

## Do filters, ownership and expiry fit the app?

| Design | Fit and user-visible result |
|---|---|
| Indexed lookalike, impersonated, victim | The fields stay indexed for other readers (`findEvidenceByAddress`, schema). Neither of our apps queries them today: explorer and Pay bulk-read and match addresses locally, so an address is not sent to the RPC. |
| Schema tag and createdBy(publisher) | Readers choose whose claims to display; another writer's same-schema entities do not silently enter the dataset. |
| Indexed variant | Explorer totals distinguish zero-value from dust. Live: 173 = 147 zero-value + 26 dust. |
| Stable evidenceId | Writer bulk-reads existing IDs and skips them. Rerun: 0 created, 125 already present; no duplicate cards from that run. |
| Key ordering, at most 100 rows/page | Explorer walks all pages automatically and shows progress; the hosted browser reached 173 of 173. Pay walks all pages before comparing locally. |
| Wallet ownership | Publisher 0x36141ba063390f0d91Af7a5a9dF8dc1d80D699ec owns its records. Network rules restrict mutations to the owner; our app exposes no editor, and the writer creates records rather than editing claims. Attribution does not establish truth. |
| ExpirationTime.fromDays(30) | Old warnings age out instead of accumulating forever. Configured in the writer; a full 30-day cycle has not elapsed in our test. |
| executeBatch of 25 creates | Additional 100 records used four transactions; the 48 after them used two; explorer then showed 173. Batching bounds write cost/flow, not verdict severity. |

The complete indexed/plain split is in [schema.md](schema.md) and [schema.ts](../packages/arkiv/src/schema.ts). chainId, attackBlock and detectorVersion are indexed for dataset scoping/inspection; the current UI does not expose controls for every index. We do not claim each index creates a product feature.

## Does each feature change something users see?

The table maps each used Arkiv feature to a visible result and its limits. Explorer counts, views, cards and pagination read Rabdi; its address search and check run on those downloaded records. Pay reads bulk evidence for an exact-address signal. Its Guard/payee reads are Sepolia contract reads; the Guard never queries Arkiv. Synthetic L is not published as evidence and receives only the resemblance warning.

Rows are validated with PoisoningEvidenceSchema before use; status is always **suspected**. Verify on Ethereum fetches both referenced mainnet receipts and checks the token transfer pattern. The live first-record check passed; it neither changes status nor proves malicious intent.

## Runnable read and duplicate check

From repo root, no key needed:

```powershell
corepack pnpm@10.34.9 --filter @hexfence/detector exec tsx ../../arkiv/query.ts
```

Observed: 173 records, 173 unique IDs, 147 zero-value, 26 dust, only suspected. [query.ts](query.ts) imports the [production reader](../packages/arkiv/src/read.ts). Configure a testnet publisher in ignored root .env for writes, then:

```powershell
corepack pnpm@10.34.9 --filter @hexfence/detector publish:arkiv --limit 125
corepack pnpm@10.34.9 --filter @hexfence/detector publish:arkiv --limit 125
```

The recorded rerun sent 0 transactions. Public RPC worked without an access key but is rate limited. No more tGLM will be transferred for this pass without Dhruv's explicit approval.

Off-Arkiv choices: [why-arkiv.md](why-arkiv.md). Measured reach: [reach.md](reach.md). Feedback: [friction.md](friction.md). **post-Mumbai plan: team to confirm**.

## Distinguish live evidence from other schemas

| Schema or state | Actual use at the research checkpoint |
|---|---|
| hexfence.poisoning.v1 | Live SDK writes, creator-filtered bulk reads, visible cards/counts and local comparisons. Fresh [machine-readable observation](../docs/research/arkiv-snapshot-2026-11-06.json). |
| hexfence.release.v1 | Code-only prototype: optional CI writer, no proved live write or browser reader. The 5,601-byte manifest exceeds its str column limit; a separate follow-up must fix/test this before claiming it works. |
| Loss data | Later merged A4 schema and publication, described in schema.md; distinct from poisoning records. Campaign features remain unclaimed. |
| V2 learned recipients / Sentinel alerts | Sepolia contracts, not Arkiv records. Neither Guard depends on Arkiv. |

Key continuation is not a fixed-block atomic snapshot during concurrent writes. Pair IDs exclude victim/transaction, so records preserve representative context, not every incident. Human precision is unestablished; AI-assigned labels are not a human result. See the [partner requirement table](../docs/JUDGE_READINESS.md) for all remaining gaps.

B7 update: the release manifest now uses tested bytes encoding. [GitHub provenance verification](../docs/ATTESTATIONS.md) succeeded for a historical public Pay index with exact workflow/ref/commit policy. Live Arkiv release publication is still absent; the configured CI job skipped for a missing secret. This does not change the poisoning or loss publication observations.
