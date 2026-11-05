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
}

/**
 * Publish many records at once: one bulk read of what this publisher already has, then the missing
 * ones in `executeBatch` transactions of `batchSize` creates. A re-run creates 0 duplicates.
 */
export async function publishEvidence(
  opts: WriterOptions & { batchSize?: number; onBatch?: (done: number, total: number, txHash: Hex) => void },
  records: readonly PoisoningEvidence[],
  reader: ArkivReadClient = arkivReadClient(opts.accessKey === undefined ? {} : { accessKey: opts.accessKey }),
): Promise<PublishReport> {
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

  const size = opts.batchSize ?? 25;
  const txHashes: Hex[] = [];
  for (let i = 0; i < todo.length; i += size) {
    const chunk = todo.slice(i, i + size);
    const { txHash } = await wallet.executeBatch({
      creates: chunk.map((e) => ({ schema: PoisoningSchema, values: toArkivValues(e), expiration: expiration() })),
    });
    txHashes.push(txHash);
    opts.onBatch?.(i + chunk.length, todo.length, txHash);
  }
  return { publisher, alreadyThere: records.length - todo.length, created: todo.length, txHashes };
}
