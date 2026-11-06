import { describe, expect, it } from "vitest";
import { encodeFunctionData, getAddress, parseAbi, type Address } from "viem";
import { verdictForV2 } from "../src/verdictV2.js";
const safe = "0x1111111111111111111111111111111111111111" as Address;
const guard = "0x2222222222222222222222222222222222222222" as Address;
const p = getAddress("0x4e185e251ac7fb83e9de10723eada46cade74120");
const l = getAddress("0x4e185a3fc4b530244ab9ed0de38167b403344120");
const known = [{ recipient: p, approved: false, firstPaidAt: 123n }];
const context = { safe, guard };
describe("verdictForV2", () => {
  it("distinguishes learned holders and approved holders without inventing dates", () => {
    const call = { to: l, value: 1n, data: "0x" as const, operation: 0 as const };
    expect(verdictForV2(call, context, known)).toEqual({ level: "RED", reason: "resembles-known", recipient: l, payee: p, firstPaidAt: 123n });
    expect(verdictForV2({ ...call, to: p }, context, known)).toEqual({ level: "GREEN", reason: "known", recipient: p, firstPaidAt: 123n });
    expect(verdictForV2(call, context, [{ ...known[0]!, approved: true }]).reason).toBe("resembles");
  });
  it("checks ETH even with arbitrary calldata or a different token recipient", () => {
    const data = encodeFunctionData({ abi: parseAbi(["function transfer(address,uint256)"]), functionName: "transfer", args: [p, 1n] });
    expect(verdictForV2({ to: l, value: 1n, data, operation: 0 }, context, known).reason).toBe("resembles-known");
    expect(verdictForV2({ to: l, value: 1n, data: "0x00", operation: 0 }, context, known).level).toBe("RED");
    expect(verdictForV2({ to: safe, value: 1n, data: "0x00", operation: 0 }, context, known)).toEqual({ level: "GREY", reason: "admin" });
  });
  it("keeps unsupported shapes GREY, new payments AMBER and delegatecall GREY", () => {
    expect(verdictForV2({ to: guard, value: 0n, data: "0x", operation: 1 }, context, known).reason).toBe("delegatecall");
    expect(verdictForV2({ to: l, value: 0n, data: "0x00", operation: 0 }, context, known)).toEqual({ level: "GREY", reason: "unsupported" });
    expect(verdictForV2({ to: l, value: 1n, data: "0x", operation: 0 }, context, []).level).toBe("AMBER");
  });
});
