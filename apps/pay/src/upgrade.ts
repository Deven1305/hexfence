import { decodeSafeCall, verdictFor, verdictForV2, type SafeCall, type VerdictV2 } from "@hexfence/shared";
import type { Address, Hex } from "viem";
import deployment from "../../../contracts/deployments/v2-sepolia.json";
import type { SafeInfo } from "./safe";
import { verdictText, type CopyContext, type VerdictText } from "./verdictCopy";

/** Public deployment record, not a synthetic address or an ABI-based guess. */
export const V2_GUARD = deployment.guard as Address;
export function paymentVerdict(call: SafeCall, info: SafeInfo, v1Guard: Address, listed?: Map<string, Hex[]>): VerdictV2 {
  return info.v2
    ? verdictForV2(call, { safe: info.address, guard: info.v2.guard }, info.v2.known, listed)
    : verdictFor(decodeSafeCall(call, { safe: info.address, guard: v1Guard }), info.payees, listed);
}
function recordedDate(timestamp: bigint): string {
  if (timestamp <= 0n || timestamp > 8640000000000n) return "date unavailable";
  return new Date(Number(timestamp) * 1000).toISOString().replace("T", " ").replace(".000Z", " UTC");
}
export function paymentVerdictText(v: VerdictV2, ctx: CopyContext, info: SafeInfo): VerdictText & { englishOnly?: boolean } {
  if (v.reason === "known") return { level: v.level, guardNotice: false, englishOnly: true, sentences: [
    `Recorded recipient ${v.recipient}. First recorded execution: ${recordedDate(v.firstPaidAt)}.`,
  ] };
  if (v.reason === "resembles-known") return { level: v.level, guardNotice: !ctx.guardActive, englishOnly: true, sentences: [
    `This recipient resembles a recipient recorded by this Safe: ${v.payee} (same first 4 and last 4 characters), but is a different address.`,
    `First recorded execution: ${recordedDate(v.firstPaidAt)}.`,
    ctx.guardActive ? "Your active Auto-Fence Guard will refuse this payment." : "HexFence Guard is not active on this Safe.",
  ] };
  if (info.v2 && v.level === "AMBER") return { level: v.level, guardNotice: false, englishOnly: true, sentences: [
    "New recipient: no matching recorded recipient. Check the full address with the recipient.",
    info.v2.autoLearn ? "Automatic learning is on; the Guard records recognized nonzero recipients after successful execution." : "Automatic learning is off.",
  ] };
  return verdictText(v, ctx);
}
