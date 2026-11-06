import { describe, expect, it } from "vitest";
import { PoisoningEvidenceSchema } from "@hexfence/shared";
import saved from "./fixtures/receipts.json";
import { agreement, agreementText, parsePublishers } from "../src/publishers.js";

const zero = PoisoningEvidenceSchema.parse(saved.zeroValue.evidence);
const dust = PoisoningEvidenceSchema.parse(saved.dust.evidence);
const A = "0x36141ba063390f0d91Af7a5a9dF8dc1d80D699ec";
const B = "0x2222222222222222222222222222222222222222";

describe("multiple publishers", () => {
  it("lists the primary first, drops duplicates and reports entries that are not addresses", () => {
    expect(parsePublishers(A, ` ${B}, ${A.toLowerCase()},nope,,`)).toEqual({ publishers: [A, B], invalid: ["nope"] });
    expect(parsePublishers(A, "")).toEqual({ publishers: [A], invalid: [] });
  });
  it("counts each publisher once per record, however many copies it posted", () => {
    const counts = agreement(new Map([["a", [zero, zero, dust]], ["b", [zero]]]));
    expect(counts.get(zero.evidenceId.toLowerCase())).toBe(2);
    expect(counts.get(dust.evidenceId.toLowerCase())).toBe(1);
  });
  it("says plainly that one publisher cannot agree with itself", () => {
    expect(agreementText(1, 1)).toContain("no second publisher");
    expect(agreementText(2, 3)).toBe("Published by 2 of 3 publishers read.");
  });
});
