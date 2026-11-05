import { createPublicClient, http, type EIP1193Provider, type PublicClient } from "viem";
import { sepolia } from "viem/chains";

export type ReadClient = PublicClient;

/** The single read layer. T11 swaps `fetchFn` for an Anon-RPC worker's fetch; nothing else changes. */
export function createReadClient(rpcUrl: string, fetchFn?: typeof fetch): ReadClient {
  return createPublicClient({ chain: sepolia, transport: http(rpcUrl, fetchFn ? { fetchFn } : undefined) });
}

/** Methods that need the user's wallet. Everything else is a read and goes through the read client. */
const WALLET_METHODS = new Set([
  "eth_accounts",
  "eth_requestAccounts",
  "eth_sendTransaction",
  "eth_signTransaction",
  "eth_sign",
  "personal_sign",
  "eth_signTypedData",
  "eth_signTypedData_v3",
  "eth_signTypedData_v4",
  "wallet_switchEthereumChain",
  "wallet_addEthereumChain",
  "wallet_requestPermissions",
  "wallet_getPermissions",
]);

export function isWalletMethod(method: string): boolean {
  return WALLET_METHODS.has(method);
}

/**
 * The EIP-1193 provider handed to Protocol Kit: accounts, signing and sending -> the injected wallet;
 * every other call (eth_call, eth_chainId, eth_getStorageAt, eth_estimateGas, ...) -> the read client.
 * Protocol Kit builds its own viem client over this provider (SafeProvider: `custom(provider)`).
 */
export function compositeProvider(wallet: EIP1193Provider, reads: ReadClient): EIP1193Provider {
  const request = (async ({ method, params }: { method: string; params?: unknown }) =>
    isWalletMethod(method)
      ? wallet.request({ method, params } as never)
      : (reads.request as (a: { method: string; params?: unknown }) => Promise<unknown>)({ method, params })) as EIP1193Provider["request"];
  return { request, on: () => undefined, removeListener: () => undefined } as unknown as EIP1193Provider;
}
