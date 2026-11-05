import { describe, expect, it } from "vitest";
import { decodeSafeCall, verdictFor, type PoisoningEvidence } from "@hexfence/shared";
import type { Address, Hex } from "viem";
import { listedMap, listedStatusText, loadListed } from "../src/evidence";
import { buildPaymentCall } from "../src/payment";
import { verdictText } from "../src/verdictCopy";

const P: Address = "0x4E185e251Ac7fB83E9DE10723EAda46cadE74120";
const L: Address = "0x4E185a3FC4B530244aB9ed0dE38167b403344120";
const SAFE: Address = "0x2222222222222222222222222222222222222222";
const GUARD: Address = "0x3333333333333333333333333333333333333333";
const REAL_LOOKALIKE: Address = "0xdAC1aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1ec7";
const VICTIM: Address = "0x5555555555555555555555555555555555555555";
const USDT: Address = "0xdAC17F958D2ee523a2206206994597C13D831ec7";
const ID1 = `0x${"01".repeat(32)}` as Hex;
const ID2 = `0x${"02".repeat(32)}` as Hex;

const record = (lookalike: Address, evidenceId: Hex): PoisoningEvidence => ({
  evidenceId, chainId: 1, lookalike, impersonated: USDT, victim: VICTIM, variant: "zero-value", token: USDT,
  attackTx: `0x${"aa".repeat(32)}`, attackBlock: 2, referenceTx: `0x${"bb".repeat(32)}`, referenceBlock: 1,
  prefixLen: 4, suffixLen: 4, detectorVersion: "t", status: "suspected",
});
const eth = (to: Address) => decodeSafeCall(buildPaymentCall({ kind: "eth" }, to, 1n), { safe: SAFE, guard: GUARD });

describe("T10 listed signal", () => {
  const records = [record(REAL_LOOKALIKE, ID1), record(REAL_LOOKALIKE, ID2)];
  const map = listedMap(records);

  it("a listed address (exact, any case) is RED listed with its evidence ids", () => {
    const v = verdictFor(eth(REAL_LOOKALIKE), [P], map);
    expect(v).toMatchObject({ level: "RED", reason: "listed", evidenceIds: [ID1, ID2] });
    expect(verdictFor(eth(REAL_LOOKALIKE.toLowerCase() as Address), [P], map)).toMatchObject({ reason: "listed" });
  });
  it("the synthetic Sepolia lookalike L gets only RED resembles, never listed", () => {
    const v = verdictFor(eth(L), [P], map);
    expect(v).toMatchObject({ level: "RED", reason: "resembles" });
    expect(verdictText(v, { guardActive: true, publisher: "0xPUB" }).sentences.join(" ")).not.toMatch(/evidence|listed/i);
  });
  it("map is keyed on lookalike only: the impersonated address and the victim are not flagged", () => {
    expect(map.has(USDT.toLowerCase())).toBe(false);
    expect(map.has(VICTIM.toLowerCase())).toBe(false);
    expect(verdictFor(eth(USDT), [USDT], map)).toMatchObject({ level: "GREEN" });
    expect(verdictFor(eth(VICTIM), [P], map)).toMatchObject({ level: "AMBER" });
  });
  it("an approved payee stays GREEN even if some record lists it", () => {
    expect(verdictFor(eth(REAL_LOOKALIKE), [REAL_LOOKALIKE], map)).toMatchObject({ level: "GREEN" });
  });
  it("one bulk read; a failed read is labelled unavailable, never clean", async () => {
    let calls = 0;
    const ok = await loadListed(true, async () => (calls++, records));
    expect(calls).toBe(1);
    expect(ok).toMatchObject({ status: "ok", count: 2 });
    const bad = await loadListed(true, async () => {
      throw new Error("rate limited");
    });
    expect(bad).toEqual({ status: "unavailable", reason: "rate limited" });
    expect(listedStatusText(bad)).toMatch(/^Evidence unavailable/);
    expect((await loadListed(false, async () => records)).status).toBe("off");
  });
});
