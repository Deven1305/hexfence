import { asc, eq, gt } from "@arkiv-network/sdk/query";
import { key } from "@arkiv-network/sdk/schema";
import { fromArkivRow, PAGE_SIZE, PoisoningSchema, type ArkivReadClient } from "@hexfence/arkiv";
import type { PoisoningEvidence } from "@hexfence/shared";
import type { Address, Hex } from "viem";

export interface VariantCounts {
  zeroValue: bigint;
  dust: bigint;
}

/** Counted by the node, so the explorer never downloads every record to show the totals. */
export async function countByVariant(client: ArkivReadClient, publisher: Address): Promise<VariantCounts> {
  const count = (variant: PoisoningEvidence["variant"]) =>
    client.count().from(PoisoningSchema).createdBy(publisher).where(eq("variant", variant)).fetch();
  const [zeroValue, dust] = await Promise.all([count("zero-value"), count("dust")]);
  return { zeroValue, dust };
}

export interface EvidencePage {
  records: PoisoningEvidence[];
  /** Pass to the next call; undefined when this was the last page. */
  nextKey: Hex | undefined;
}

/** One page of the publisher's records, keyed the same way as `fetchAllEvidence`, for progressive rendering. */
export async function fetchEvidencePage(
  client: ArkivReadClient,
  publisher: Address,
  afterKey?: Hex,
): Promise<EvidencePage> {
  let q = client
    .select()
    .from(PoisoningSchema, { onMismatch: "throw" })
    .createdBy(publisher)
    .orderBy(asc("$key"))
    .limit(PAGE_SIZE);
  if (afterKey) q = q.where(gt("$key", key(afterKey)));
  const page = await q.fetch();
  const records = page.entities
    .map((row) => fromArkivRow(row as unknown as Record<string, unknown>))
    .filter((e): e is PoisoningEvidence => e !== null);
  const tail = page.entities.at(-1);
  return { records, nextKey: page.entities.length === PAGE_SIZE && tail ? (tail.$key as Hex) : undefined };
}
