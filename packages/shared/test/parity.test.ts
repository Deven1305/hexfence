import { readFileSync } from "node:fs";
import type { Address, Hex } from "viem";
import { describe, expect, it } from "vitest";
import { decodeSafeCall } from "../src/decoder.js";
import { fingerprint } from "../src/fingerprint.js";
import { verdictFor } from "../src/verdict.js";

// Recorded from the REAL HexFenceGuard by `cd contracts && npx hardhat run scripts/parity-vectors.js`.
interface Case {
  to: Address;
  value: string;
  data: Hex;
  operation: 0 | 1;
  reverted: boolean;
  error?: "LookalikeOfApprovedPayee" | "DelegateCallNotAllowed";
  args?: string[];
}
const fixture = JSON.parse(readFileSync(new URL("./fixtures/guard-parity.json", import.meta.url), "utf8")) as {
  safe: Address;
  guard: Address;
  payees: Address[];
  cases: Case[];
  fingerprints: { address: Address; fingerprint: Hex }[];
};

describe("parity with the deployed Guard bytecode", () => {
  it("has a meaningful mix of outcomes", () => {
    const reverts = fixture.cases.filter((c) => c.reverted);
    expect(fixture.cases.length).toBeGreaterThan(400);
    expect(reverts.some((c) => c.error === "LookalikeOfApprovedPayee")).toBe(true);
    expect(reverts.some((c) => c.error === "DelegateCallNotAllowed")).toBe(true);
  });

  it("the client's verdict predicts the Guard's decision for every case", () => {
    const ctx = { safe: fixture.safe, guard: fixture.guard };
    for (const c of fixture.cases) {
      const v = verdictFor(decodeSafeCall({ to: c.to, value: BigInt(c.value), data: c.data, operation: c.operation }, ctx), fixture.payees);
      const where = `${c.operation === 1 ? "delegatecall" : "call"} to ${c.to} data ${c.data.slice(0, 74)}`;
      if (c.error === "LookalikeOfApprovedPayee") {
        // RED resembles <=> the Guard refuses, naming the same recipient and payee.
        expect(v, where).toEqual({ level: "RED", reason: "resembles", recipient: c.args![0], payee: c.args![1] });
      } else if (c.error === "DelegateCallNotAllowed") {
        expect(v, where).toEqual({ level: "GREY", reason: "delegatecall" });
      } else {
        expect(c.reverted, where).toBe(false);
        // Everything the Guard lets through is GREEN, AMBER or a GREY "not inspected": never RED.
        expect(v.level, where).not.toBe("RED");
        expect(v.level === "GREY" && v.reason === "delegatecall", where).toBe(false);
      }
    }
  });

  it("fingerprint() equals HexFenceGuard.fingerprint() on random addresses", () => {
    for (const f of fixture.fingerprints) expect(fingerprint(f.address), f.address).toBe(f.fingerprint);
  });
});
