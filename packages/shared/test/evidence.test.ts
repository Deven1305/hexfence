import { describe, expect, it } from "vitest";
import { evidenceId, matchLengths, PoisoningEvidenceSchema } from "../src/evidence.js";

// Synthetic values for the schema test only; they are not a real record.
const P = "0x4E185e251Ac7fB83E9DE10723EAda46cadE74120";
const L = "0x4E185a3FC4B530244aB9ed0dE38167b403344120";
const VICTIM = "0x3333333333333333333333333333333333333333";
const USDT = "0xdAC17F958D2ee523a2206206994597C13D831ec7";
const tx = (n: number) => `0x${n.toString(16).padStart(64, "0")}`;

const valid = () => ({
  evidenceId: evidenceId(1, L, P, "0.1.0"),
  chainId: 1,
  lookalike: L,
  impersonated: P,
  victim: VICTIM,
  variant: "zero-value",
  attackBlock: 101,
  detectorVersion: "0.1.0",
  token: USDT,
  attackTx: tx(2),
  referenceTx: tx(1),
  referenceBlock: 100,
  ...matchLengths(L, P),
  status: "suspected",
});

describe("PoisoningEvidenceSchema", () => {
  it("accepts a well-formed record and checksums addresses", () => {
    const r = PoisoningEvidenceSchema.parse({ ...valid(), victim: VICTIM.toLowerCase() });
    expect(r.victim).toBe(VICTIM);
    expect(r.prefixLen).toBe(5); // 4E185 shared
    expect(r.suffixLen).toBe(4); // 4120
  });

  it("only ever allows status 'suspected'", () => {
    expect(PoisoningEvidenceSchema.safeParse({ ...valid(), status: "malicious" }).success).toBe(false);
  });

  it("rejects records that are not a real resemblance or are out of order", () => {
    const usdtLookalike = { ...valid(), lookalike: USDT, evidenceId: evidenceId(1, USDT, P, "0.1.0") };
    expect(PoisoningEvidenceSchema.safeParse(usdtLookalike).success).toBe(false);
    expect(PoisoningEvidenceSchema.safeParse({ ...valid(), referenceBlock: 102 }).success).toBe(false);
    expect(PoisoningEvidenceSchema.safeParse({ ...valid(), variant: "spoof" }).success).toBe(false);
  });

  it("accepts only mainnet USDT/USDC and chainId 1", () => {
    expect(PoisoningEvidenceSchema.safeParse({ ...valid(), token: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" }).success).toBe(true);
    expect(PoisoningEvidenceSchema.safeParse({ ...valid(), token: VICTIM }).success).toBe(false);
    const sepolia = { ...valid(), chainId: 11155111, evidenceId: evidenceId(11155111, L, P, "0.1.0") };
    expect(PoisoningEvidenceSchema.safeParse(sepolia).success).toBe(false);
  });

  it("rejects a forged evidenceId and unknown fields (no made-up confidence)", () => {
    expect(PoisoningEvidenceSchema.safeParse({ ...valid(), evidenceId: tx(9) }).success).toBe(false);
    expect(PoisoningEvidenceSchema.safeParse({ ...valid(), confidence: 0.9 }).success).toBe(false);
  });
});

describe("evidenceId", () => {
  it("is stable, case-insensitive and depends on every input", () => {
    const id = evidenceId(1, L, P, "0.1.0");
    expect(id).toMatch(/^0x[0-9a-f]{64}$/);
    expect(evidenceId(1, L.toLowerCase() as `0x${string}`, P.toLowerCase() as `0x${string}`, "0.1.0")).toBe(id);
    expect(evidenceId(11155111, L, P, "0.1.0")).not.toBe(id);
    expect(evidenceId(1, P, L, "0.1.0")).not.toBe(id);
    expect(evidenceId(1, L, P, "0.2.0")).not.toBe(id);
  });
});
