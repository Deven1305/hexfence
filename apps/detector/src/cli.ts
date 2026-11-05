// HexFence detector CLI.
//   pnpm --filter @hexfence/detector detect [--blocks 7200] [--window 100] [--out out/evidence.jsonl]
//     Reads MAINNET_RPC_URL. Read-only: it never sends a mainnet transaction.
//   pnpm --filter @hexfence/detector publish:arkiv [--out out/evidence.jsonl] [--limit N] [--batch 25]
//     Writes the records to Arkiv (Rabdi testnet) as the publisher ARKIV_PRIVATE_KEY. Idempotent.
// Both read the repo-root .env (or the environment).
import { parseArgs } from "node:util";
import { arkivReadClient, publishEvidence } from "@hexfence/arkiv";
import { formatEther, isHex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { PoisoningDetector } from "./detect.js";
import { fetchTransferLogs, mainnetClient } from "./fetch.js";
import { mergeEvidence, readEvidence } from "./jsonl.js";

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    blocks: { type: "string", default: "7200" },
    window: { type: "string", default: "100" },
    out: { type: "string", default: "out/evidence.jsonl" },
    limit: { type: "string" },
    batch: { type: "string", default: "25" },
  },
});

async function main(): Promise<void> {
  const command = positionals[0];
  if (command === "detect") return runDetect();
  if (command === "publish") return runPublish();
  throw new Error(`unknown command "${command ?? ""}"; use: detect | publish`);
}

async function runDetect(): Promise<void> {
  const rpc = process.env.MAINNET_RPC_URL;
  if (!rpc) throw new Error("set MAINNET_RPC_URL (an Ethereum mainnet RPC) in the repo-root .env");
  const blocks = positiveInt(values.blocks, "--blocks");
  const window = positiveInt(values.window, "--window");

  const client = mainnetClient(rpc);
  const chainId = await client.getChainId();
  if (chainId !== 1) throw new Error(`MAINNET_RPC_URL is chain ${chainId}, not Ethereum mainnet (1)`);

  const t0 = Date.now();
  const detector = new PoisoningDetector();
  let windows = 0;
  const { count, fromBlock, toBlock } = await fetchTransferLogs(client, {
    blocks,
    window,
    onWindow: (logs, from, to) => {
      detector.add(logs);
      if (++windows % 10 === 0) {
        const secs = ((Date.now() - t0) / 1000).toFixed(0);
        console.error(`  blocks ${from}-${to}: ${logs.length} logs; ${detector.results().length} found so far (${secs}s)`);
      }
    },
  });
  console.error(`scanned ${count} USDT/USDC Transfer logs, blocks ${fromBlock}-${toBlock}`);

  const found = detector.results();
  const { added, total } = mergeEvidence(values.out, found);
  const byVariant = found.reduce<Record<string, number>>((m, e) => ((m[e.variant] = (m[e.variant] ?? 0) + 1), m), {});
  console.log(
    `${found.length} suspected poisonings in this window (${JSON.stringify(byVariant)}); ${added} new; ${total} in ${values.out}`,
  );
}

async function runPublish(): Promise<void> {
  const privateKey = process.env.ARKIV_PRIVATE_KEY;
  if (!privateKey || !isHex(privateKey) || privateKey.length !== 66)
    throw new Error("set ARKIV_PRIVATE_KEY (a TESTNET-only key funded with Rabdi tGLM) in the repo-root .env");
  const accessKey = process.env.ARKIV_ACCESS_KEY;

  const all = readEvidence(values.out);
  // --limit N publishes only the N most recent attacks (and says so); without it, everything.
  const records =
    values.limit === undefined
      ? all
      : [...all].sort((a, b) => b.attackBlock - a.attackBlock).slice(0, positiveInt(values.limit, "--limit"));
  const publisher = privateKeyToAccount(privateKey).address; // the public address only; the key is never printed
  console.error(`publisher ${publisher}: publishing ${records.length} of ${all.length} records from ${values.out}`);

  // Fail early with a clear message: an unfunded publisher otherwise gets a vague "execution error".
  const reader = arkivReadClient(accessKey ? { accessKey } : {});
  const balance = await reader.getBalance({ address: publisher });
  console.error(`publisher balance: ${formatEther(balance)} tGLM`);
  if (balance === 0n) throw new Error(`publisher ${publisher} has no tGLM: fund it at https://hub.arkiv.network/faucet`);

  const report = await publishEvidence(
    {
      privateKey,
      ...(accessKey ? { accessKey } : {}),
      batchSize: positiveInt(values.batch, "--batch"),
      onBatch: (done, total, txHash) => console.error(`  ${done}/${total} created (tx ${txHash})`),
    },
    records,
    reader,
  );
  console.log(
    `publisher ${report.publisher}: ${report.created} created, ${report.alreadyThere} already on Arkiv, ${report.txHashes.length} transactions`,
  );
  if (report.txHashes.length > 0) console.log(`first tx: https://rabdi.explorer.arkiv.network/tx/${report.txHashes[0]}`);
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
