import { PoisoningEvidenceSchema, type PoisoningEvidence } from "@hexfence/shared";
import { formatTransactionReceipt, type RpcTransactionReceipt } from "viem";
import { describe, expect, it } from "vitest";
import { checkReceipts, verificationText, verifyOnEthereum, type ReceiptReader } from "../src/verify.js";
import saved from "./fixtures/receipts.json";

// Real records from a detector run and their real mainnet receipts (eth_getTransactionReceipt, logsBloom dropped).
function load(name: "zeroValue" | "dust") {
  const s = saved[name];
  const format = (r: unknown) => formatTransactionReceipt({ logsBloom: "0x", ...(r as object) } as unknown as RpcTransactionReceipt);
  return {
    evidence: PoisoningEvidenceSchema.parse(s.evidence),
    attack: format(s.attackReceipt),
    reference: format(s.referenceReceipt),
  };
}

const reader = (attack: unknown, reference: unknown, e: PoisoningEvidence): ReceiptReader => ({
  getTransactionReceipt: async ({ hash }) => (hash === e.attackTx ? attack : reference) as never,
});

describe.each(["zeroValue", "dust"] as const)("%s record", (name) => {
  const { evidence: e, attack, reference } = load(name);

  it("verifies against its saved receipts", async () => {
    expect(checkReceipts(e, attack, reference)).toEqual({ ok: true });
    const v = await verifyOnEthereum(reader(attack, reference, e), e);
    expect(verificationText(v)).toContain("✓");
  });

  const broken: [string, () => ReturnType<typeof checkReceipts>, RegExp][] = [
    ["another lookalike", () => checkReceipts({ ...e, lookalike: e.impersonated }, attack, reference), /attack transaction/],
    ["another victim", () => checkReceipts({ ...e, victim: e.lookalike }, attack, reference), /attack transaction/],
    ["another variant", () => checkReceipts({ ...e, variant: name === "dust" ? "zero-value" : "dust" }, attack, reference), /attack transaction/],
    ["another impersonated address", () => checkReceipts({ ...e, impersonated: e.lookalike }, attack, reference), /reference transaction/],
    ["a non-canonical token", () => checkReceipts({ ...e, token: e.victim }, attack, reference), /USDT or USDC/],
    ["a reverted attack", () => checkReceipts(e, { ...attack, status: "reverted" }, reference), /reverted/],
    ["a wrong attack block", () => checkReceipts({ ...e, attackBlock: e.attackBlock + 1 }, attack, reference), /recorded block/],
    ["a reference after the attack", () => checkReceipts(e, attack, { ...reference, blockNumber: attack.blockNumber + 1n }), /recorded block|not earlier/],
    ["swapped receipts", () => checkReceipts(e, reference, attack), /attack transaction/],
  ];
  it.each(broken)("could not verify with %s", (_label, run, reason) => {
    const v = run();
    expect(v.ok).toBe(false);
    expect(verificationText(v)).toMatch(/^could not verify: /);
    expect(verificationText(v)).toMatch(reason);
  });

  it("could not verify when the reference is later, even with the recorded block adjusted", () => {
    const later = attack.blockNumber + 1n;
    const v = checkReceipts({ ...e, referenceBlock: Number(later) }, attack, { ...reference, blockNumber: later });
    expect(v).toEqual({ ok: false, reason: "the reference payment is not earlier than the attack" });
  });

  it("could not verify when the RPC fails, rather than passing", async () => {
    const down: ReceiptReader = {
      getTransactionReceipt: async () => {
        throw new Error("rate limited");
      },
    };
    const v = await verifyOnEthereum(down, e);
    expect(verificationText(v)).toBe("could not verify: could not read the receipts (rate limited)");
  });
});
