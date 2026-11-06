# Arkiv: reach

Answers for [Build on Arkiv (from scratch)](https://ethglobal.com/events/mumbai/prizes/arkiv), measured 6 November 2026. We have **no measured external users or integrations**. Detector volume is not adoption.

## Who is it for, and would they use it?

Safe operators checking suppliers can use [HexFence Pay](https://deven1305.github.io/hexfence/pay/). Wallet developers can bulk-read suspected patterns and compare locally. Investigators can search the [explorer](https://deven1305.github.io/hexfence/explorer/) and check both Ethereum receipts. These are intended uses, not validated demand: no user interviews, pilot or production usage measurement is claimed.

## Can people try it today?

Yes. Both hosted apps passed real-data browser checks. Explorer showed **173 suspected records**; Verify on Ethereum confirmed both receipts for the first record. Pay loaded the actual Safe, Guard and approved payees through Nox. Payments need a Sepolia wallet owning a configured Safe. The recorded T8 wallet was explicitly scripted, not Safe{Wallet}; H6 remains unticked. Explorer reading needs no HexFence account or test tokens.

Publisher: `0x36141ba063390f0d91Af7a5a9dF8dc1d80D699ec`. Rabdi chain: `7794095`. Public read-only query from repo root:

```powershell
corepack pnpm@10.34.9 --filter @hexfence/detector exec tsx ../../arkiv/query.ts
```

Observed output: **173 records, 173 uniqueEvidenceIds, 147 zeroValue, 26 dust, statuses [suspected]**. [query.ts](query.ts) uses the production bulk reader with publisher filtering and key pagination. No key or wallet is needed.

## Measured data and publication scope

| Measure | Real output |
|---|---|
| Fresh mainnet scan | Blocks 26345544–26352743; 1,366,618 USDT/USDC logs |
| Detector output | 47,694 suspected pairs: 36,382 zero-value, 11,312 dust |
| Published subset | First 125 records: 124 zero-value, 1 dust; latest attack blocks selected by --limit 125, not a random precision sample. On 6 Nov 48 more were added, one per equal slice of the scan (lowest evidenceId in each slice), for 173 in total |
| First publication | 25 created in [0xe0b88b…bf0ea](https://rabdi.explorer.arkiv.network/tx/0xe0b88b37643fb0ff1c730ea2cc662789dd6992b1e38c5ac4fc13dfa70c7bf0ea) |
| Additional publication | 100 created, 25 already present, 4 transactions; first [0xfadb29…efcca](https://rabdi.explorer.arkiv.network/tx/0xfadb29df57c9863d8b51433aa8f237001e0f78a16768da03c7fca66e647efcca) |
| Rerun --limit 125 | **0 created, 125 already on Arkiv, 0 transactions** |
| Additional publication cost | 0.026641686 tGLM; existing balance 0.092986528 → 0.066344842; no further transfer |
| Human-labelled precision | Not established by human review; H9 labels were AI-assigned, not human precision |

Run detect, then publish:arkiv --limit 125 twice using the same evidence.jsonl (commands in [README](../README.md)). Writes require a funded testnet publisher; public queries do not. [Live results](../docs/T8_LIVE_RESULTS.md) records the gate evidence and limits.

## Will the team continue after Mumbai?

**post-Mumbai plan: team to confirm**

No production release, maintenance, funding or retention-renewal commitment is claimed. The [MIT-licensed](../LICENSE) detector can be run by others under their own publisher wallet. Readers choose publishers explicitly; our apps currently select the address above.

## Limits

Only mainnet USDT/USDC and 4+4 resemblance are covered. The publication is a subset, not comprehensive threat coverage. Entities expire after 30 days unless independently republished. Rabdi is a testnet with public-RPC rate limits; we make no hosted availability promise. The Guard does not depend on Arkiv.

## Upgrade checkpoint

The read-only [6 Nov snapshot](../docs/research/arkiv-snapshot-2026-11-06.json) reproduced 173 unique records at 09:47:52 UTC. Pay's merged V2/Radar wiring reads the actual isolated V2 Safe and consumer; its four-layout browser run returned no Sentinel alerts. The new V2 Safe was unfunded, so no positive-value live V2 demo is claimed. [Requirements and gaps](../docs/JUDGE_READINESS.md) distinguishes local tests, public receipts and human work. No measured external use or maintenance commitment has appeared during this check.
