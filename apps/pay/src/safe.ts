import Safe from "@safe-global/protocol-kit";
import { getAddress, isAddressEqual, zeroAddress, type Address, type EIP1193Provider } from "viem";
import { hexFenceGuardAbi } from "@hexfence/shared";
import type { ReadClient } from "./rpc";

export type GuardState =
  | { active: true }
  | { active: false; reason: "none" | "different" | "unsupported"; current?: Address };

export interface SafeInfo {
  address: Address;
  version: string;
  owners: Address[];
  threshold: number;
  guard: GuardState;
  payees: Address[];
}

/** `provider` is the composite EIP-1193 provider from rpc.ts; `signer` is the connected owner address. No onchainAnalytics, no Transaction Service. */
export async function openSafe(provider: EIP1193Provider, signer: Address, safeAddress: Address) {
  return Safe.init({ provider: provider as never, signer, safeAddress });
}

/** Active only if the Safe's guard slot holds the expected Guard. Safes too old for guards count as not active. */
export async function guardState(safe: Safe, expected: Address): Promise<GuardState> {
  let current: string;
  try {
    current = await safe.getGuard();
  } catch {
    return { active: false, reason: "unsupported" };
  }
  const addr = getAddress(current);
  if (isAddressEqual(addr, zeroAddress)) return { active: false, reason: "none" };
  if (!isAddressEqual(addr, expected)) return { active: false, reason: "different", current: addr };
  return { active: true };
}

/** The one Guard read: `payees(safe)`. Never `isApprovedPayee` or `payeeByFingerprint` per recipient. */
export async function readPayees(reads: ReadClient, guard: Address, safe: Address): Promise<Address[]> {
  const list = await reads.readContract({ address: guard, abi: hexFenceGuardAbi, functionName: "payees", args: [safe] });
  return [...(list as readonly Address[])];
}

export async function loadSafeInfo(safe: Safe, reads: ReadClient, guard: Address): Promise<SafeInfo> {
  const address = getAddress(await safe.getAddress());
  const [owners, threshold, guardS, payees] = await Promise.all([
    safe.getOwners(),
    safe.getThreshold(),
    guardState(safe, guard),
    readPayees(reads, guard, address),
  ]);
  return { address, version: safe.getContractVersion(), owners: owners.map((o) => getAddress(o)), threshold, guard: guardS, payees };
}
