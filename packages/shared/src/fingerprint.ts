import { getAddress, isAddress, type Address, type Hex } from "viem";

/** A HexFence fingerprint: 4 bytes, lower-case hex, e.g. `0x2ef98bf7`. */
export type Fingerprint = Hex;

/**
 * fp(a) = (uint160(a) >> 144) << 16 | (uint160(a) & 0xFFFF), as bytes4.
 *
 * That is literally the first 4 hex characters followed by the last 4, so
 * `0x2ef9…8bf7` -> `0x2ef98bf7`. It must stay identical to
 * `HexFenceGuard.fingerprint(address)` in contracts/contracts/HexFenceGuard.sol.
 */
export function fingerprint(address: string): Fingerprint {
  if (!isAddress(address, { strict: false })) throw new Error(`not an address: ${address}`);
  const x = BigInt(address);
  const fp = ((x >> 144n) << 16n) | (x & 0xffffn);
  return `0x${fp.toString(16).padStart(8, "0")}`;
}

/** Both addresses have the same fingerprint (true for an address and itself, and for the demo pair P/L). */
export function sameFingerprint(a: string, b: string): boolean {
  return fingerprint(a) === fingerprint(b);
}

/** Same fingerprint, different address: the shape of an address-poisoning lookalike. */
export function isLookalike(candidate: string, of: string): boolean {
  return !sameAddress(candidate, of) && fingerprint(candidate) === fingerprint(of);
}

/** Case-insensitive address equality (checksums are display only). */
export function sameAddress(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

/** EIP-55 checksummed form, for display and for typed Arkiv `addr` values. */
export function checksum(address: string): Address {
  return getAddress(address);
}
