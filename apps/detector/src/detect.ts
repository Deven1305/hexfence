import {
  evidenceId,
  fingerprint,
  matchLengths,
  PoisoningEvidenceSchema,
  type PoisoningEvidence,
} from "@hexfence/shared";
import { getAddress, type Address, type Hex } from "viem";

/** Bump when the rules change: it is part of every evidenceId. */
export const DETECTOR_VERSION = "0.1.0";

/** Spec §2: reference payment value >= 1 token, dust is 0 < value < 1 token (both tokens have 6 decimals). */
export const ONE_TOKEN = 1_000_000n;
/** Spec §2: the reference must be within the latest 7,200 blocks (about 24 hours) before the attack. */
export const WINDOW_BLOCKS = 7_200;

/** One ERC-20 `Transfer(from, to, value)` log, already decoded. */
export interface TransferLog {
  token: Address;
  from: Address;
  to: Address;
  value: bigint;
  blockNumber: number;
  logIndex: number;
  txHash: Hex;
}

interface Reference {
  recipient: Address;
  blockNumber: number;
  logIndex: number;
  txHash: Hex;
}

/**
 * Spec §3.2, in block and log order:
 * - a reference payment is `victim -> recipient` with value >= 1 token;
 * - an attack is a zero-value `victim -> lookalike` or a dust `lookalike -> victim` transfer;
 * - it matches when an earlier reference of the same victim, within WINDOW_BLOCKS, went to a
 *   different address with the same fingerprint as the lookalike.
 * Returns one record per (lookalike, impersonated): the earliest attack found. Every record is
 * validated by PoisoningEvidenceSchema.
 */
export function detect(logs: readonly TransferLog[], detectorVersion = DETECTOR_VERSION): PoisoningEvidence[] {
  const ordered = [...logs].sort((a, b) => a.blockNumber - b.blockNumber || a.logIndex - b.logIndex);
  // refs[victim][fingerprint] = the victim's real payments to addresses with that fingerprint.
  const refs = new Map<string, Map<Hex, Reference[]>>();
  const found = new Map<Hex, PoisoningEvidence>();

  for (const log of ordered) {
    const zeroValue = log.value === 0n;
    const dust = log.value > 0n && log.value < ONE_TOKEN;

    // Check the attack shapes before recording references, so a transfer never matches itself.
    if (zeroValue) match(log, getAddress(log.from), getAddress(log.to), "zero-value");
    else if (dust) match(log, getAddress(log.to), getAddress(log.from), "dust");
    else remember(log);
  }
  return [...found.values()];

  function remember(log: TransferLog): void {
    const victim = log.from.toLowerCase();
    const fp = fingerprint(log.to);
    let byFp = refs.get(victim);
    if (!byFp) refs.set(victim, (byFp = new Map()));
    const list = byFp.get(fp) ?? [];
    list.push({ recipient: getAddress(log.to), blockNumber: log.blockNumber, logIndex: log.logIndex, txHash: log.txHash });
    byFp.set(fp, list);
  }

  function match(log: TransferLog, victim: Address, lookalike: Address, variant: "zero-value" | "dust"): void {
    if (victim.toLowerCase() === lookalike.toLowerCase()) return;
    const candidates = refs.get(victim.toLowerCase())?.get(fingerprint(lookalike));
    if (!candidates) return;
    // The most recent earlier reference to a DIFFERENT address, still inside the window.
    for (let i = candidates.length - 1; i >= 0; i--) {
      const ref = candidates[i]!;
      if (log.blockNumber - ref.blockNumber > WINDOW_BLOCKS) break; // older ones are further out
      if (ref.recipient.toLowerCase() === lookalike.toLowerCase()) continue;
      const id = evidenceId(1, lookalike, ref.recipient, detectorVersion);
      if (found.has(id)) return; // keep the earliest attack for this pair
      const record = PoisoningEvidenceSchema.parse({
        evidenceId: id,
        chainId: 1,
        lookalike,
        impersonated: ref.recipient,
        victim,
        variant,
        token: log.token,
        attackTx: log.txHash,
        attackBlock: log.blockNumber,
        referenceTx: ref.txHash,
        referenceBlock: ref.blockNumber,
        ...matchLengths(lookalike, ref.recipient),
        detectorVersion,
        status: "suspected",
      });
      found.set(id, record);
      return;
    }
  }
}
