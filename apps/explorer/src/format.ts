import { MAINNET_USDC, MAINNET_USDT, type PoisoningEvidence } from "@hexfence/shared";
import { getAddress, isAddress, type Address } from "viem";

export const EVIDENCE_LABEL = "Ethereum mainnet evidence · status: suspected";

export const etherscanTx = (hash: string) => `https://etherscan.io/tx/${hash}`;
export const etherscanAddress = (address: string) => `https://etherscan.io/address/${address}`;

export function tokenName(token: string): string {
  const t = token.toLowerCase();
  if (t === MAINNET_USDT.toLowerCase()) return "USDT";
  if (t === MAINNET_USDC.toLowerCase()) return "USDC";
  return token;
}

/** The address a user typed, normalised, or null if it isn't one. Case is ignored: people paste lowercase. */
export function parseSearch(input: string): Address | null {
  const s = input.trim();
  return isAddress(s, { strict: false }) ? getAddress(s.toLowerCase()) : null;
}

export interface AddressParts {
  prefix: string;
  head: string;
  middle: string;
  tail: string;
}

/** Splits an address so the matching first and last characters can be highlighted. */
export function splitAddress(address: string, prefixLen: number, suffixLen: number): AddressParts {
  const hex = address.slice(2);
  return {
    prefix: "0x",
    head: hex.slice(0, prefixLen),
    middle: hex.slice(prefixLen, hex.length - suffixLen),
    tail: hex.slice(hex.length - suffixLen),
  };
}

export const variantText = (variant: PoisoningEvidence["variant"]) =>
  variant === "zero-value" ? "zero-value transfer" : "dust transfer";
