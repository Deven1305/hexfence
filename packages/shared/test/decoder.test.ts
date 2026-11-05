import { encodeFunctionData, erc20Abi, getAddress, type Address, type Hex } from "viem";
import { describe, expect, it } from "vitest";
import { decodeSafeCall, safeCallFromExecTransaction, safeCallFromTypedData, type SafeCall } from "../src/decoder.js";

const SAFE = getAddress("0x1111111111111111111111111111111111111111");
const GUARD = getAddress("0x2222222222222222222222222222222222222222");
const TOKEN = getAddress("0xdAC17F958D2ee523a2206206994597C13D831ec7");
const P = getAddress("0x4E185e251Ac7fB83E9DE10723EAda46cadE74120");
const L = getAddress("0x4E185a3FC4B530244aB9ed0dE38167b403344120");
const FROM = getAddress("0x3333333333333333333333333333333333333333");
const ZERO = "0x0000000000000000000000000000000000000000" as const;
const ctx = { safe: SAFE, guard: GUARD };

const call = (to: Address, data: Hex, value = 0n, operation: 0 | 1 = 0): SafeCall => ({ to, value, data, operation });
const transfer = (to: Address, v: bigint) => encodeFunctionData({ abi: erc20Abi, functionName: "transfer", args: [to, v] });
const transferFrom = (f: Address, to: Address, v: bigint) =>
  encodeFunctionData({ abi: erc20Abi, functionName: "transferFrom", args: [f, to, v] });

// The same cases as contracts/test/guard.test.js, seen from the client side.
describe("decodeSafeCall (same rules and order as HexFenceGuard.checkTransaction)", () => {
  it("decodes a native ETH payment (the Guard checks `to`)", () => {
    expect(decodeSafeCall(call(L, "0x", 1n), ctx)).toEqual({ kind: "eth", recipient: L, amount: 1n });
  });

  it("decodes ERC-20 transfer (argument 0) and transferFrom (argument 1)", () => {
    expect(decodeSafeCall(call(TOKEN, transfer(L, 1_000_000n)), ctx)).toEqual({
      kind: "erc20-transfer",
      token: TOKEN,
      recipient: L,
      amount: 1_000_000n,
    });
    expect(decodeSafeCall(call(TOKEN, transferFrom(FROM, L, 7n)), ctx)).toEqual({
      kind: "erc20-transferFrom",
      token: TOKEN,
      from: FROM,
      recipient: L,
      amount: 7n,
    });
  });

  it("takes the admin path first: calls to the Safe or the Guard, even with junk data", () => {
    expect(decodeSafeCall(call(SAFE, "0xdeadbeef"), ctx)).toEqual({ kind: "admin" });
    expect(decodeSafeCall(call(GUARD, transfer(P, 1n)), ctx)).toEqual({ kind: "admin" });
    expect(decodeSafeCall(call(SAFE.toLowerCase() as Address, "0x"), ctx)).toEqual({ kind: "admin" });
  });

  it("flags delegatecall (the Guard refuses it), even to the Safe itself", () => {
    expect(decodeSafeCall(call(P, "0x", 0n, 1), ctx)).toEqual({ kind: "delegatecall", target: P });
    expect(decodeSafeCall(call(SAFE, "0x", 0n, 1), ctx).kind).toBe("delegatecall");
  });

  it("marks short or unknown calldata as unsupported, like the Guard", () => {
    const short = transfer(P, 1n).slice(0, 2 + 67 * 2) as Hex; // 67 bytes < 68
    expect(decodeSafeCall(call(TOKEN, short), ctx)).toEqual({ kind: "unsupported", to: TOKEN, selector: "0xa9059cbb" });
    const shortFrom = transferFrom(FROM, P, 1n).slice(0, 2 + 99 * 2) as Hex; // 99 bytes < 100
    expect(decodeSafeCall(call(TOKEN, shortFrom), ctx).kind).toBe("unsupported");
    const approve = encodeFunctionData({ abi: erc20Abi, functionName: "approve", args: [P, 1n] });
    expect(decodeSafeCall(call(TOKEN, approve), ctx)).toEqual({ kind: "unsupported", to: TOKEN, selector: "0x095ea7b3" });
    expect(decodeSafeCall(call(TOKEN, "0x00"), ctx)).toEqual({ kind: "unsupported", to: TOKEN, selector: null });
  });

  it("never throws on junk calldata (the Guard never reverts on it either)", () => {
    const junk = ["0xa9059cbb", "0xa9059cbb" + "00".repeat(40), "0x23b872dd" + "11".repeat(50), "0x0", "0xzz", "nothex", ""];
    for (const d of junk) expect(() => decodeSafeCall(call(TOKEN, d as Hex), ctx)).not.toThrow();
    expect(decodeSafeCall(call(TOKEN, "0xzz" as Hex), ctx).kind).toBe("unsupported");
    for (let i = 0; i < 200; i++) {
      const bytes = Array.from({ length: i * 3 }, () => Math.floor(Math.random() * 256).toString(16).padStart(2, "0"));
      expect(() => decodeSafeCall(call(TOKEN, `0x${bytes.join("")}`), ctx)).not.toThrow();
    }
  });

  it("tolerates trailing bytes and ignores dirty high bits in the address word, like the Guard", () => {
    const withTail = (transfer(L, 1n) + "ff".repeat(5)) as Hex;
    const dirty = `0xa9059cbb${"ab".repeat(12)}${L.slice(2).toLowerCase()}${"00".repeat(31)}01` as Hex;
    for (const data of [withTail, dirty]) {
      const d = decodeSafeCall(call(TOKEN, data), ctx);
      expect(d.kind === "erc20-transfer" && d.recipient).toBe(L);
    }
  });
});

describe("safeCallFromExecTransaction (0x6a761202)", () => {
  const execAbi = [
    {
      type: "function",
      name: "execTransaction",
      stateMutability: "payable",
      inputs: [
        { name: "to", type: "address" },
        { name: "value", type: "uint256" },
        { name: "data", type: "bytes" },
        { name: "operation", type: "uint8" },
        { name: "safeTxGas", type: "uint256" },
        { name: "baseGas", type: "uint256" },
        { name: "gasPrice", type: "uint256" },
        { name: "gasToken", type: "address" },
        { name: "refundReceiver", type: "address" },
        { name: "signatures", type: "bytes" },
      ],
      outputs: [{ name: "success", type: "bool" }],
    },
  ] as const;
  const exec = (to: Address, value: bigint, data: Hex, operation: number) =>
    encodeFunctionData({
      abi: execAbi,
      functionName: "execTransaction",
      args: [to, value, data, operation, 0n, 0n, 0n, ZERO, ZERO, "0x1234"],
    });

  it("returns the inner Safe call", () => {
    const calldata = exec(TOKEN, 0n, transfer(L, 9n), 0);
    expect(calldata.slice(0, 10)).toBe("0x6a761202");
    expect(safeCallFromExecTransaction(calldata)).toEqual(call(TOKEN, transfer(L, 9n)));
    expect(safeCallFromExecTransaction(exec(P, 3n, "0x", 1))).toEqual(call(P, "0x", 3n, 1));
  });

  it("returns null for other, broken or impossible calldata", () => {
    expect(safeCallFromExecTransaction(transfer(P, 1n))).toBeNull();
    expect(safeCallFromExecTransaction("0x6a761202")).toBeNull();
    expect(safeCallFromExecTransaction("0xzz" as Hex)).toBeNull();
    expect(safeCallFromExecTransaction(exec(P, 0n, "0x", 2))).toBeNull(); // no Operation 2 in Safe
  });
});

describe("safeCallFromTypedData (eth_signTypedData_v4, primaryType SafeTx)", () => {
  const typed = (message: Record<string, unknown>, primaryType = "SafeTx") => ({
    types: { EIP712Domain: [], SafeTx: [] },
    domain: { chainId: 11155111, verifyingContract: SAFE.toLowerCase() },
    primaryType,
    message: { safeTxGas: "0", baseGas: "0", gasPrice: "0", gasToken: ZERO, refundReceiver: ZERO, nonce: "3", ...message },
  });

  it("reads the object form and the JSON string form", () => {
    const td = typed({ to: L.toLowerCase(), value: "1000", data: "0x", operation: 0 });
    expect(safeCallFromTypedData(td)).toEqual(call(L, "0x", 1000n));
    expect(safeCallFromTypedData(JSON.stringify(td))).toEqual(call(L, "0x", 1000n));
    expect(safeCallFromTypedData(typed({ to: TOKEN, value: "0x0", data: transfer(L, 2n), operation: "0" }))).toEqual(
      call(TOKEN, transfer(L, 2n)),
    );
  });

  it("returns null for anything that is not a well-formed SafeTx", () => {
    expect(safeCallFromTypedData(typed({ to: P, value: "0", data: "0x", operation: 0 }, "Permit"))).toBeNull();
    expect(safeCallFromTypedData("{not json")).toBeNull();
    expect(safeCallFromTypedData(null)).toBeNull();
    expect(safeCallFromTypedData(typed({ to: "nope", value: "0", data: "0x", operation: 0 }))).toBeNull();
    expect(safeCallFromTypedData(typed({ to: P, value: "abc", data: "0x", operation: 0 }))).toBeNull();
    expect(safeCallFromTypedData(typed({ to: P, value: "0", data: "0xzz", operation: 0 }))).toBeNull();
    expect(safeCallFromTypedData(typed({ to: P, value: "0", data: "0x", operation: 2 }))).toBeNull();
  });
});
