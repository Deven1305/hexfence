import { decodeErrorResult, isHex, type Address, type Hex } from "viem";
import { hexFenceGuardAbi, hexFenceGuardV2Abi } from "@hexfence/shared";

export type RevertInfo =
  | { kind: "lookalike"; recipient: Address; approvedPayee: Address }
  | { kind: "known-lookalike"; recipient: Address; holder: Address }
  | { kind: "guard"; name: string; text: string }
  | { kind: "reason"; text: string }
  | { kind: "unknown"; text: string };

/** The revert data in a viem error (or one of its causes), same walk viem's own getRevertErrorData uses. */
export function revertData(err: unknown): Hex | undefined {
  let e: unknown = err;
  for (let depth = 0; depth < 10 && typeof e === "object" && e !== null; depth++) {
    const d = (e as { data?: unknown }).data;
    if (typeof d === "string" && isHex(d) && d.length >= 10) return d;
    if (typeof d === "object" && d !== null) {
      const inner = (d as { data?: unknown }).data;
      if (typeof inner === "string" && isHex(inner) && inner.length >= 10) return inner;
    }
    e = (e as { cause?: unknown }).cause;
  }
  return undefined;
}

/** Decode a failed call: the Guard's custom errors via `hexFenceGuardAbi`, `Error(string)` reasons (Safe's GSxxx), else unknown. */
export function interpretRevert(err: unknown): RevertInfo {
  const data = revertData(err);
  if (data) {
    try {
      const d = decodeErrorResult({ abi: [...hexFenceGuardAbi, ...hexFenceGuardV2Abi], data });
      if (d.errorName === "LookalikeOfApprovedPayee") {
        const [recipient, approvedPayee] = d.args as [Address, Address];
        return { kind: "lookalike", recipient, approvedPayee };
      }
      if (d.errorName === "LookalikeOfKnownRecipient") {
        const [recipient, holder] = d.args as [Address, Address];
        return { kind: "known-lookalike", recipient, holder };
      }
      const name: string = d.errorName;
      if (name === "Error" || name === "Panic") return { kind: "reason", text: `${name}: ${(d.args ?? []).join(", ")}` };
      return { kind: "guard", name: d.errorName, text: `${d.errorName}(${(d.args ?? []).join(", ")})` };
    } catch {
      // not one of the Guard's errors
    }
    try {
      const d = decodeErrorResult({ abi: [], data });
      return { kind: "reason", text: `${d.errorName}: ${(d.args ?? []).join(", ")}` };
    } catch {
      return { kind: "unknown", text: `Reverted with unrecognised data ${data}` };
    }
  }
  const msg = err instanceof Error ? (("shortMessage" in err && typeof err.shortMessage === "string" ? err.shortMessage : err.message)) : String(err);
  return { kind: "unknown", text: msg };
}

export function describeRevert(r: RevertInfo): string {
  switch (r.kind) {
    case "known-lookalike":
      return `Refused on-chain by HexFence Guard: LookalikeOfKnownRecipient(${r.recipient}, ${r.holder}).`;
    case "lookalike":
      return `Refused on-chain by HexFence Guard: LookalikeOfApprovedPayee(${r.recipient}, ${r.approvedPayee}).`;
    case "guard":
      return `Refused on-chain by HexFence Guard: ${r.text}.`;
    default:
      return r.text;
  }
}
