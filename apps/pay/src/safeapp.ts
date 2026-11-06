import SafeAppsSDK from "@safe-global/safe-apps-sdk";
import { getAddress, type Address, type Hex } from "viem";
import type { buildPaymentCall } from "./payment";

/** Safe{Wallet} origins that may talk to this app (matched against the message origin). */
const SAFE_ORIGINS = [/^https:\/\/([a-z0-9-]+\.)?safe\.global$/];

export interface SafeAppContext {
  safeAddress: Address;
  chainId: number;
  owners: Address[];
  threshold: number;
}

let sdk: SafeAppsSDK | undefined;
function getSdk(): SafeAppsSDK {
  return (sdk ??= new SafeAppsSDK({ allowedDomains: SAFE_ORIGINS }));
}

/**
 * Resolves with the Safe the page is open in when it runs inside Safe{Wallet}, otherwise undefined.
 * Outside an iframe it returns at once, so standalone Pay is unchanged. Inside an iframe that never answers
 * (not Safe{Wallet}) it gives up after `timeoutMs`.
 */
export async function detectSafeApp(timeoutMs = 3000): Promise<SafeAppContext | undefined> {
  if (typeof window === "undefined" || window.parent === window) return undefined;
  try {
    const info = await Promise.race([
      getSdk().safe.getInfo(),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("no Safe{Wallet} answer")), timeoutMs)),
    ]);
    return { safeAddress: getAddress(info.safeAddress), chainId: info.chainId, owners: info.owners.map((o) => getAddress(o)), threshold: info.threshold };
  } catch {
    return undefined;
  }
}

/** Proposes a plain Call in Safe{Wallet}. Signing, confirmation and sending happen in the Safe{Wallet} interface. Returns the safeTxHash. */
export async function proposeInSafe(call: ReturnType<typeof buildPaymentCall>): Promise<Hex> {
  if (call.operation !== 0) throw new Error("Safe Apps can only propose plain calls.");
  const { safeTxHash } = await getSdk().txs.send({ txs: [{ to: call.to, value: call.value.toString(), data: call.data }] });
  return safeTxHash as Hex;
}
