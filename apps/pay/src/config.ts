import { getAddress, isAddress, type Address } from "viem";

export const SEPOLIA_CHAIN_ID = 11155111;
export const SEPOLIA_EXPLORER = "https://sepolia.etherscan.io";

export interface Config {
  guard: Address;
  sepoliaRpcUrl: string;
  /** Arkiv publisher (T10). Optional: without it the "listed" signal is off and the UI says so. */
  publisher?: Address;
  explorerUrl?: string;
  /** Optional (T11): bootstrap read for the tor-js and Nym routes, whose routing contract is on mainnet. */
  mainnetRpcUrl?: string;
  /** Optional (T11): comma-separated Tor gateways; the published demo gateway is used if absent. */
  torGateways?: string;
  /** Optional Arkiv access key (the public endpoint is rate limited without one). */
  arkivAccessKey?: string;
}

export class ConfigError extends Error {}

/** Reads the VITE_* values. Missing or malformed required values throw one error naming all of them: no fallbacks. */
export function loadConfig(env: Record<string, string | undefined>): Config {
  const problems: string[] = [];
  const guardRaw = env.VITE_GUARD_ADDRESS?.trim();
  const rpc = env.VITE_SEPOLIA_RPC_URL?.trim();
  if (!guardRaw) problems.push("VITE_GUARD_ADDRESS is not set");
  else if (!isAddress(guardRaw, { strict: false })) problems.push("VITE_GUARD_ADDRESS is not an address");
  if (!rpc) problems.push("VITE_SEPOLIA_RPC_URL is not set");
  else if (!/^https?:\/\//.test(rpc)) problems.push("VITE_SEPOLIA_RPC_URL must start with http:// or https://");

  const pubRaw = env.VITE_ARKIV_PUBLISHER?.trim();
  if (pubRaw && !isAddress(pubRaw, { strict: false })) problems.push("VITE_ARKIV_PUBLISHER is not an address");

  if (problems.length > 0) {
    throw new ConfigError(`Missing or invalid settings in the root .env file: ${problems.join("; ")}.`);
  }
  return {
    guard: getAddress(guardRaw as string),
    sepoliaRpcUrl: rpc as string,
    publisher: pubRaw ? getAddress(pubRaw) : undefined,
    explorerUrl: env.VITE_EXPLORER_URL?.trim() || undefined,
    mainnetRpcUrl: env.VITE_MAINNET_RPC_URL?.trim() || undefined,
    torGateways: env.VITE_TOR_GATEWAYS?.trim() || undefined,
    arkivAccessKey: env.VITE_ARKIV_ACCESS_KEY?.trim() || undefined,
  };
}
