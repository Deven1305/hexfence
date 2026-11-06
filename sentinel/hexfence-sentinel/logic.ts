import { decodeEventLog, encodeAbiParameters, parseAbi, type Address, type Hex } from "viem";
import { isLookalike } from "../../packages/shared/src/fingerprint";

export const transferAbi = parseAbi(["event Transfer(address indexed from, address indexed to, uint256 value)"]);
export type Candidate = { safe: Address; lookalike: Address; variant: 0 | 1 };
export function candidates(log: { topics: Hex[]; data: Hex }, safes: Address[], decimals: number): Candidate[] {
  const { args: { from, to, value } } = decodeEventLog({ abi: transferAbi, topics: log.topics as [Hex, ...Hex[]], data: log.data });
  const result: Candidate[] = [];
  for (const safe of safes) {
    if (value === 0n && safe.toLowerCase() === from.toLowerCase() && to.toLowerCase() !== safe.toLowerCase())
      result.push({ safe, lookalike: to, variant: 0 });
    // Positive dust only: incoming zero-value spam is not this detector's dust rule.
    if (value > 0n && value < 10n ** BigInt(decimals) && safe.toLowerCase() === to.toLowerCase() && from.toLowerCase() !== safe.toLowerCase())
      result.push({ safe, lookalike: from, variant: 1 });
  }
  return result;
}
export function resembles(lookalike: Address, payees: readonly Address[]): Address | undefined {
  return payees.find(p => isLookalike(lookalike, p));
}
export function encodeAlert(receiver: Address, c: Candidate, payee: Address, txHash: Hex, observedBlock: bigint): Hex {
  return encodeAbiParameters([
    { type: "uint256" }, { type: "address" }, { type: "address" },
    { type: "tuple", components: [{ type: "address" }, { type: "address" }, { type: "bytes32" }, { type: "uint8" }, { type: "uint64" }] },
  ], [11155111n, receiver, c.safe, [c.lookalike, payee, txHash, c.variant, observedBlock]]);
}
