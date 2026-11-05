import { decodeFunctionData, getAddress, isAddress, type Address, type Hex } from "viem";
import { sameAddress } from "./fingerprint.js";

export const EXEC_TRANSACTION_SELECTOR = "0x6a761202";
export const TRANSFER_SELECTOR = "0xa9059cbb"; // transfer(address,uint256)
export const TRANSFER_FROM_SELECTOR = "0x23b872dd"; // transferFrom(address,address,uint256)

/** One Safe transaction (what execTransaction / SafeTx carry). operation: 0 = Call, 1 = DelegateCall. */
export interface SafeCall {
  to: Address;
  value: bigint;
  data: Hex;
  operation: 0 | 1;
}

/**
 * What the Guard will see, in the same order as `HexFenceGuard.checkTransaction`:
 * - `admin`: the Safe calls itself or the Guard. Never inspected (administration + recovery path).
 * - `delegatecall`: the Guard refuses it (fail closed).
 * - `eth` / `erc20-transfer` / `erc20-transferFrom`: the Guard checks `recipient`.
 * - `unsupported`: any other call. Not inspected, so clients must say "cannot verify".
 */
export type DecodedPayment =
  | { kind: "eth"; recipient: Address; amount: bigint }
  | { kind: "erc20-transfer"; token: Address; recipient: Address; amount: bigint }
  | { kind: "erc20-transferFrom"; token: Address; from: Address; recipient: Address; amount: bigint }
  | { kind: "admin" }
  | { kind: "delegatecall"; target: Address }
  | { kind: "unsupported"; to: Address; selector: Hex | null };

/**
 * Decode a Safe call with the same rules, in the same order, as `HexFenceGuard.checkTransaction`.
 * Never throws: short, unknown or malformed calldata decodes as `unsupported`.
 */
export function decodeSafeCall(call: SafeCall, ctx: { safe: Address; guard: Address }): DecodedPayment {
  const to = getAddress(call.to);

  // (1) Administration + recovery path first, before any decoding.
  if (call.operation === 0 && (sameAddress(to, ctx.safe) || sameAddress(to, ctx.guard))) return { kind: "admin" };
  // (2) Delegatecall fails closed.
  if (call.operation === 1) return { kind: "delegatecall", target: to };

  const data = normaliseHex(call.data);
  if (data === null) return { kind: "unsupported", to, selector: null };

  // (3) The supported payment shapes. Length checks match the Guard (>= 68 and >= 100 bytes),
  //     so trailing bytes are tolerated exactly as they are on-chain.
  const bytes = (data.length - 2) / 2;
  if (bytes === 0) return { kind: "eth", recipient: to, amount: call.value };

  const selector = selectorOf(data);
  if (selector === TRANSFER_SELECTOR && bytes >= 68) {
    return { kind: "erc20-transfer", token: to, recipient: wordAddress(data, 4), amount: wordUint(data, 36) };
  }
  if (selector === TRANSFER_FROM_SELECTOR && bytes >= 100) {
    return {
      kind: "erc20-transferFrom",
      token: to,
      from: wordAddress(data, 4),
      recipient: wordAddress(data, 36),
      amount: wordUint(data, 68),
    };
  }
  // (4) Anything else is not inspected by the Guard.
  return { kind: "unsupported", to, selector };
}

const EXEC_TRANSACTION_ABI = [
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

/**
 * The Safe call inside `Safe.execTransaction` calldata (`0x6a761202`), e.g. from an
 * `eth_sendTransaction` whose `to` is the Safe. Null if it is not a well-formed execTransaction.
 */
export function safeCallFromExecTransaction(calldata: Hex): SafeCall | null {
  const data = normaliseHex(calldata);
  if (data === null || selectorOf(data) !== EXEC_TRANSACTION_SELECTOR) return null;
  try {
    const { args } = decodeFunctionData({ abi: EXEC_TRANSACTION_ABI, data });
    const [to, value, inner, operation] = args;
    if (operation !== 0 && operation !== 1) return null; // Safe has no other operation
    return { to: getAddress(to), value, data: inner, operation };
  } catch {
    return null;
  }
}

/**
 * The Safe call in EIP-712 typed data with `primaryType === "SafeTx"`, as passed to
 * `eth_signTypedData_v4` (the JSON string or the parsed object). The Safe itself is
 * `domain.verifyingContract`. Null if this is not a well-formed SafeTx.
 */
export function safeCallFromTypedData(typedData: unknown): SafeCall | null {
  let td: unknown = typedData;
  if (typeof td === "string") {
    try {
      td = JSON.parse(td);
    } catch {
      return null;
    }
  }
  if (!isRecord(td) || td.primaryType !== "SafeTx" || !isRecord(td.message)) return null;
  const m = td.message;
  if (typeof m.to !== "string" || !isAddress(m.to, { strict: false })) return null;
  const data = normaliseHex(m.data === undefined ? "0x" : m.data);
  if (data === null) return null;
  const operation = Number(m.operation ?? 0);
  if (operation !== 0 && operation !== 1) return null;
  let value: bigint;
  try {
    // Wallets send uint256 values as decimal strings, hex strings or numbers.
    value = BigInt((m.value ?? 0) as string | number | bigint);
  } catch {
    return null;
  }
  if (value < 0n) return null;
  return { to: getAddress(m.to), value, data, operation };
}

// ---- helpers ----

/** Lower-case, even-length 0x hex, or null if it is not hex at all. */
function normaliseHex(h: unknown): Hex | null {
  if (typeof h !== "string") return null;
  const s = h.toLowerCase();
  if (s === "" || s === "0x") return "0x";
  return /^0x([0-9a-f]{2})*$/.test(s) ? (s as Hex) : null;
}

function selectorOf(data: Hex): Hex | null {
  return data.length >= 10 ? (data.slice(0, 10) as Hex) : null;
}

/** 32-byte word at a byte offset (offset counts from the start of the calldata, selector included). */
function word(data: Hex, offset: number): string {
  return data.slice(2 + offset * 2, 2 + (offset + 32) * 2);
}

/** The low 20 bytes of a word, like the Guard's `and(mload(...), 0xff…ff)` (dirty high bits ignored). */
function wordAddress(data: Hex, offset: number): Address {
  return getAddress(`0x${word(data, offset).slice(24)}`);
}

function wordUint(data: Hex, offset: number): bigint {
  return BigInt(`0x${word(data, offset)}`);
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}
