import { createWalletClient, ExpirationTime, type WalletArkivClient } from "@arkiv-network/sdk";
import { rabdi } from "@arkiv-network/sdk/chains";
import { eq } from "@arkiv-network/sdk/query";
import { EXPIRY_DAYS, PoisoningEvidenceSchema, type PoisoningEvidence } from "@hexfence/shared";
import { http, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { toArkivValues } from "./codec.js";
import { arkivReadClient, fetchAllEvidence, type ArkivReadClient } from "./read.js";
import { PoisoningSchema } from "./schema.js";

export interface WriterOptions {
  /** The publisher's TESTNET key (Rabdi, funded with tGLM). Never a key that holds real funds. */
  privateKey: Hex;
  accessKey?: string;
}

/** A wallet client for the Rabdi testnet, signing as the publisher. */
export function arkivWalletClient(opts: WriterOptions): WalletArkivClient {
  const account = privateKeyToAccount(opts.privateKey);
  return createWalletClient({ chain: rabdi({ accessKey: opts.accessKey ?? "" }), transport: http(), account });
}

const expiration = () => ExpirationTime.fromDays(EXPIRY_DAYS);

/**
 * Detector only (Node). Idempotent by evidenceId: if this publisher already wrote the record it
 * returns that entity with created=false, otherwise it creates it (30-day expiry).
 */
export async function writeEvidence(opts: WriterOptions, e: PoisoningEvidence): Promise<{ entityKey: Hex; created: boolean }> {
  const record = PoisoningEvidenceSchema.parse(e); // never publish a record that wouldn't validate on read
  const wallet = arkivWalletClient(opts);
  const reader = arkivReadClient(opts.accessKey === undefined ? {} : { accessKey: opts.accessKey });
  const publisher = privateKeyToAccount(opts.privateKey).address;

  const existing = await reader
    .select({ $key: true })
    .from(PoisoningSchema)
    .createdBy(publisher)
    .where(eq("evidenceId", record.evidenceId))
    .limit(1)
    .fetch();
  const found = existing.entities[0];
  if (found) return { entityKey: found.$key as Hex, created: false };

  const { entityKey } = await wallet.createEntity(PoisoningSchema, toArkivValues(record), { expiration: expiration() });
  return { entityKey, created: true };
}

export interface PublishReport {
  publisher: Hex;
  alreadyThere: number;
  created: number;
  txHashes: Hex[];
  stoppedForFunds: boolean;
}

/**
 * Publish many records at once: one bulk read of what this publisher already has, then the missing
 * ones in `executeBatch` transactions of `batchSize` creates. A re-run creates 0 duplicates.
 */
export async function publishEvidence(
  opts: WriterOptions & {
    batchSize?: number;
    maxRecords?: number;
    /** Conservative funding allowance per record, plus a reserve threshold (not a fee estimate). */
    budget?: { perRecord: bigint; reserve: bigint };
    onBatch?: (done: number, total: number, txHash: Hex) => void;
  },
  records: readonly PoisoningEvidence[],
  reader: ArkivReadClient = arkivReadClient(opts.accessKey === undefined ? {} : { accessKey: opts.accessKey }),
): Promise<PublishReport> {
  const size = opts.batchSize ?? 25;
  if (!Number.isSafeInteger(size) || size < 1 || size > 25) throw new Error("batchSize must be 1–25");
  if (opts.maxRecords !== undefined && (!Number.isSafeInteger(opts.maxRecords) || opts.maxRecords < 1))
    throw new Error("maxRecords must be a positive integer");
  if (opts.budget && (opts.budget.perRecord <= 0n || opts.budget.reserve < 0n)) throw new Error("Invalid budget");
  const wallet = arkivWalletClient(opts);
  const publisher = privateKeyToAccount(opts.privateKey).address;
  const have = new Set((await fetchAllEvidence(reader, publisher)).map((e) => e.evidenceId));

  const todo: PoisoningEvidence[] = [];
  for (const r of records) {
    const record = PoisoningEvidenceSchema.parse(r);
    if (have.has(record.evidenceId)) continue;
    have.add(record.evidenceId); // also de-duplicates the input itself
    todo.push(record);
  }

  const alreadyThere = records.length - todo.length;
  const selected = todo.slice(0, opts.maxRecords);
  const txHashes: Hex[] = [];
  let created = 0;
  let stoppedForFunds = false;
  for (let i = 0; i < selected.length; i += size) {
    const chunk = selected.slice(i, i + size);
    if (opts.budget) {
      const balance = await reader.getBalance({ address: publisher });
      if (balance < opts.budget.reserve + opts.budget.perRecord * BigInt(chunk.length)) {
        stoppedForFunds = true;
        break;
      }
    }
    let txHash: Hex;
    try {
      ({ txHash } = await wallet.executeBatch({
        creates: chunk.map((e) => ({ schema: PoisoningSchema, values: toArkivValues(e), expiration: expiration() })),
      }));
    } catch (err) {
      // The SDK wraps viem/RPC errors. Only a funding refusal is a clean budget stop;
      // timeouts or ambiguous transaction outcomes must fail, with no automatic retry.
      if (opts.budget && err instanceof Error && /insufficient funds|insufficient balance|funds for gas|not enough funds|doesn't have enough funds|total cost[\s\S]*exceeds[\s\S]*balance/i.test(err.message)) {
        stoppedForFunds = true;
        break;
      }
      throw err;
    }
    txHashes.push(txHash);
    created += chunk.length;
    opts.onBatch?.(created, selected.length, txHash);
  }
  return { publisher, alreadyThere, created, txHashes, stoppedForFunds };
}
