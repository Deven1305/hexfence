import { encodeFunctionData, getAddress, isAddress, parseUnits, type Address } from "viem";
import type { SafeCall } from "@hexfence/shared";

export type Asset = { kind: "eth" } | { kind: "erc20"; token: Address; decimals: number; symbol?: string };

export const erc20Abi = [
  { type: "function", name: "transfer", stateMutability: "nonpayable", inputs: [{ name: "to", type: "address" }, { name: "value", type: "uint256" }], outputs: [{ name: "", type: "bool" }] },
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint8" }] },
  { type: "function", name: "symbol", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "string" }] },
] as const;

export class InputError extends Error {}

/** A checksummed address from user input. All-lowercase is accepted; mixed case must have a valid checksum. */
export function parseAddress(text: string, what: string): Address {
  const s = text.trim();
  if (!isAddress(s)) throw new InputError(`${what} is not a valid address (check every character; mixed-case addresses must have a valid checksum).`);
  return getAddress(s);
}

/** Decimal text -> base units. Rejects empty, negative, zero, non-numeric and too many decimals. */
export function parseAmount(text: string, decimals: number): bigint {
  const s = text.trim();
  if (!/^\d+(\.\d+)?$/.test(s)) throw new InputError("Amount must be a plain number such as 0.01.");
  const frac = s.split(".")[1] ?? "";
  if (frac.length > decimals) throw new InputError(`Amount has more than ${decimals} decimal places.`);
  const v = parseUnits(s, decimals);
  if (v === 0n) throw new InputError("Amount must be greater than zero.");
  return v;
}

/** The Safe transaction for a payment: ETH is a plain call, an ERC-20 payment is `token.transfer(recipient, amount)`. */
export function buildPaymentCall(asset: Asset, recipient: Address, amount: bigint): SafeCall {
  if (asset.kind === "eth") return { to: recipient, value: amount, data: "0x", operation: 0 };
  return {
    to: asset.token,
    value: 0n,
    data: encodeFunctionData({ abi: erc20Abi, functionName: "transfer", args: [recipient, amount] }),
    operation: 0,
  };
}
