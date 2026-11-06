import { ExpirationTime } from "@arkiv-network/sdk";
import { eq } from "@arkiv-network/sdk/query";
import { bytes, defineSchema, str, type Column, type Schema } from "@arkiv-network/sdk/schema";
import { sha256, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arkivReadClient } from "./read.js";
import { arkivWalletClient, type WriterOptions } from "./write.js";

/** `hexfence.release.v1`: the SHA256SUMS of one Pages build, keyed by commit. */
const manifestColumn: Column<"bytes", false, false, false> = bytes();
export const ReleaseSchema: Schema<{
  commit: Column<"str", true, false, false>;
  sumsSha256: Column<"str", true, false, false>;
  sums: Column<"bytes", false, false, false>;
}> = defineSchema("hexfence.release.v1", {
  commit: str().indexed(),
  sumsSha256: str().indexed(),
  sums: manifestColumn,
});

// Leave room below the 128 KiB entity payload limit for the other attributes.
export const MAX_RELEASE_MANIFEST_BYTES = 64 * 1024;

/** Validate and encode before making a network request or constructing a wallet. */
export function releaseValues(commit: string, sums: string, sumsSha256: string) {
  if (!/^[0-9a-f]{40}$/.test(commit)) throw new Error("commit must be a full lowercase sha");
  if (!sums.trim()) throw new Error("SHA256SUMS is empty");
  const encoded = new TextEncoder().encode(sums);
  if (encoded.length > MAX_RELEASE_MANIFEST_BYTES) throw new Error("SHA256SUMS exceeds 64 KiB");
  if (!/^[0-9a-f]{64}$/.test(sumsSha256) || sha256(encoded).slice(2) !== sumsSha256)
    throw new Error("SHA256SUMS digest mismatch");
  const paths = new Set<string>();
  for (const line of sums.trimEnd().split("\n")) {
    const match = /^([0-9a-f]{64})  ([^\r\n]+)$/.exec(line);
    const path = match?.[2];
    if (!path || path.startsWith("/") || path.includes("\\") || path.split("/").some(p => p === ".." || p === "." || !p) || paths.has(path))
      throw new Error("Invalid or duplicate SHA256SUMS path/line");
    paths.add(path);
  }
  return { commit, sumsSha256, sums: bytes(encoded) };
}

/** Node only. Idempotent per commit for this publisher. */
export async function writeRelease(opts: WriterOptions, commit: string, sums: string, sumsSha256: string): Promise<{ entityKey: Hex; created: boolean }> {
  const values = releaseValues(commit, sums, sumsSha256);
  const reader = arkivReadClient(opts.accessKey === undefined ? {} : { accessKey: opts.accessKey });
  const publisher = privateKeyToAccount(opts.privateKey).address;
  const existing = await reader.select({ $key: true, sumsSha256: true }).from(ReleaseSchema).createdBy(publisher).where(eq("commit", commit)).limit(1).fetch();
  const found = existing.entities[0];
  if (found) {
    if (found.sumsSha256.value !== sumsSha256) throw new Error("Existing release has a different manifest digest");
    return { entityKey: found.$key as Hex, created: false };
  }
  const { entityKey } = await arkivWalletClient(opts).createEntity(
    ReleaseSchema,
    values,
    { expiration: ExpirationTime.fromDays(90) },
  );
  return { entityKey, created: true };
}
