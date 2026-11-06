// Re-export fingerprint functions and types from @hexfence/shared
export {
  fingerprint,
  sameFingerprint,
  isLookalike,
  sameAddress,
  checksum,
  type Fingerprint,
} from "@hexfence/shared";

// Re-export verdict functions and types from @hexfence/shared
export {
  verdictFor,
  type Verdict,
} from "@hexfence/shared";

// Bloom filter for offline evidence checking
export {
  EvidenceBloomFilter,
  createEvidenceBloomFilter,
  type BloomFilterJSON,
} from "./bloom.js";

import type { Address } from "viem";
import { fingerprint, sameAddress } from "@hexfence/shared";
import type { EvidenceBloomFilter } from "./bloom.js";

export type SimpleCheckVerdict =
  | { level: "GREEN"; reason: "approved"; recipient: Address }
  | { level: "RED"; reason: "listed"; recipient: Address }
  | { level: "RED"; reason: "resembles"; recipient: Address; payee: Address }
  | { level: "AMBER"; reason: "new"; recipient: Address };

/**
 * Pure offline check of a candidate recipient address against approved payees
 * and an optional offline evidence bloom filter.
 *
 * Runs completely locally with zero network calls.
 */
export function checkRecipientOffline(
  recipient: Address,
  approvedPayees: Address[],
  evidenceFilter?: EvidenceBloomFilter,
): SimpleCheckVerdict {
  if (approvedPayees.some((p) => sameAddress(p, recipient))) {
    return { level: "GREEN", reason: "approved", recipient };
  }

  if (evidenceFilter && evidenceFilter.has(recipient)) {
    return { level: "RED", reason: "listed", recipient };
  }

  const fp = fingerprint(recipient);
  const resembles = approvedPayees.find((p) => fingerprint(p) === fp);
  if (resembles) {
    return { level: "RED", reason: "resembles", recipient, payee: resembles };
  }

  return { level: "AMBER", reason: "new", recipient };
}
