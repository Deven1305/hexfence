import type { EIP1193Provider } from "viem";
import { SEPOLIA_CHAIN_ID } from "./config";

export interface WalletOption {
  name: string;
  provider: EIP1193Provider;
}

/** EIP-6963 announcements first (300 ms), then `window.ethereum` if nothing announced. */
export function discoverWallets(): Promise<WalletOption[]> {
  return new Promise((resolve) => {
    const found = new Map<string, WalletOption>();
    const onAnnounce = (e: Event) => {
      const d = (e as CustomEvent<{ info: { uuid: string; name: string }; provider: EIP1193Provider }>).detail;
      found.set(d.info.uuid, { name: d.info.name, provider: d.provider });
    };
    window.addEventListener("eip6963:announceProvider", onAnnounce);
    window.dispatchEvent(new Event("eip6963:requestProvider"));
    setTimeout(() => {
      window.removeEventListener("eip6963:announceProvider", onAnnounce);
      const list = [...found.values()];
      const injected = (window as unknown as { ethereum?: EIP1193Provider }).ethereum;
      if (list.length === 0 && injected) list.push({ name: "Browser wallet", provider: injected });
      resolve(list);
    }, 300);
  });
}

export async function connect(provider: EIP1193Provider): Promise<`0x${string}`> {
  const accounts = (await provider.request({ method: "eth_requestAccounts" })) as `0x${string}`[];
  const first = accounts[0];
  if (!first) throw new Error("The wallet returned no account.");
  return first;
}

export async function walletChainId(provider: EIP1193Provider): Promise<number> {
  return Number(BigInt((await provider.request({ method: "eth_chainId" })) as string));
}

export async function switchToSepolia(provider: EIP1193Provider): Promise<void> {
  await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: `0x${SEPOLIA_CHAIN_ID.toString(16)}` }] });
}

/** EIP-1193 code 4001: the user rejected the request in their wallet. */
export function isUserRejection(err: unknown): boolean {
  let e: unknown = err;
  for (let i = 0; i < 6 && typeof e === "object" && e !== null; i++) {
    if ((e as { code?: unknown }).code === 4001) return true;
    e = (e as { cause?: unknown }).cause;
  }
  return false;
}
