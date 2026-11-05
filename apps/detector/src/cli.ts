// HexFence detector CLI.
//   pnpm --filter @hexfence/detector detect [--blocks 7200] [--window 100] [--out out/evidence.jsonl]
// Reads MAINNET_RPC_URL from the repo-root .env (or the environment). Read-only: it never sends a transaction.
import { parseArgs } from "node:util";
import { detect } from "./detect.js";
import { fetchTransferLogs, mainnetClient } from "./fetch.js";
import { mergeEvidence } from "./jsonl.js";

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    blocks: { type: "string", default: "7200" },
    window: { type: "string", default: "100" },
    out: { type: "string", default: "out/evidence.jsonl" },
  },
});

async function main(): Promise<void> {
  const command = positionals[0];
  if (command !== "detect") throw new Error(`unknown command "${command ?? ""}"; use: detect`);

  const rpc = process.env.MAINNET_RPC_URL;
  if (!rpc) throw new Error("set MAINNET_RPC_URL (an Ethereum mainnet RPC) in the repo-root .env");
  const blocks = positiveInt(values.blocks, "--blocks");
  const window = positiveInt(values.window, "--window");

  const client = mainnetClient(rpc);
  const chainId = await client.getChainId();
  if (chainId !== 1) throw new Error(`MAINNET_RPC_URL is chain ${chainId}, not Ethereum mainnet (1)`);

  const t0 = Date.now();
  let windows = 0;
  const { logs, fromBlock, toBlock } = await fetchTransferLogs(client, {
    blocks,
    window,
    onWindow: (from, to, n) => {
      windows++;
      if (windows % 10 === 0) console.error(`  blocks ${from}-${to}: ${n} logs (${windows} windows, ${((Date.now() - t0) / 1000).toFixed(0)}s)`);
    },
  });
  console.error(`fetched ${logs.length} USDT/USDC Transfer logs, blocks ${fromBlock}-${toBlock}`);

  const found = detect(logs);
  const { added, total } = mergeEvidence(values.out, found);
  const byVariant = found.reduce<Record<string, number>>((m, e) => ((m[e.variant] = (m[e.variant] ?? 0) + 1), m), {});
  console.log(
    `${found.length} suspected poisonings in this window (${JSON.stringify(byVariant)}); ${added} new; ${total} in ${values.out}`,
  );
}

function positiveInt(s: string, name: string): number {
  const n = Number(s);
  if (!Number.isInteger(n) || n <= 0) throw new Error(`${name} must be a positive integer`);
  return n;
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
