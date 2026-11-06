import { decodeSafeCall, hexFenceGuardAbi, verdictFor, type Verdict } from '@hexfence/shared';
import { arkivReadClient, fetchAllEvidence } from '@hexfence/arkiv';
import { createPublicClient, getAddress, http, zeroAddress, type Hex } from 'viem';
import { sepolia } from 'viem/chains';
import { matchRequest, type Request } from './interception';
import { ARKIV_ORIGIN, rpcOrigin, settings } from './config';
import { verdictText } from './verdictCopy';

export interface Review {
  level: Verdict['level']; sentences: string[]; recipient?: string;
  payee?: string; reason?: string;
  safe?: string; guard?: string; notice?: string; ready: boolean;
}
export function cannotVerify(notice: string): Review {
  return { level: 'GREY', sentences: ['Cannot verify this transaction type. HexFence checks only ETH and ERC-20 transfers.'], notice, ready: true };
}
function sepoliaId(id: unknown): boolean {
  try { return (typeof id === 'string' || typeof id === 'number') && BigInt(id) === 11155111n; } catch { return false; }
}
// Safe 1.3/1.4 GuardManager: getGuard is internal, so read the documented storage slot.
const GUARD_SLOT = '0x4a204f620c8c5ccdca3fd54d003badd85ba500436a431f0cbda4f558c93c34c8';
export async function check(request: Request, walletChain: unknown): Promise<Review> {
  const capture = matchRequest(request);
  if (!capture?.safe || !capture.call) return cannotVerify('The intercepted request could not be decoded.');
  if (!sepoliaId(walletChain) || (capture.kind === 'SafeTx' && !sepoliaId(capture.chainId))) {
    return cannotVerify('Only Sepolia requests can be checked.');
  }
  try {
    const config = await settings();
    if (!await chrome.permissions.contains({ origins: [rpcOrigin(config.rpc)] })) throw new Error();
    const client = createPublicClient({ chain: sepolia, transport: http(config.rpc, { timeout: 8_000, retryCount: 0 }) });
    if (await client.getChainId() !== sepolia.id) throw new Error();
    const blockNumber = await client.getBlockNumber();
    const slot = await client.getStorageAt({ address: capture.safe, slot: GUARD_SLOT, blockNumber });
    if (!slot || !/^0x[0-9a-fA-F]{64}$/.test(slot)) throw new Error();
    const activeGuard = getAddress(`0x${slot.slice(-40)}`);
    // Read the configured HexFence Guard's entire list exactly once, at the same block.
    const payees = await client.readContract({ address: config.guard, abi: hexFenceGuardAbi,
      functionName: 'payees', args: [capture.safe], blockNumber });
    const guardActive = activeGuard !== zeroAddress && activeGuard.toLowerCase() === config.guard.toLowerCase();
    const payment = decodeSafeCall(capture.call, { safe: capture.safe, guard: config.guard });
    const listed = new Map<string, Hex[]>();
    let notice = 'Public evidence check is off (no publisher configured).';
    if (config.publisher) {
      if (!await chrome.permissions.contains({ origins: [ARKIV_ORIGIN] })) throw new Error();
      // All pages for one publisher. Never send a recipient to Arkiv.
      const records = await fetchAllEvidence(arkivReadClient(), config.publisher);
      for (const item of records) {
        const key = item.lookalike.toLowerCase();
        listed.set(key, [...(listed.get(key) ?? []), item.evidenceId]);
      }
      notice = `Ethereum mainnet evidence · status: suspected · ${records.length} records loaded in bulk.`;
    }
    const verdict = verdictFor(payment, [...payees], listed);
    return { ...verdictText(verdict, { guardActive, publisher: config.publisher }),
      recipient: 'recipient' in verdict ? verdict.recipient : undefined,
      payee: 'payee' in verdict ? verdict.payee : undefined,
      reason: 'reason' in verdict ? verdict.reason : undefined,
      // Keep resemblance (including the synthetic demo) separate from public evidence.
      safe: capture.safe, guard: activeGuard,
      notice: verdict.level === 'RED' && verdict.reason === 'resembles' ? undefined : notice, ready: true };
  } catch {
    // Do not expose endpoint URLs / access tokens or RPC errors in the UI or console.
    return cannotVerify('Configuration or network reads are unavailable. Open extension options and retry.');
  }
}
