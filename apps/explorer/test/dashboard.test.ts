import { PoisoningEvidenceSchema, MAINNET_USDC } from "@hexfence/shared";
import { describe, expect, it } from "vitest";
import { aggregateEvidence, checkOwnAddress } from "../src/dashboard.js";
import saved from "./fixtures/receipts.json";

const zero = PoisoningEvidenceSchema.parse(saved.zeroValue.evidence);
const dust = PoisoningEvidenceSchema.parse(saved.dust.evidence);

describe("downloaded evidence views", () => {
  it("handles an empty or partial download without inventing counts", () => {
    expect(aggregateEvidence([])).toEqual({ total: 0, variants: new Map(), tokens: new Map(), timeline: [] });
    const data = aggregateEvidence([zero]);
    expect(data.total).toBe(1);
    expect([...data.variants]).toEqual([["zero-value", 1]]);
    expect(data.timeline).toEqual([{ from: zero.attackBlock, to: zero.attackBlock, count: 1 }]);
  });

  it("counts variants and tokens case insensitively and deduplicates pages", () => {
    const data = aggregateEvidence([zero, { ...zero }, { ...dust, token: MAINNET_USDC }]);
    expect(data.total).toBe(2);
    expect(data.variants.get("zero-value")).toBe(1);
    expect(data.variants.get("dust")).toBe(1);
    expect([...data.tokens.values()].reduce((a, b) => a + b, 0)).toBe(2);
    expect(data.tokens.get(MAINNET_USDC.toLowerCase())).toBeGreaterThanOrEqual(1);
  });

  it("uses ordered, inclusive block bins with gaps and includes both endpoints", () => {
    const data = aggregateEvidence([{ ...dust, attackBlock: 200 }, { ...zero, attackBlock: 100 }]);
    expect(data.timeline[0]?.from).toBe(100);
    expect(data.timeline.at(-1)?.to).toBe(200);
    expect(data.timeline[0]?.count).toBe(1);
    expect(data.timeline.at(-1)?.count).toBe(1);
    expect(data.timeline.some((bin) => bin.count === 0)).toBe(true);
    expect(data.timeline.reduce((n, bin) => n + bin.count, 0)).toBe(2);
  });
});

describe("browser-only own-address check", () => {
  it.each(["lookalike", "impersonated", "victim"] as const)("matches the exact %s in any case", (role) => {
    expect(checkOwnAddress([zero, zero], ` ${zero[role].toUpperCase().replace("0X", "0x")} `)).toEqual([zero]);
  });

  it("rejects invalid inputs and does not confuse a fingerprint resemblance with equality", () => {
    expect(checkOwnAddress([zero], "vitalik.eth")).toBeNull();
    expect(checkOwnAddress([zero], "0x1234")).toBeNull();
    expect(checkOwnAddress([], zero.lookalike)).toEqual([]);
    const other = `${zero.lookalike.slice(0, 12)}${zero.lookalike[12] === "0" ? "1" : "0"}${zero.lookalike.slice(13)}`;
    expect(checkOwnAddress([zero], other)).toEqual([]);
  });
});
