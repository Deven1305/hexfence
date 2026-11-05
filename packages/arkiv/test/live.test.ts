import { describe, expect, it } from "vitest";
import { arkivReadClient, fetchAllEvidence, findEvidenceByAddress } from "../src/read.js";

// Live read against the Rabdi testnet. Opt-in so `pnpm -r test` never depends on the network:
//   ARKIV_LIVE=1 pnpm --filter @hexfence/arkiv test
// ARKIV_PUBLISHER picks whose records to read; the default is an address that has written none.
const live = process.env.ARKIV_LIVE === "1";
const publisher = (process.env.ARKIV_PUBLISHER ?? "0x000000000000000000000000000000000000dEaD") as `0x${string}`;

describe.skipIf(!live)("Rabdi (live)", () => {
  const client = arkivReadClient({ accessKey: process.env.ARKIV_ACCESS_KEY });

  it("talks to chain 7794095", () => {
    expect(client.chain?.id).toBe(7794095);
  });

  it("reads every record of a publisher (empty is fine) and searches by address", async () => {
    const all = await fetchAllEvidence(client, publisher);
    expect(Array.isArray(all)).toBe(true);
    for (const e of all) expect(e.status).toBe("suspected");
    const target = all[0]?.lookalike ?? publisher;
    const hits = await findEvidenceByAddress(client, publisher, target);
    if (all.length > 0) expect(hits.some((e) => e.lookalike === target)).toBe(true);
    console.log(`publisher ${publisher}: ${all.length} records; search ${target}: ${hits.length}`);
  }, 60_000);
});
