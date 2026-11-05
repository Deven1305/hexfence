import { evidenceId, MAINNET_USDT, type PoisoningEvidence } from "@hexfence/shared";
import { getAddress, type Hex } from "viem";
import { describe, expect, it } from "vitest";
import { labelSheet, precisionOf, sampleRecords } from "../src/labels.js";

// Synthetic records (not real users), only to exercise sampling and the CSV round trip.
const V = getAddress("0x1111111111111111111111111111111111111111");
const R = getAddress("0x2ef9a83c5e1b77d04c3f9a2b6d81e0c452d18bf7");
const rec = (i: number): PoisoningEvidence => {
  const L = getAddress(`0x2ef9${i.toString(16).padStart(32, "0")}8bf7`);
  return {
    evidenceId: evidenceId(1, L, R, "0.1.0"),
    chainId: 1,
    lookalike: L,
    impersonated: R,
    victim: V,
    variant: "zero-value",
    token: MAINNET_USDT,
    attackTx: `0x${(i + 1).toString(16).padStart(64, "0")}` as Hex,
    attackBlock: 100 + i,
    referenceTx: `0x${"aa".repeat(32)}` as Hex,
    referenceBlock: 100,
    prefixLen: 4,
    suffixLen: 4,
    detectorVersion: "0.1.0",
    status: "suspected",
  };
};
const records = Array.from({ length: 100 }, (_, i) => rec(i));

describe("labelling sheet (T13 / H9)", () => {
  it("samples deterministically, without repeats, whatever the input order", () => {
    const a = sampleRecords(records, 30, 7);
    expect(a).toHaveLength(30);
    expect(new Set(a.map((e) => e.evidenceId)).size).toBe(30);
    expect(sampleRecords([...records].reverse(), 30, 7)).toEqual(a);
    expect(sampleRecords(records, 30, 8)).not.toEqual(a);
  });

  it("writes Etherscan links and an empty label column", () => {
    const csv = labelSheet(sampleRecords(records, 3, 1));
    const lines = csv.trim().split("\n");
    expect(lines[0]).toBe("n,label,variant,victim,impersonated,lookalike,attack_tx,reference_tx,notes");
    expect(lines[1]).toMatch(/^1,,zero-value,0x/);
    expect(lines[1]).toContain("https://etherscan.io/tx/0x");
    expect(precisionOf(csv)).toEqual({ yes: 0, no: 0, unsure: 0, unlabelled: 3, precision: null });
  });

  it("computes precision = yes / (yes + no), leaving unsure out", () => {
    const filled = ["n,label,notes", "1,yes,", "2,YES,", "3,no,", "4,unsure,", "5,,"].join("\n");
    expect(precisionOf(filled)).toEqual({ yes: 2, no: 1, unsure: 1, unlabelled: 1, precision: 2 / 3 });
    expect(() => precisionOf("n,label\n1,maybe")).toThrow();
  });
});
