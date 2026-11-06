import { getAddress, isAddress, type Address } from "viem";
import type { PoisoningEvidence } from "@hexfence/shared";

/** The primary publisher, then any extra ones from a comma-separated list. Duplicates are dropped; entries that are not addresses are returned in `invalid`. */
export function parsePublishers(primary: Address, extra: string): { publishers: Address[]; invalid: string[] } {
  const publishers = [getAddress(primary)];
  const invalid: string[] = [];
  for (const raw of extra.split(",").map((s) => s.trim()).filter(Boolean)) {
    if (!isAddress(raw, { strict: false })) invalid.push(raw);
    else if (!publishers.includes(getAddress(raw))) publishers.push(getAddress(raw));
  }
  return { publishers, invalid };
}

/**
 * For each evidenceId, how many different publishers published it. The id is a hash of chain, lookalike, impersonated
 * address and detector version, and every row is checked against it when read, so the same id from two publishers means
 * two detector runs produced the same record. A publisher counts once however many copies it posted.
 */
export function agreement(byPublisher: Map<string, PoisoningEvidence[]>): Map<string, number> {
  const out = new Map<string, number>();
  for (const records of byPublisher.values()) {
    for (const id of new Set(records.map((r) => r.evidenceId.toLowerCase()))) out.set(id, (out.get(id) ?? 0) + 1);
  }
  return out;
}

export function agreementText(count: number, read: number): string {
  const noun = read === 1 ? "publisher" : "publishers";
  if (read === 1) return `Published by ${count} of ${read} ${noun} read. Only one publisher is read here, so there is no second publisher to agree with it.`;
  return `Published by ${count} of ${read} ${noun} read.`;
}
