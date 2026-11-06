import { ExpirationTime } from "@arkiv-network/sdk";
import { eq } from "@arkiv-network/sdk/query";
import { defineSchema, str } from "@arkiv-network/sdk/schema";
import type { Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arkivReadClient } from "./read.js";
import { arkivWalletClient, type WriterOptions } from "./write.js";

/** `hexfence.release.v1`: the SHA256SUMS of one Pages build, keyed by commit. */
export const ReleaseSchema = defineSchema("hexfence.release.v1", {
  commit: str().indexed(),
  sumsSha256: str().indexed(),
  sums: str(),
});

/** Node only. Idempotent per commit for this publisher. */
export async function writeRelease(opts: WriterOptions, commit: string, sums: string, sumsSha256: string): Promise<{ entityKey: Hex; created: boolean }> {
  if (!/^[0-9a-f]{40}$/.test(commit)) throw new Error("commit must be a full lowercase sha");
  if (!sums.trim()) throw new Error("SHA256SUMS is empty");
  const reader = arkivReadClient(opts.accessKey === undefined ? {} : { accessKey: opts.accessKey });
  const publisher = privateKeyToAccount(opts.privateKey).address;
  const existing = await reader.select({ $key: true }).from(ReleaseSchema).createdBy(publisher).where(eq("commit", commit)).limit(1).fetch();
  const found = existing.entities[0];
  if (found) return { entityKey: found.$key as Hex, created: false };
  const { entityKey } = await arkivWalletClient(opts).createEntity(
    ReleaseSchema,
    { commit, sumsSha256, sums },
    { expiration: ExpirationTime.fromDays(90) },
  );
  return { entityKey, created: true };
}
