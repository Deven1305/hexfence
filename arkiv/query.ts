// Public read-only query for judges. No wallet or key required.
// From repo root: corepack pnpm@10.34.9 --filter @hexfence/detector exec tsx ../../arkiv/query.ts
import { arkivReadClient, fetchAllEvidence } from '../packages/arkiv/src/index.ts';

async function main() {
  const publisher = '0x36141ba063390f0d91Af7a5a9dF8dc1d80D699ec';
  const records = await fetchAllEvidence(arkivReadClient(), publisher);
  console.log(JSON.stringify({ publisher, records: records.length,
    uniqueEvidenceIds: new Set(records.map(r => r.evidenceId)).size,
    zeroValue: records.filter(r => r.variant === 'zero-value').length,
    dust: records.filter(r => r.variant === 'dust').length,
    statuses: [...new Set(records.map(r => r.status))], first: records[0] ?? null }, null, 2));
}
main().catch(() => { console.error('Public Arkiv query failed; check network availability.'); process.exitCode = 1; });
