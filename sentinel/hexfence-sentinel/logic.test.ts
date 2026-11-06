import { describe, expect, it } from "vitest";
import { decodeAbiParameters, encodeAbiParameters, encodeEventTopics, getAddress, type Address, type Hex } from "viem";
import { candidates, encodeAlert, resembles, transferAbi } from "./logic";
const safe = "0x1111111111111111111111111111111111111111" as Address;
const p = "0x4e185e251ac7fb83e9de10723eada46cade74120" as Address;
const l = "0x4e185a3fc4b530244ab9ed0de38167b403344120" as Address;
function log(from: Address, to: Address, value: bigint) {
  return { topics: encodeEventTopics({ abi: transferAbi, eventName: "Transfer", args: { from, to } }) as Hex[], data: encodeAbiParameters([{ type: "uint256" }], [value]) };
}
describe("Sentinel suspected pattern classification", () => {
  it("finds outgoing zero-value spoofing and incoming positive dust", () => {
    expect(candidates(log(safe, l, 0n), [safe], 6)).toEqual([{ safe, lookalike: getAddress(l), variant: 0 }]);
    expect(candidates(log(l, safe, 999999n), [safe], 6)).toEqual([{ safe, lookalike: getAddress(l), variant: 1 }]);
  });
  it("ignores normal payments, incoming zero, self-transfers, a whole token and other Safes", () => {
    for (const event of [log(safe, l, 1n), log(l, safe, 0n), log(safe, safe, 0n), log(l, safe, 1000000n), log(l, p, 1n)])
      expect(candidates(event, [safe], 6)).toEqual([]);
  });
  it("only matches different addresses using the shared fingerprint", () => {
    expect(resembles(l, [p])).toBe(p);
    expect(resembles(p, [p])).toBeUndefined();
    expect(resembles(safe, [p])).toBeUndefined();
  });
  it("encodes a domain-bound contract report", () => {
    const report = encodeAlert(safe, { safe, lookalike: l, variant: 0 }, p, `0x${"ab".repeat(32)}`, 123n);
    const decoded = decodeAbiParameters([{ type: "uint256" }, { type: "address" }, { type: "address" }, { type: "address" }, { type: "address" }, { type: "bytes32" }, { type: "uint8" }, { type: "uint64" }], report);
    expect(decoded).toEqual([11155111n, safe, safe, getAddress(l), getAddress(p), `0x${"ab".repeat(32)}`, 0, 123n]);
  });
});
