import type Safe from "@safe-global/protocol-kit";
const protocolKit = () => import("@safe-global/protocol-kit");
import { getAddress, isAddressEqual, zeroAddress, type Address, type EIP1193Provider } from "viem";
import { hexFenceGuardAbi, hexFenceGuardV2Abi, type KnownRecipient } from "@hexfence/shared";
import type { ReadClient } from "./rpc";
import { V2_GUARD } from "./upgrade";

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
  v2?: { guard: Address; known: KnownRecipient[]; autoLearn: boolean };
}

/** `provider` is the composite EIP-1193 provider from rpc.ts; `signer` is the connected owner address. No onchainAnalytics, no Transaction Service. */
export async function openSafe(provider: EIP1193Provider, signer: Address, safeAddress: Address) {
  const { default: Safe } = await protocolKit();
  return Safe.init({ provider: provider as never, signer, safeAddress });
}

/** No wallet: Protocol Kit over the read client only (no signer). Enough for getOwners/getThreshold/getGuard; it cannot sign or send. */
export async function openSafeReadOnly(reads: ReadClient, safeAddress: Address) {
  const provider = {
    request: (a: { method: string; params?: unknown }) => (reads.request as (x: typeof a) => Promise<unknown>)(a),
    on: () => undefined,
    removeListener: () => undefined,
  } as unknown as EIP1193Provider;
  const { default: Safe } = await protocolKit();
  return Safe.init({ provider: provider as never, safeAddress });
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
  let guardS = await guardState(safe, guard);
  const v2Active = guardS.active ? isAddressEqual(guard, V2_GUARD)
    : guardS.reason === "different" && !!guardS.current && isAddressEqual(guardS.current, V2_GUARD);
  const [owners, threshold] = await Promise.all([
    safe.getOwners(),
    safe.getThreshold(),
  ]);
  let v2: SafeInfo["v2"];
  let payees: Address[];
  if (v2Active) {
    const [known, autoLearn] = await Promise.all([
      reads.readContract({ address: V2_GUARD, abi: hexFenceGuardV2Abi, functionName: "recipientDetails", args: [address] }),
      reads.readContract({ address: V2_GUARD, abi: hexFenceGuardV2Abi, functionName: "autoLearn", args: [address] }),
    ]);
    v2 = { guard: V2_GUARD, known: [...known], autoLearn };
    payees = known.filter(k => k.approved).map(k => k.recipient);
    guardS = { active: true };
  } else payees = await readPayees(reads, guard, address);
  return { address, version: safe.getContractVersion(), owners: owners.map((o) => getAddress(o)), threshold, guard: guardS, payees, ...(v2 ? { v2 } : {}) };
}
