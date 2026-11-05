import { createPublicClient, type PublicArkivClient } from "@arkiv-network/sdk";
import { rabdi } from "@arkiv-network/sdk/chains";
import { asc, eq, gt, or } from "@arkiv-network/sdk/query";
import { addr, key } from "@arkiv-network/sdk/schema";
import type { PoisoningEvidence } from "@hexfence/shared";
import { http, type Address, type Hex } from "viem";
import { fromArkivRow } from "./codec.js";
import { PoisoningSchema } from "./schema.js";

/** The Arkiv SDK's page cap (MAX_LIMIT in @arkiv-network/sdk 1.0.1). */
export const PAGE_SIZE = 100;

export type ArkivReadClient = PublicArkivClient;

/**
 * Read-only client for the Rabdi testnet (chain 7794095). `accessKey` is optional: without one the
 * SDK uses the public endpoint, which is heavily rate limited.
 */
export function arkivReadClient(opts?: { accessKey?: string }): ArkivReadClient {
  return createPublicClient({ chain: rabdi({ accessKey: opts?.accessKey ?? "" }), transport: http() });
}

/**
 * Bulk read of every record by one publisher (all pages). Used by the explorer and by Pay (T10),
 * so a client never sends a per-recipient lookup. Rows that fail validation are dropped.
 */
export function fetchAllEvidence(client: ArkivReadClient, publisher: Address): Promise<PoisoningEvidence[]> {
  return fetchPaged(client, publisher, (q) => q);
}

/**
 * Explorer search only (never used by Pay): records whose lookalike, impersonated or victim equals
 * `address`. All three columns are indexed, so the node does the filtering.
 */
export function findEvidenceByAddress(
  client: ArkivReadClient,
  publisher: Address,
  address: Address,
): Promise<PoisoningEvidence[]> {
  const a = addr(address);
  return fetchPaged(client, publisher, (q) => q.where(or(eq("lookalike", a), eq("impersonated", a), eq("victim", a))));
}

/** Every record by `publisher`, sorted by key. A row that doesn't fit the schema fails the read:
 *  only our own publisher's rows match, and a skipped row would leave a page with no key to continue from. */
function baseQuery(client: ArkivReadClient, publisher: Address) {
  return client
    .select()
    .from(PoisoningSchema, { onMismatch: "throw" })
    .createdBy(publisher)
    .orderBy(asc("$key"))
    .limit(PAGE_SIZE);
}
type Query = ReturnType<typeof baseQuery>;

/**
 * Pages by entity key (`asc("$key")` + `gt("$key", last)`), as the SDK docs advise, so every match
 * is read exactly once even while the detector is writing. Offset paging could repeat or skip rows.
 */
async function fetchPaged(
  client: ArkivReadClient,
  publisher: Address,
  narrow: (q: Query) => Query,
): Promise<PoisoningEvidence[]> {
  const out: PoisoningEvidence[] = [];
  const seen = new Set<Hex>();
  let last: Hex | undefined;
  for (;;) {
    let q = narrow(baseQuery(client, publisher));
    if (last) q = q.where(gt("$key", key(last)));
    const page = await q.fetch();

    for (const row of page.entities) {
      const e = fromArkivRow(row as unknown as Record<string, unknown>);
      // One record per evidenceId: the writer is idempotent, but anyone could re-post a copy.
      if (e && !seen.has(e.evidenceId)) {
        seen.add(e.evidenceId);
        out.push(e);
      }
    }
    const tail = page.entities.at(-1);
    if (page.entities.length < PAGE_SIZE || !tail) return out;
    last = tail.$key as Hex;
  }
}
