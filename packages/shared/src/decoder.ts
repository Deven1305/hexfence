import { decodeFunctionData, getAddress, isAddress, type Address, type Hex } from "viem";
import { sameAddress } from "./fingerprint.js";

/** Safe `Enum.Operation`. */
export const CALL = 0;
export const DELEGATE_CALL = 1;

export const EXEC_TRANSACTION_SELECTOR = "0x6a761202";
export const TRANSFER_SELECTOR = "0xa9059cbb"; // transfer(address,uint256)
export const TRANSFER_FROM_SELECTOR = "0x23b872dd"; // transferFrom(address,address,uint256)

/** The fields of a Safe transaction that decide what it does (the rest are gas/refund settings). */
export interface SafeTxCore {
  to: Address;
  value: bigint;
  data: Hex;
  operation: number;
}

/** Where the transaction runs: the Safe executing it and, if known, its HexFence Guard. */
export interface SafeContext {
  safe: Address;
  guard?: Address;
}

export type Payment =
  | { kind: "eth"; recipient: Address; amount: bigint }
  | {
      kind: "erc20";
      method: "transfer" | "transferFrom";
      token: Address;
      from?: Address; // transferFrom only
      recipient: Address;
      amount: bigint;
    };

/**
 * What the Guard will see, in the same order as `HexFenceGuard.checkTransaction`:
 * - `admin`: the Safe calls itself or the Guard. Never inspected (administration + recovery path).
 * - `delegatecall`: the Guard refuses it (fail closed).
 * - `payment`: ETH, `transfer` or `transferFrom`. The Guard checks `payment.recipient`.
 * - `unsupported`: any other call. Not inspected, so clients must say "cannot verify".
 */
export type Decoded =
  | { kind: "admin"; to: Address }
  | { kind: "delegatecall"; target: Address }
  | { kind: "payment"; payment: Payment }
  | { kind: "unsupported"; to: Address; selector: Hex | null };

/**
 * Decode a Safe transaction exactly as the Guard does. Short or unknown calldata is never an error
 * (it decodes as `unsupported`); only a string that is not hex at all throws.
 */
export function decodeSafeTx(tx: SafeTxCore, ctx: SafeContext): Decoded {
  const to = getAddress(tx.to);
  const data = normaliseHex(tx.data);

  // (1) Administration + recovery path first, before any decoding.
  if (tx.operation === CALL && (sameAddress(to, ctx.safe) || (ctx.guard !== undefined && sameAddress(to, ctx.guard)))) {
    return { kind: "admin", to };
  }
  // (2) Delegatecall fails closed.
  if (tx.operation === DELEGATE_CALL) return { kind: "delegatecall", target: to };
  // Safe only knows Call and DelegateCall; anything else is not something we can reason about.
  if (tx.operation !== CALL) return { kind: "unsupported", to, selector: selectorOf(data) };

  // (3) The supported payment shapes. Length checks match the Guard (>= 68 and >= 100 bytes),
  //     so trailing bytes are tolerated exactly as they are on-chain.
  const bytes = (data.length - 2) / 2;
  if (bytes === 0) return { kind: "payment", payment: { kind: "eth", recipient: to, amount: tx.value } };

  const selector = selectorOf(data);
  if (selector === TRANSFER_SELECTOR && bytes >= 68) {
    return {
      kind: "payment",
      payment: { kind: "erc20", method: "transfer", token: to, recipient: wordAddress(data, 4), amount: wordUint(data, 36) },
    };
  }
  if (selector === TRANSFER_FROM_SELECTOR && bytes >= 100) {
    return {
      kind: "payment",
      payment: {
        kind: "erc20",
        method: "transferFrom",
        token: to,
        from: wordAddress(data, 4),
        recipient: wordAddress(data, 36),
        amount: wordUint(data, 68),
      },
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
 * Decode the calldata of `Safe.execTransaction` (`0x6a761202`), e.g. from an `eth_sendTransaction`
 * whose `to` is the Safe. Returns null if the calldata is not a well-formed execTransaction.
 */
export function decodeExecTransaction(calldata: Hex, ctx: SafeContext): Decoded | null {
  try {
    if (selectorOf(normaliseHex(calldata)) !== EXEC_TRANSACTION_SELECTOR) return null;
    const { args } = decodeFunctionData({ abi: EXEC_TRANSACTION_ABI, data: calldata });
    const [to, value, data, operation] = args;
    return decodeSafeTx({ to, value, data, operation }, ctx);
  } catch {
    return null;
  }
}

/**
 * Decode EIP-712 typed data with `primaryType === "SafeTx"`, as passed to `eth_signTypedData_v4`
 * (either the JSON string or the parsed object). The Safe is `domain.verifyingContract`.
 * Returns null if this is not a SafeTx.
 */
export function decodeSafeTxTypedData(typedData: unknown, guard?: Address): { safe: Address; decoded: Decoded } | null {
  let td: unknown = typedData;
  if (typeof td === "string") {
    try {
      td = JSON.parse(td);
    } catch {
      return null;
    }
  }
  if (!isRecord(td) || td.primaryType !== "SafeTx" || !isRecord(td.domain) || !isRecord(td.message)) return null;
  const safe = td.domain.verifyingContract;
  const m = td.message;
  if (typeof safe !== "string" || !isAddress(safe, { strict: false })) return null;
  if (typeof m.to !== "string" || !isAddress(m.to, { strict: false })) return null;
  try {
    const tx: SafeTxCore = {
      to: getAddress(m.to),
      value: BigInt((m.value as string | number | bigint | undefined) ?? 0),
      data: normaliseHex(typeof m.data === "string" ? m.data : "0x"),
      operation: Number(m.operation ?? 0),
    };
    const ctx: SafeContext = guard ? { safe: getAddress(safe), guard } : { safe: getAddress(safe) };
    return { safe: getAddress(safe), decoded: decodeSafeTx(tx, ctx) };
  } catch {
    return null;
  }
}

// ---- helpers ----

function normaliseHex(h: string): Hex {
  const s = h.toLowerCase();
  if (s === "" || s === "0x") return "0x";
  if (!/^0x[0-9a-f]*$/.test(s) || s.length % 2 !== 0) throw new Error(`invalid calldata hex: ${h.slice(0, 20)}…`);
  return s as Hex;
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
