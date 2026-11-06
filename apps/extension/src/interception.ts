import { safeCallFromExecTransaction, safeCallFromTypedData, type SafeCall } from '@hexfence/shared';
import { isAddress, type Address, type Hex } from 'viem';

export interface Request { method: string; params?: readonly unknown[] | object }
export interface Capture {
  kind: 'SafeTx' | 'execTransaction';
  safe?: Address;
  chainId?: string;
  call: SafeCall | null;
}
export function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
export function address(value: unknown): Address | undefined {
  return typeof value === 'string' && isAddress(value, { strict: false }) ? value as Address : undefined;
}
/** Match independently of decoding: malformed target requests must still get a GREY review. */
export function matchRequest(request: Request): Capture | null {
  const params = Array.isArray(request.params) ? request.params : [];
  if (request.method === 'eth_signTypedData_v4') {
    let td: unknown = params[1];
    try { if (typeof td === 'string') td = JSON.parse(td); } catch { return null; }
    if (!record(td) || td.primaryType !== 'SafeTx') return null;
    const domain = record(td.domain) ? td.domain : {};
    return { kind: 'SafeTx', safe: address(domain.verifyingContract),
      chainId: typeof domain.chainId === 'string' || typeof domain.chainId === 'number' ? String(domain.chainId) : undefined,
      call: safeCallFromTypedData(td) };
  }
  if (request.method === 'eth_sendTransaction') {
    const tx: unknown = params[0];
    if (!record(tx)) return null;
    const data = tx.data ?? tx.input;
    if (typeof data !== 'string' || data.slice(0, 10).toLowerCase() !== '0x6a761202') return null;
    return { kind: 'execTransaction', safe: address(tx.to), call: safeCallFromExecTransaction(data as Hex) };
  }
  return null;
}
export function rejected(): Error & { code: number } {
  return Object.assign(new Error('User rejected the request.'), { code: 4001 });
}
/** Wallet is called exactly once, only after explicit approval; all failure paths reject. */
export async function gateRequest<T>(review: () => Promise<boolean>, forward: () => Promise<T>): Promise<T> {
  let approved = false;
  try { approved = await review(); } catch { /* disconnected bridge / timeout */ }
  if (!approved) throw rejected();
  return forward();
}
