import { evidenceId, matchLengths, MAINNET_USDT, type PoisoningEvidence } from "@hexfence/shared";
import { describe, expect, it } from "vitest";
import { fromArkivRow, toArkivValues } from "../src/codec.js";
import { POISONING_SCHEMA_NAME, PoisoningSchema } from "../src/schema.js";

// Synthetic values for the codec test only; they are not a real record.
const P = "0x4E185e251Ac7fB83E9DE10723EAda46cadE74120";
const L = "0x4E185a3FC4B530244aB9ed0dE38167b403344120";
const record: PoisoningEvidence = {
  evidenceId: evidenceId(1, L, P, "0.1.0"),
  chainId: 1,
  lookalike: L,
  impersonated: P,
  victim: "0x3333333333333333333333333333333333333333",
  variant: "dust",
  token: MAINNET_USDT,
  attackTx: `0x${"02".repeat(32)}`,
  attackBlock: 23_000_001,
  referenceTx: `0x${"01".repeat(32)}`,
  referenceBlock: 23_000_000,
  ...matchLengths(L, P),
  detectorVersion: "0.1.0",
  status: "suspected",
};

/** What a fetched row looks like: every bare string becomes a `str` cell, typed values stay typed. */
const asRow = (e: PoisoningEvidence) =>
  Object.fromEntries(
    Object.entries(toArkivValues(e)).map(([k, v]) => [k, typeof v === "string" ? { type: "str", value: v } : v]),
  );

describe("PoisoningSchema", () => {
  it("is named hexfence.poisoning.v1", () => {
    expect(POISONING_SCHEMA_NAME).toBe("hexfence.poisoning.v1");
    expect(PoisoningSchema).toBeDefined();
  });
});

describe("codec", () => {
  it("round-trips a record through Arkiv's typed values", () => {
    const values = toArkivValues(record);
    expect(values.attackBlock).toEqual({ type: "dec", value: "23000001" });
    expect(values.lookalike).toEqual({ type: "addr", value: L });
    expect(fromArkivRow(asRow(record))).toEqual(record);
  });

  it("accepts lower-case addresses from the node and checksums them", () => {
    const row = { ...asRow(record), victim: { type: "addr", value: record.victim.toLowerCase() } };
    expect(fromArkivRow(row)?.victim).toBe(record.victim);
  });

  it("drops rows someone else could have written wrongly", () => {
    expect(fromArkivRow({ ...asRow(record), status: { type: "str", value: "malicious" } })).toBeNull();
    expect(fromArkivRow({ ...asRow(record), evidenceId: { type: "str", value: `0x${"ff".repeat(32)}` } })).toBeNull();
    expect(fromArkivRow({ ...asRow(record), lookalike: { type: "addr", value: MAINNET_USDT } })).toBeNull();
    const { token: _drop, ...missing } = asRow(record);
    expect(fromArkivRow(missing)).toBeNull();
  });
});
