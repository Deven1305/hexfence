import { parseAbi, type Address, type Hex } from "viem";
import { decodeSafeCall, type SafeCall } from "./decoder.js";
import { fingerprint, sameAddress } from "./fingerprint.js";
import type { Verdict } from "./verdict.js";

export interface KnownRecipient { recipient: Address; approved: boolean; firstPaidAt: bigint }
export type VerdictV2 = Verdict
  | { level: "GREEN"; reason: "known"; recipient: Address; firstPaidAt: bigint }
  | { level: "RED"; reason: "resembles-known"; recipient: Address; payee: Address; firstPaidAt: bigint };

/** Pure preview of V2's native-value check followed by its token-recipient check.
 * Unsupported calls remain GREY unless their ETH destination collides.
 * Dates are on-chain timestamps of successful payment-shaped Safe executions,
 * not a claim about ERC-20 return values or pre-installation payment history.
 */
export function verdictForV2(call: SafeCall, ctx: { safe: Address; guard: Address }, known: readonly KnownRecipient[], listed?: Map<string, Hex[]>): VerdictV2 {
  const payment = decodeSafeCall(call, ctx);
  if (payment.kind === "admin" || payment.kind === "delegatecall") return { level: "GREY", reason: payment.kind };
  const recipients: Address[] = [];
  if (call.value > 0n || payment.kind === "eth") recipients.push(call.to);
  if (payment.kind === "erc20-transfer" || payment.kind === "erc20-transferFrom") recipients.push(payment.recipient);
  // Follow the contract's native-first error order, including mixed calls.
  for (const recipient of recipients) {
    const holder = known.find(k => fingerprint(k.recipient) === fingerprint(recipient));
    if (holder && !sameAddress(holder.recipient, recipient)) return holder.approved
      ? { level: "RED", reason: "resembles", recipient, payee: holder.recipient }
      : { level: "RED", reason: "resembles-known", recipient, payee: holder.recipient, firstPaidAt: holder.firstPaidAt };
  }
  if (payment.kind === "unsupported") return { level: "GREY", reason: "unsupported" };
  for (const recipient of recipients) {
    if (known.some(k => sameAddress(k.recipient, recipient))) continue;
    const ids = listed?.get(recipient.toLowerCase());
    if (ids?.length) return { level: "RED", reason: "listed", recipient, evidenceIds: ids };
  }
  const unknown = recipients.find(r => !known.some(k => sameAddress(k.recipient, r)));
  if (unknown) return { level: "AMBER", reason: "new", recipient: unknown };
  const holder = known.find(k => sameAddress(k.recipient, payment.recipient));
  if (!holder) return { level: "AMBER", reason: "new", recipient: payment.recipient };
  return holder.approved ? { level: "GREEN", reason: "approved", recipient: payment.recipient }
    : { level: "GREEN", reason: "known", recipient: payment.recipient, firstPaidAt: holder.firstPaidAt };
}

export const hexFenceGuardV2Abi = parseAbi([
  "function knownRecipients(address) view returns (address[])",
  "function recipientDetails(address) view returns ((address recipient,bool approved,uint64 firstPaidAt)[])",
  "function holderOf(address,bytes4) view returns (address)",
  "function autoLearn(address) view returns (bool)",
  "function setAutoLearn(bool)", "function approve(address)", "function forget(address)",
  "function fingerprint(address) pure returns (bytes4)",
  "error LookalikeOfKnownRecipient(address recipient,address knownHolder)",
  "error FingerprintAlreadyHeld(bytes4 fingerprint,address holder)",
  "error DelegateCallNotAllowed(address target)",
  "error ZeroAddressRecipient()", "error UnknownRecipient(address recipient)",
]);
