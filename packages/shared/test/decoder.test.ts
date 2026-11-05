import { encodeFunctionData, erc20Abi, getAddress, type Address, type Hex } from "viem";
import { describe, expect, it } from "vitest";
import { decodeExecTransaction, decodeSafeTx, decodeSafeTxTypedData, type SafeContext } from "../src/decoder.js";

const SAFE = getAddress("0x1111111111111111111111111111111111111111");
const GUARD = getAddress("0x2222222222222222222222222222222222222222");
const TOKEN = getAddress("0xdAC17F958D2ee523a2206206994597C13D831ec7");
const P = getAddress("0x4E185e251Ac7fB83E9DE10723EAda46cadE74120");
const FROM = getAddress("0x3333333333333333333333333333333333333333");
const ZERO = "0x0000000000000000000000000000000000000000" as const;
const ctx: SafeContext = { safe: SAFE, guard: GUARD };

const transfer = (to: Address, v: bigint) => encodeFunctionData({ abi: erc20Abi, functionName: "transfer", args: [to, v] });
const transferFrom = (f: Address, to: Address, v: bigint) =>
  encodeFunctionData({ abi: erc20Abi, functionName: "transferFrom", args: [f, to, v] });

describe("decodeSafeTx", () => {
  it("decodes a native ETH payment", () => {
    expect(decodeSafeTx({ to: P, value: 5n, data: "0x", operation: 0 }, ctx)).toEqual({
      kind: "payment",
      payment: { kind: "eth", recipient: P, amount: 5n },
    });
  });

  it("decodes ERC-20 transfer and transferFrom", () => {
    expect(decodeSafeTx({ to: TOKEN, value: 0n, data: transfer(P, 1_000_000n), operation: 0 }, ctx)).toEqual({
      kind: "payment",
      payment: { kind: "erc20", method: "transfer", token: TOKEN, recipient: P, amount: 1_000_000n },
    });
    expect(decodeSafeTx({ to: TOKEN, value: 0n, data: transferFrom(FROM, P, 7n), operation: 0 }, ctx)).toEqual({
      kind: "payment",
      payment: { kind: "erc20", method: "transferFrom", token: TOKEN, from: FROM, recipient: P, amount: 7n },
    });
  });

  it("takes the admin path first: calls to the Safe or the Guard, even with junk data", () => {
    expect(decodeSafeTx({ to: SAFE, value: 0n, data: "0xdeadbeef", operation: 0 }, ctx).kind).toBe("admin");
    expect(decodeSafeTx({ to: GUARD, value: 0n, data: transfer(P, 1n), operation: 0 }, ctx).kind).toBe("admin");
  });

  it("flags delegatecall (the Guard refuses it), even to the Safe itself", () => {
    expect(decodeSafeTx({ to: P, value: 0n, data: "0x", operation: 1 }, ctx)).toEqual({ kind: "delegatecall", target: P });
    expect(decodeSafeTx({ to: SAFE, value: 0n, data: "0x", operation: 1 }, ctx).kind).toBe("delegatecall");
  });

  it("marks short or unknown calldata as unsupported, like the Guard", () => {
    const shortTransfer = transfer(P, 1n).slice(0, 2 + 67 * 2) as Hex; // 67 bytes < 68
    expect(decodeSafeTx({ to: TOKEN, value: 0n, data: shortTransfer, operation: 0 }, ctx)).toEqual({
      kind: "unsupported",
      to: TOKEN,
      selector: "0xa9059cbb",
    });
    const approve = encodeFunctionData({ abi: erc20Abi, functionName: "approve", args: [P, 1n] });
    expect(decodeSafeTx({ to: TOKEN, value: 0n, data: approve, operation: 0 }, ctx).kind).toBe("unsupported");
    expect(decodeSafeTx({ to: TOKEN, value: 0n, data: "0x00", operation: 0 }, ctx)).toEqual({ kind: "unsupported", to: TOKEN, selector: null });
  });

  it("tolerates trailing bytes and ignores dirty high bits in the address word, like the Guard", () => {
    const withTail = (transfer(P, 1n) + "ff".repeat(5)) as Hex;
    const dirty = (`0xa9059cbb${"ab".repeat(12)}${P.slice(2).toLowerCase()}${"00".repeat(31)}01`) as Hex;
    for (const data of [withTail, dirty]) {
      const d = decodeSafeTx({ to: TOKEN, value: 0n, data, operation: 0 }, ctx);
      expect(d.kind === "payment" && d.payment.recipient).toBe(P);
    }
  });

  it("without a known guard address, only the Safe itself is the admin path", () => {
    expect(decodeSafeTx({ to: GUARD, value: 0n, data: "0x", operation: 0 }, { safe: SAFE }).kind).toBe("payment");
  });
});

describe("decodeExecTransaction (0x6a761202)", () => {
  const exec = (to: Address, value: bigint, data: Hex, operation: number) =>
    encodeFunctionData({
      abi: [
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
      ],
      functionName: "execTransaction",
      args: [to, value, data, operation, 0n, 0n, 0n, ZERO, ZERO, "0x1234"],
    });

  it("unwraps the inner Safe transaction", () => {
    const calldata = exec(TOKEN, 0n, transfer(P, 9n), 0);
    expect(calldata.slice(0, 10)).toBe("0x6a761202");
    expect(decodeExecTransaction(calldata, ctx)).toEqual({
      kind: "payment",
      payment: { kind: "erc20", method: "transfer", token: TOKEN, recipient: P, amount: 9n },
    });
    expect(decodeExecTransaction(exec(P, 0n, "0x", 1), ctx)?.kind).toBe("delegatecall");
  });

  it("returns null for other or broken calldata", () => {
    expect(decodeExecTransaction(transfer(P, 1n), ctx)).toBeNull();
    expect(decodeExecTransaction("0x6a761202", ctx)).toBeNull();
    expect(decodeExecTransaction("0xzz" as Hex, ctx)).toBeNull();
  });
});

describe("decodeSafeTxTypedData (eth_signTypedData_v4)", () => {
  const typed = (message: Record<string, unknown>, primaryType = "SafeTx") => ({
    types: { EIP712Domain: [], SafeTx: [] },
    domain: { chainId: 11155111, verifyingContract: SAFE.toLowerCase() },
    primaryType,
    message: { safeTxGas: "0", baseGas: "0", gasPrice: "0", gasToken: ZERO, refundReceiver: ZERO, nonce: "3", ...message },
  });

  it("decodes the object form and the JSON string form", () => {
    const td = typed({ to: P, value: "1000", data: "0x", operation: 0 });
    const want = { safe: SAFE, decoded: { kind: "payment", payment: { kind: "eth", recipient: P, amount: 1000n } } };
    expect(decodeSafeTxTypedData(td, GUARD)).toEqual(want);
    expect(decodeSafeTxTypedData(JSON.stringify(td), GUARD)).toEqual(want);
  });

  it("recognises the admin path from the domain's Safe address", () => {
    expect(decodeSafeTxTypedData(typed({ to: SAFE, value: "0", data: "0xe19a9dd9", operation: "0" }))?.decoded.kind).toBe("admin");
  });

  it("returns null for anything that is not a SafeTx", () => {
    expect(decodeSafeTxTypedData(typed({ to: P, value: "0", data: "0x", operation: 0 }, "Permit"))).toBeNull();
    expect(decodeSafeTxTypedData("{not json")).toBeNull();
    expect(decodeSafeTxTypedData(typed({ to: "nope", value: "0", data: "0x", operation: 0 }))).toBeNull();
  });
});
