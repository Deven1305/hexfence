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
import { verdictFor, type Verdict } from "@hexfence/shared";
import type { EvidenceBloomFilter } from "./bloom.js";

export type OfflineCheck = {
  /** The same verdict as @hexfence/shared. A filter hit never changes it. */
  verdict: Verdict;
  /**
   * True when the filter may contain this address. A filter can return false
   * positives, so this means "possibly listed" and needs the full evidence
   * set to confirm. False means it is not in the set the filter was built from.
   */
  possiblyListed: boolean;
};

/**
 * Check a recipient against approved payees and an optional evidence filter.
 * Runs locally with zero network calls.
 */
export function checkRecipientOffline(
  recipient: Address,
  approvedPayees: Address[],
  evidenceFilter?: EvidenceBloomFilter,
): OfflineCheck {
  return {
    verdict: verdictFor({ kind: "eth", recipient, amount: 0n }, approvedPayees),
    possiblyListed: evidenceFilter?.has(recipient) ?? false,
  };
}
