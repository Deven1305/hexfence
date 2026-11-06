import type { Verdict } from "@hexfence/shared";

/** Fixed English presentation copied from Pay; parity is checked in test/copy.test.ts.
 * Decoding and verdict decisions are imported from @hexfence/shared, never duplicated here. */
export interface VerdictText {
  level: Verdict["level"];
  sentences: string[];
  /** True when the "will refuse" claim was replaced because the Guard is not active on this Safe. */
  guardNotice: boolean;
}

export interface CopyContext {
  /** Active Guard storage equals the configured HexFence Guard. */
  guardActive: boolean;
  publisher?: string;
}

export const GUARD_INACTIVE_SENTENCE =
  "HexFence Guard is not active on this Safe, so nothing on-chain will stop this payment.";

export function verdictText(v: Verdict, ctx: CopyContext): VerdictText {
  const t = (sentences: string[], guardNotice = false): VerdictText => ({ level: v.level, sentences, guardNotice });
  switch (v.level) {
    case "RED":
      if (v.reason === "resembles") {
        return t([
          "Possible address poisoning.",
          `This recipient resembles your approved payee ${v.payee} (same first 4 and last 4 characters) but is a different address.`,
          ctx.guardActive ? "Your protected Safe will refuse this payment." : GUARD_INACTIVE_SENTENCE,
        ], !ctx.guardActive);
      }
      return t([
        `This exact address is listed in public poisoning evidence on Arkiv (Ethereum mainnet, publisher ${ctx.publisher ?? "unknown"}). Status: suspected. See the explorer.`,
      ]);
    case "AMBER":
      return t([
        "New recipient: not one of your approved payees.",
        "HexFence will not block this payment.",
        "Check the full address with the recipient.",
      ]);
    case "GREEN":
      return t([`Approved payee ${v.recipient}.`]);
    case "GREY":
      if (v.reason === "delegatecall") {
        return ctx.guardActive
          ? t(["This is a delegatecall. Your HexFence Guard will refuse it."])
          : t(["This is a delegatecall.", GUARD_INACTIVE_SENTENCE], true);
      }
      return t(["Cannot verify this transaction type. HexFence checks only ETH and ERC-20 transfers."]);
  }
}
