import { describe, expect, it } from "vitest";
import { SuspectedLossSchema, lossKey, rescuePackBody } from "../src/loss.js";
import { lossFixture } from "./fixtures/loss.js";
import { createHash } from "node:crypto";
describe("loss records and sealed core", () => {
  it("validates the incident and keys idempotence by evidenceId and loss transaction", () => {
    const e = lossFixture(); expect(SuspectedLossSchema.parse(e)).toEqual(e);
    expect(lossKey(e)).toBe(`${e.evidenceId}:${e.lossTx}`);
  });
  it("rejects bad chronology, amounts, status and id", () => {
    for (const delta of [{ lossBlock: 9 }, { amount: "0" }, { amount: "999999" }, { status: "confirmed" }, { evidenceId: `0x${"00".repeat(32)}` }]) expect(SuspectedLossSchema.safeParse({ ...lossFixture(), ...delta }).success).toBe(false);
  });
  it("hashes reproducible UTF-8 bytes with no self-referential digest", () => {
    const e = lossFixture(); const body = rescuePackBody(e);
    e.packHash = createHash("sha256").update(body).digest("hex");
    expect(createHash("sha256").update(body).digest("hex")).toBe(e.packHash);
    expect(body).not.toContain(e.packHash); expect(body.endsWith("\n")).toBe(true);
    expect(body).toContain("investigative lead"); expect(body).toContain("https://cybercrime.gov.in/");
    expect(createHash("sha256").update(rescuePackBody({ ...e, amount: "3000000" })).digest("hex")).not.toBe(e.packHash);
  });
});
