import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Address, Hex } from "viem";
import { hexFenceGuardV2Abi, verdictForV2, type KnownRecipient } from "../src/verdictV2.js";
interface Case { to: Address; value: string; data: Hex; operation: 0 | 1; reverted: boolean; error?: string; args?: string[] }
const fixture = JSON.parse(readFileSync(new URL("./fixtures/guard-v2-parity.json", import.meta.url), "utf8")) as {
  safe: Address; guard: Address; known: { recipient: Address; approved: boolean; firstPaidAt: string }[]; cases: Case[];
};
describe("V2 contract/client parity", () => {
  it("predicts the actual contract's pre-execution decisions, native-first", () => {
    const known: KnownRecipient[] = fixture.known.map(k => ({ ...k, firstPaidAt: BigInt(k.firstPaidAt) }));
    expect(fixture.cases.length).toBeGreaterThan(400);
    expect(known.some(k => !k.approved && k.firstPaidAt > 0n)).toBe(true);
    expect(known.some(k => k.approved)).toBe(true);
    for (const c of fixture.cases) {
      const v = verdictForV2({ ...c, value: BigInt(c.value) }, fixture, known);
      if (c.error === "LookalikeOfKnownRecipient") {
        expect(v.level).toBe("RED");
        if (v.reason !== "resembles" && v.reason !== "resembles-known") throw Error("wrong resemblance verdict");
        expect([v.recipient.toLowerCase(), v.payee.toLowerCase()]).toEqual(c.args!.map(a => a.toLowerCase()));
      } else if (c.error === "DelegateCallNotAllowed") expect(v).toEqual({ level: "GREY", reason: "delegatecall" });
      else { expect(c.reverted).toBe(false); expect(v.level).not.toBe("RED"); }
    }
  });
  it("keeps the public V2 ABI consistent with the compiled contract", () => {
    const artifact = JSON.parse(readFileSync(new URL("../../../contracts/artifacts/contracts/HexFenceGuardV2.sol/HexFenceGuardV2.json", import.meta.url), "utf8"));
    for (const item of hexFenceGuardV2Abi) {
      const actual = artifact.abi.find((a: { type: string; name?: string }) => a.type === item.type && a.name === item.name);
      expect(actual, item.name).toBeDefined();
      expect(actual.inputs.map((a: { type: string }) => a.type)).toEqual(item.inputs.map(a => a.type));
    }
  });
});
