import { describe, expect, it } from "vitest";
import { PoisoningEvidenceSchema } from "@hexfence/shared";
import type { Hex } from "viem";
import saved from "./fixtures/receipts.json";
import { groupCampaigns, chanceMatchProbability, matchComparison, utcHourBins, utcLabel } from "../src/campaigns.js";
const zero = PoisoningEvidenceSchema.parse(saved.zeroValue.evidence);
const dust = PoisoningEvidenceSchema.parse(saved.dust.evidence);
describe("campaign grouping", () => {
  it("groups a transaction across variants, deduplicates records and counts distinct mentioned victims", () => {
    const second = { ...dust, victim: "0x1111111111111111111111111111111111111111" as const, attackTx: zero.attackTx.toUpperCase().replace("0X", "0x") as Hex, attackBlock: zero.attackBlock };
    const data = groupCampaigns([zero, second, zero]);
    expect(data).toHaveLength(1); expect(data[0]?.victims).toBe(2); expect(data[0]?.records).toHaveLength(2);
  });
  it("keeps separate transactions separate and handles an empty corpus", () => {
    expect(groupCampaigns([zero, dust])).toHaveLength(2); expect(groupCampaigns([])).toEqual([]);
  });
});
describe("explicit random-middle model", () => {
  it("normalizes the distribution conditioned on 4+4 and excludes identical addresses", () => {
    const p = Array.from({ length: 32 }, (_, i) => chanceMatchProbability(i + 8));
    expect(p.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
    expect(p[0]).toBe((15 / 16) ** 2);
    expect(p.slice(2).reduce((a, b) => a + b, 0)).toBeCloseTo(23 / 2048, 12);
    expect(chanceMatchProbability(40)).toBe(0); expect(chanceMatchProbability(7)).toBe(0);
  });
  it("recomputes actual address matches instead of trusting claimed lengths", () => {
    const expected = matchComparison([zero, dust]);
    expect(matchComparison([{ ...zero, prefixLen: 40, suffixLen: 40 }, dust, zero])).toEqual(expected);
    expect(expected.reduce((n, d) => n + d.observed, 0)).toBe(2);
    expect(expected.reduce((n, d) => n + d.expected, 0)).toBeCloseTo(2, 10);
  });
});
describe("real timestamp bins", () => {
  it("uses UTC hour boundaries with gaps, includes both ends and deduplicates records", () => {
    const a = { ...zero, attackBlock: 100 }; const b = { ...dust, attackBlock: 200 };
    const times = new Map([[100, Date.parse("2026-11-06T01:59:59Z") / 1000], [200, Date.parse("2026-11-06T03:00:00Z") / 1000]]);
    expect(utcHourBins([a, a, b], times).map(b => b.count)).toEqual([1, 0, 1]);
    expect(utcLabel(times.get(100)!)).toBe("2026-11-06 01:59");
  });
  it("fails closed on incomplete or invalid timestamps", () => {
    expect(() => utcHourBins([zero], new Map())).toThrow("incomplete");
    expect(() => utcHourBins([zero], new Map([[zero.attackBlock, NaN]]))).toThrow();
    expect(utcHourBins([], new Map())).toEqual([]);
  });
});
