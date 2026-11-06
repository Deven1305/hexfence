import { ExpirationTime } from "@arkiv-network/sdk";
import { addr, bytes, dec, defineSchema, key, str, type Column, type Schema } from "@arkiv-network/sdk/schema";
import { asc, gt } from "@arkiv-network/sdk/query";
import { SuspectedLossSchema, lossKey, type SuspectedLoss } from "@hexfence/shared";
import { hexToString, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arkivReadClient, type ArkivReadClient } from "./read.js";
import { arkivWalletClient, type WriterOptions } from "./write.js";

const contextColumn: Column<"bytes", false, false, false> = bytes();
export const LOSS_SCHEMA_NAME = "hexfence.loss.v1";
export const LossSchema: Schema<{
  evidenceId: Column<"str", true, false, false>; victim: Column<"addr", true, false, false>;
  lookalike: Column<"addr", true, false, false>; lossBlock: Column<"dec", true, false, false>;
  token: Column<"addr", false, false, false>; amount: Column<"str", false, false, false>;
  lossTx: Column<"str", false, false, false>; repeat: Column<"dec", false, false, false>;
  packHash: Column<"str", false, false, false>; status: Column<"str", false, false, false>;
  context: Column<"bytes", false, false, false>;
}> = defineSchema(LOSS_SCHEMA_NAME, {
  evidenceId: str().indexed(), victim: addr().indexed(), lookalike: addr().indexed(), lossBlock: dec().indexed(),
  token: addr(), amount: str(), lossTx: str(), repeat: dec(), packHash: str(), status: str(),
  // A str is limited to 128 UTF-8 bytes. The bounded context/hops use documented bytes storage.
  context: contextColumn,
});
export function lossValues(e: SuspectedLoss) {
  const r = SuspectedLossSchema.parse(e);
  return { evidenceId: r.evidenceId, victim: addr(r.victim), lookalike: addr(r.lookalike), lossBlock: dec(r.lossBlock),
    token: addr(r.token), amount: r.amount, lossTx: r.lossTx, repeat: dec(r.repeat), packHash: r.packHash, status: r.status,
    context: bytes(new TextEncoder().encode(JSON.stringify(r))) };
}
export function lossFromRow(row: Record<string, unknown>): SuspectedLoss {
  const value = (name: string): unknown => {
    const c = row[name]; return c && typeof c === "object" && "value" in c ? c.value : c;
  };
  const context = value("context");
  if (typeof context !== "string") throw new Error("Loss context is missing");
  const r = SuspectedLossSchema.parse(JSON.parse(hexToString(context as Hex)));
  for (const name of ["evidenceId", "victim", "lookalike", "lossBlock", "token", "amount", "lossTx", "repeat", "packHash", "status"] as const) {
    if (String(value(name)).toLowerCase() !== String(r[name]).toLowerCase()) throw new Error("Loss attributes disagree with context");
  }
  return r;
}
/** Publisher-scoped bulk reads only. Invalid or inconsistent rows fail the read. */
export async function fetchAllLosses(client: ArkivReadClient, publisher: Address): Promise<SuspectedLoss[]> {
  const records = new Map<string, SuspectedLoss>(); let last: Hex | undefined;
  for (;;) {
    let q = client.select().from(LossSchema, { onMismatch: "throw" }).createdBy(publisher).orderBy(asc("$key")).limit(100);
    if (last) q = q.where(gt("$key", key(last)));
    const page = await q.fetch();
    for (const row of page.entities) { const r = lossFromRow(row as unknown as Record<string, unknown>); if (!records.has(lossKey(r))) records.set(lossKey(r), r); }
    const tail = page.entities.at(-1)?.$key as Hex | undefined;
    if (page.entities.length < 100 || !tail) return [...records.values()];
    if (tail === last) throw new Error("Loss pagination did not advance"); last = tail;
  }
}
/** Idempotent by evidenceId+lossTx, with a funding allowance and no ambiguous-write retries. */
export async function publishLosses(opts: WriterOptions & { maxRecords?: number }, records: readonly SuspectedLoss[], reader: ArkivReadClient = arkivReadClient({ accessKey: opts.accessKey })) {
  const publisher = privateKeyToAccount(opts.privateKey).address;
  const existing = await fetchAllLosses(reader, publisher);
  const have = new Set(existing.map(lossKey));
  const todo: SuspectedLoss[] = [];
  for (const value of records) {
    const r = SuspectedLossSchema.parse(value); const id = lossKey(r);
    if (!have.has(id)) { have.add(id); todo.push(r); }
  }
  const max = opts.maxRecords ?? records.length;
  if (!Number.isSafeInteger(max) || max < 0) throw new Error("maxRecords must be nonnegative");
  const wallet = arkivWalletClient(opts); const txHashes: Hex[] = []; let stoppedForFunds = false; let created = 0;
  // One record per transaction: rescue context may be larger than poisoning evidence.
  for (const r of todo.slice(0, max)) {
    if (await reader.getBalance({ address: publisher }) < 8_000_000_000_000_000n) { stoppedForFunds = true; break; }
    const { txHash } = await wallet.executeBatch({ creates: [{ schema: LossSchema, values: lossValues(r), expiration: ExpirationTime.fromDays(90) }] });
    txHashes.push(txHash); created++;
  }
  return { publisher, created, alreadyThere: records.length - todo.length, stoppedForFunds, txHashes };
}
