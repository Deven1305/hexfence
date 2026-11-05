import type { Address, Hex } from "viem";
import type { DecodedPayment } from "./decoder.js";
import { fingerprint } from "./fingerprint.js";

/**
 * What the client tells the user before they sign. Two kinds of RED, never mixed (spec §3.4):
 * `resembles` comes from the Safe's own payees; `listed` only from an EXACT match in Arkiv evidence.
 */
export type Verdict =
  | { level: "GREEN"; reason: "approved"; recipient: Address }
  | { level: "RED"; reason: "listed"; recipient: Address; evidenceIds: Hex[] } // P1 (T10): exact match only
  | { level: "RED"; reason: "resembles"; recipient: Address; payee: Address }
  | { level: "AMBER"; reason: "new"; recipient: Address }
  | { level: "GREY"; reason: "delegatecall" | "unsupported" | "admin" };

/**
 * Order: delegatecall/unsupported/admin -> GREY; recipient in payees -> GREEN;
 * listed (exact, case-insensitive) -> RED listed; same fingerprint as a payee -> RED resembles; else AMBER.
 * `listed` maps lowercase address -> evidenceIds. Pure function, no network.
 *
 * The synthetic Sepolia lookalike is not in the evidence, so it can only ever get RED resembles.
 */
export function verdictFor(p: DecodedPayment, payees: Address[], listed?: Map<string, Hex[]>): Verdict {
  if (p.kind === "admin" || p.kind === "delegatecall" || p.kind === "unsupported") {
    return { level: "GREY", reason: p.kind };
  }
  const recipient = p.recipient;
  const r = recipient.toLowerCase();

  if (payees.some((x) => x.toLowerCase() === r)) return { level: "GREEN", reason: "approved", recipient };

  const evidenceIds = listed?.get(r);
  if (evidenceIds && evidenceIds.length > 0) return { level: "RED", reason: "listed", recipient, evidenceIds };

  // The Guard rejects duplicate fingerprints, so at most one payee can match.
  const fp = fingerprint(recipient);
  const payee = payees.find((x) => fingerprint(x) === fp);
  if (payee) return { level: "RED", reason: "resembles", recipient, payee };

  return { level: "AMBER", reason: "new", recipient };
}
