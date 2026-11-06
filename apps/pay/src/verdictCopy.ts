import type { Verdict } from "@hexfence/shared";

/** Colour class plus the sentences to show, in order. Strings are the fixed English text of spec §3.4. */
export interface VerdictText {
  level: Verdict["level"];
  sentences: string[];
  /** True when the "will refuse" claim was replaced because the Guard is not active on this Safe. */
  guardNotice: boolean;
}

export interface CopyContext {
  /** `safe.getGuard()` equals VITE_GUARD_ADDRESS. The "will refuse" claim is shown only when true. */
  guardActive: boolean;
  publisher?: string;
  /** Display language. RED resembles and AMBER use the spec 3.4 Hindi; the other verdicts were added 6 Nov. */
  lang?: Lang;
}

export type Lang = "en" | "hi";

export const GUARD_INACTIVE_SENTENCE =
  "HexFence Guard is not active on this Safe, so nothing on-chain will stop this payment.";

/**
 * Spec 3.4 Hindi, verbatim, split at its sentence boundaries. NOT yet checked by a native speaker (T12 stays blocked on that).
 * When the Guard is not active the last RED sentence ("your Safe will not make this payment") would be false, so the
 * Guard-inactive sentence is used instead; the page translates it through i18n.ts.
 */
export function hindiText(v: Verdict, ctx: CopyContext): VerdictText {
  if (v.level === "RED" && v.reason === "resembles") {
    return {
      level: "RED",
      sentences: [
        `संभावित एड्रेस पॉइज़निंग: यह प्राप्तकर्ता आपके स्वीकृत प्राप्तकर्ता ${v.payee} जैसा दिखता है (पहले 4 और आख़िरी 4 अक्षर समान), लेकिन यह अलग पता है।`,
        ctx.guardActive ? "आपका सुरक्षित Safe यह भुगतान नहीं करेगा।" : GUARD_INACTIVE_SENTENCE,
      ],
      guardNotice: !ctx.guardActive,
    };
  }
  if (v.level === "AMBER") {
    return {
      level: "AMBER",
      sentences: ["नया प्राप्तकर्ता: यह आपके स्वीकृत प्राप्तकर्ताओं में नहीं है।", "HexFence इस भुगतान को नहीं रोकेगा।", "पूरा पता प्राप्तकर्ता से मिलाकर देखें।"],
      guardNotice: false,
    };
  }
  const hi = (sentences: string[], guardNotice = false): VerdictText => ({ level: v.level, sentences, guardNotice });
  if (v.level === "RED") {
    return hi([`यह पता Arkiv पर सार्वजनिक पॉइज़निंग साक्ष्य में दर्ज है (Ethereum mainnet, प्रकाशक ${ctx.publisher ?? "अज्ञात"})। स्थिति: संदिग्ध। एक्सप्लोरर देखें।`]);
  }
  if (v.level === "GREEN") return hi([`स्वीकृत प्राप्तकर्ता ${v.recipient}।`]);
  if (v.reason === "delegatecall") {
    return ctx.guardActive
      ? hi(["यह delegatecall है। आपका HexFence Guard इसे अस्वीकार करेगा।"])
      : hi(["यह delegatecall है।", GUARD_INACTIVE_SENTENCE], true);
  }
  return hi(["इस प्रकार के लेनदेन की जाँच संभव नहीं। HexFence केवल ETH और ERC-20 ट्रांसफ़र जाँचता है।"]);
}

export function verdictText(v: Verdict, ctx: CopyContext): VerdictText {
  if (ctx.lang === "hi") return hindiText(v, ctx);
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
