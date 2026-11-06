import { address, record } from './interception';
import type { Address } from 'viem';
export const ARKIV_ORIGIN = 'https://rpc.rabdi.db-chain.testnet.arkiv.network/*';
export interface Settings { rpc: string; guard: Address; publisher?: Address }
export function rpcOrigin(rpc: string): string {
  const url = new URL(rpc);
  if (url.protocol !== 'https:' || url.username || url.password || url.hash) throw new Error('Enter an HTTPS RPC URL without user credentials or a fragment.');
  return `${url.origin}/*`;
}
export function parseSettings(value: unknown): Settings {
  if (!record(value) || typeof value.rpc !== 'string' || !address(value.guard)) throw new Error('Enter the Sepolia RPC and HexFence Guard address.');
  rpcOrigin(value.rpc);
  const publisher = value.publisher ? address(value.publisher) : undefined;
  if (value.publisher && !publisher) throw new Error('Enter a publisher address or leave it empty.');
  return { rpc: value.rpc.trim(), guard: address(value.guard)!, publisher };
}
export async function settings(): Promise<Settings> {
  return parseSettings((await chrome.storage.local.get('settings')).settings);
}
