# Scheduled evidence and explorer changes

The publisher workflow runs at minute 23 every six hours (UTC), or through **Run workflow**. Scheduled workflows run from the repository's default branch; the organiser must review and merge this branch first. No commit, push, deployment or live publication was performed for this change.

## Waiting on humans

1. In repository **Settings → Secrets and variables → Actions**, add the repository secret **`ARKIV_PRIVATE_KEY`**: the existing Rabdi publisher's testnet private key. Never use a mainnet key. Its public address must match the explorer's existing `VITE_ARKIV_PUBLISHER` configuration. Without this secret the job reports that it is skipping and performs no detection or publication.
2. Optional repository secret: **`ARKIV_ACCESS_KEY`** (Arkiv RPC access key). The public Rabdi endpoint is used when absent.
3. Optional repository variables: **`MAINNET_RPC_URL`** (defaults to `https://ethereum-rpc.publicnode.com`) and **`PUBLISH_MAX_RECORDS`** (positive integer; defaults to **10**). No additional required variable. Existing browser variables `VITE_ARKIV_PUBLISHER` and `VITE_MAINNET_RPC_URL` still configure the publisher read and receipt checks, respectively.
4. Run the checks below, merge after review, then use **Actions → Publish recent suspected evidence → Run workflow**. Confirm the report's created count never exceeds the configured cap. A repeat scan can find additional candidates, so it need not create zero; an already-present evidence ID is skipped. Do not add another concurrent publishing process using this wallet.
5. Check the explorer against the live publisher: it should automatically pass 100 records, show progress, and finish. Search and Check my address must use downloaded records without address query requests; only Verify on Ethereum fetches receipts when clicked. Confirm a page failure shows incomplete results and a retry button.

## Budget and data behaviour

The existing detector scans the latest 7,200 Ethereum blocks, reading USDT/USDC Transfer logs in 100-block windows. Each run starts with a fresh checkout and uses the existing JSONL output and Arkiv writer; there is no second detector or cached publication ledger.

Scheduled publication orders candidates by newest attack block, bulk-reads the publisher's current Arkiv records, deduplicates by evidence ID, then caps **new writes**, default 10. Batches contain at most 10 records in this workflow (the writer enforces a maximum batch size of 25). This is a bounded subset of detections, not a complete feed of all mainnet patterns.

Before every batch the writer requires a balance of at least **0.005 tGLM + 0.001 tGLM per record in that batch**. The allowance is deliberately above the historical measured 0.00047 single-record upper bound; it is a conservative threshold, not a current fee estimate or a guaranteed reserve. A balance below the threshold, a zero balance, or a recognised insufficient-funds refusal stops cleanly. Other errors fail without automatic application-level retry, since the transaction outcome could be ambiguous. The next run reads Arkiv again before any writes. No top-up is automated. Records retain the existing 30-day expiry; expired records no longer present on Arkiv may be published again if detected in the recent window.

Explorer pages remain capped at 100 rows. The total is a publisher-wide Arkiv count, while the number shown is valid, unique evidence downloaded so far; changing data, duplicates or rejected records can make those differ. Variant, token and timeline views use only the downloaded set. The timeline uses chronological Ethereum attack-block ranges because evidence records contain no calendar timestamps. Both address tools use exact case-insensitive local matching across lookalike, impersonated and victim roles. Results stay labelled suspected, and no match is not a finding that an address is harmless.

## Validation

Read the installed Arkiv SDK 1.0.1 README and source (`executeBatch`, transaction handling and query builder) before using its API. Added explorer aggregation and local-address tests, plus mocked writer tests for post-deduplication limits, repeat runs, balance checks between batches, funding refusals and ambiguous errors.

`git diff --check` passed. Attempted `corepack pnpm@10.34.9 --filter @hexfence/explorer --filter @hexfence/arkiv test`; Node child-process startup failed with **spawn EPERM** before tests ran. No workaround attempted. Workspace tests/builds, contracts tests, browser checks and live publication were not run. The organiser must run:

```powershell
corepack pnpm@10.34.9 -r test
corepack pnpm@10.34.9 -r build
cd contracts
npx hardhat test
```

`style.css`, `index.html`, `pages.yml`, contracts, the frozen interfaces and planning documents are unchanged.
