import { MAINNET_USDC, MAINNET_USDT } from "@hexfence/shared";
import { createPublicClient, http, parseAbiItem, type PublicClient } from "viem";
import { mainnet } from "viem/chains";
import type { TransferLog } from "./detect.js";

/** topic0 = 0xddf252ad…b3ef (spec §2). */
export const TRANSFER_EVENT = parseAbiItem("event Transfer(address indexed from, address indexed to, uint256 value)");

export function mainnetClient(rpcUrl: string): PublicClient {
  return createPublicClient({ chain: mainnet, transport: http(rpcUrl, { retryCount: 3, timeout: 60_000 }) });
}

export interface FetchOptions {
  /** How many of the latest blocks to scan (spec: 7,200 ≈ 24 hours). */
  blocks: number;
  /** eth_getLogs window (spec: 100). Halved automatically when the RPC refuses a window. */
  window: number;
  /** Progress callback, e.g. for a log line per window. */
  onWindow?: (from: bigint, to: bigint, logs: number) => void;
}

/** USDT + USDC Transfer logs of the latest `blocks` blocks, in one eth_getLogs per window. */
export async function fetchTransferLogs(client: PublicClient, opts: FetchOptions): Promise<{ logs: TransferLog[]; fromBlock: bigint; toBlock: bigint }> {
  const toBlock = await client.getBlockNumber();
  const fromBlock = toBlock - BigInt(opts.blocks) + 1n;
  const logs: TransferLog[] = [];
  for (let start = fromBlock; start <= toBlock; start += BigInt(opts.window)) {
    const end = minBig(start + BigInt(opts.window) - 1n, toBlock);
    const got = await getLogsSplitting(client, start, end);
    logs.push(...got);
    opts.onWindow?.(start, end, got.length);
  }
  return { logs, fromBlock, toBlock };
}

/** One window; if the RPC rejects it (response too big, too many results), split it in two. */
async function getLogsSplitting(client: PublicClient, from: bigint, to: bigint): Promise<TransferLog[]> {
  try {
    const raw = await client.getLogs({ address: [MAINNET_USDT, MAINNET_USDC], event: TRANSFER_EVENT, fromBlock: from, toBlock: to, strict: true });
    const out: TransferLog[] = [];
    for (const l of raw) {
      if (l.removed || l.blockNumber === null || l.logIndex === null || l.transactionHash === null) continue;
      out.push({
        token: l.address,
        from: l.args.from,
        to: l.args.to,
        value: l.args.value,
        blockNumber: Number(l.blockNumber),
        logIndex: l.logIndex,
        txHash: l.transactionHash,
      });
    }
    return out;
  } catch (err) {
    if (from === to) throw err; // a single block that still fails is a real error
    const mid = from + (to - from) / 2n;
    return [...(await getLogsSplitting(client, from, mid)), ...(await getLogsSplitting(client, mid + 1n, to))];
  }
}

function minBig(a: bigint, b: bigint): bigint {
  return a < b ? a : b;
}
