import { describe, expect, it } from "vitest";
import { encodeFunctionData, parseAbi, zeroAddress, type Hex } from "viem";
import { lossPaymentOrigin } from "../src/loss.js";
import { lossFixture } from "./fixtures/loss.js";
const e = lossFixture();
const transfer = encodeFunctionData({ abi: parseAbi(["function transfer(address,uint256) returns (bool)"]), functionName: "transfer", args: [e.lookalike, BigInt(e.amount)] });
const tx = { from: e.victim, to: e.token, input: transfer, value: 0n, blockNumber: BigInt(e.lossBlock) };
describe("loss call-shape check", () => {
  it("accepts an explicit token payment initiated by the recorded victim", () => {
    expect(lossPaymentOrigin(e, e, tx)).toBe("direct-payment");
  });
  it("does not mistake router-internal movement for an explicit victim payment", () => {
    expect(lossPaymentOrigin(e, e, { ...tx, from: e.lookalike, to: e.impersonated })).toBe("unclassified");
  });
  it("refuses unknown calldata, wrong amount, block and recipient", () => {
    for (const bad of [{ ...tx, input: "0xdeadbeef" as Hex }, { ...tx, blockNumber: 99n }, { ...tx, input: transfer.slice(0, -1) + "1" as Hex }]) expect(lossPaymentOrigin(e, e, bad)).toBe("unclassified");
  });
  it("decodes a Safe execTransaction call and rejects delegatecall", () => {
    const abi = parseAbi(["function execTransaction(address,uint256,bytes,uint8,uint256,uint256,uint256,address,address,bytes) returns (bool)"]);
    const exec = (operation: number) => encodeFunctionData({ abi, functionName: "execTransaction", args: [e.token, 0n, transfer, operation, 0n, 0n, 0n, zeroAddress, zeroAddress, "0x"] });
    expect(lossPaymentOrigin(e, e, { ...tx, from: e.impersonated, to: e.victim, input: exec(0) })).toBe("safe-shaped-payment");
    expect(lossPaymentOrigin(e, e, { ...tx, from: e.impersonated, to: e.victim, input: exec(1) })).toBe("unclassified");
  });
});
