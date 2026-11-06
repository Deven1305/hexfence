// HexFence detector CLI.
//   pnpm --filter @hexfence/detector detect [--blocks 7200] [--window 100] [--out out/evidence.jsonl]
//     Reads MAINNET_RPC_URL. Read-only: it never sends a mainnet transaction.
//   pnpm --filter @hexfence/detector publish:arkiv [--out out/evidence.jsonl] [--limit N] [--batch 25]
//     Writes the records to Arkiv (Rabdi testnet) as the publisher ARKIV_PRIVATE_KEY. Idempotent.
//   pnpm --filter @hexfence/detector labels [--n 30] [--seed 4919] [--sheet labels/h9-sample.csv]
//     Draws a random sample of records into a CSV for hand-labelling on Etherscan (T13 / H9).
//   pnpm --filter @hexfence/detector precision [--sheet labels/h9-sample.csv]
//     Precision = yes / (yes + no) from the filled-in sheet.
//   pnpm --filter @hexfence/detector h9-evidence [--sheet labels/h9-sample.csv] [--evidence labels/h9-evidence.md] [--rpc https://ethereum-rpc.publicnode.com]
//     Writes public mainnet facts for each sample row (never the CSV, never a label) so H9 labelling is quick.
// detect and publish read the repo-root .env (or the environment).
import { parseArgs } from "node:util";
import { arkivReadClient, publishEvidence } from "@hexfence/arkiv";
import { formatEther, isHex, parseEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { PoisoningDetector } from "./detect.js";
import { fetchTransferLogs, mainnetClient } from "./fetch.js";
import { mergeEvidence, readEvidence } from "./jsonl.js";
import { buildSheet, writeSheet } from "./h9Evidence.js";
import { readPrecision, sampleRecords, writeLabelSheet } from "./labels.js";

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    blocks: { type: "string", default: "7200" },
    window: { type: "string", default: "100" },
    out: { type: "string", default: "out/evidence.jsonl" },
    limit: { type: "string" },
    batch: { type: "string", default: "25" },
    n: { type: "string", default: "30" },
    seed: { type: "string", default: "4919" },
    sheet: { type: "string", default: "labels/h9-sample.csv" },
    evidence: { type: "string", default: "labels/h9-evidence.md" },
    rpc: { type: "string", default: "https://ethereum-rpc.publicnode.com" },
    scheduled: { type: "boolean", default: false },
  },
});

async function main(): Promise<void> {
  const command = positionals[0];
  if (command === "detect") return runDetect();
  if (command === "publish") return runPublish();
  if (command === "labels") return runLabels();
  if (command === "precision") return runPrecision();
  if (command === "h9-evidence") return runH9Evidence();
  throw new Error(`unknown command "${command ?? ""}"; use: detect | publish | labels | precision | h9-evidence`);
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

async function runH9Evidence(): Promise<void> {
  const client = mainnetClient(values.rpc);
  const chainId = await client.getChainId();
  if (chainId !== 1) throw new Error(`${values.rpc} is chain ${chainId}, not Ethereum mainnet (1)`);
  const { markdown, rows } = await buildSheet(client, values.sheet, values.rpc);
  writeSheet(values.evidence, markdown);
  console.log(`wrote ${rows} rows to ${values.evidence} (the CSV was only read)`);
}

async function runPublish(): Promise<void> {
  const privateKey = process.env.ARKIV_PRIVATE_KEY;
  if (!privateKey || !isHex(privateKey) || privateKey.length !== 66)
    throw new Error("set ARKIV_PRIVATE_KEY (a TESTNET-only key funded with Rabdi tGLM) in the repo-root .env");
  const accessKey = process.env.ARKIV_ACCESS_KEY;

  const all = readEvidence(values.out);
  // Manual --limit selects before deduplication for compatibility. Scheduled runs
  // pass all recent candidates; the writer caps NEW records after deduplication.
  const records =
    values.scheduled
      ? [...all].sort((a, b) => b.attackBlock - a.attackBlock)
      : values.limit === undefined
      ? all
      : [...all].sort((a, b) => b.attackBlock - a.attackBlock).slice(0, positiveInt(values.limit, "--limit"));
  const publisher = privateKeyToAccount(privateKey).address; // the public address only; the key is never printed
  console.error(`publisher ${publisher}: considering ${records.length} of ${all.length} records from ${values.out}`);

  // Fail early with a clear message: an unfunded publisher otherwise gets a vague "execution error".
  const reader = arkivReadClient(accessKey ? { accessKey } : {});
  const balance = await reader.getBalance({ address: publisher });
  console.error(`publisher balance: ${formatEther(balance)} tGLM`);
  if (balance === 0n) {
    console.log("Publisher has no tGLM; nothing written. Fund the Rabdi publisher before publishing.");
    return;
  }

  const report = await publishEvidence(
    {
      privateKey,
      ...(accessKey ? { accessKey } : {}),
      batchSize: positiveInt(values.batch, "--batch"),
      ...(values.scheduled ? {
        maxRecords: positiveInt(process.env.PUBLISH_MAX_RECORDS || "10", "PUBLISH_MAX_RECORDS"),
        // Above the measured 0.00047 tGLM single-record upper bound; not a price prediction.
        budget: { perRecord: parseEther("0.001"), reserve: parseEther("0.005") },
      } : {}),
      onBatch: (done, total, txHash) => console.error(`  ${done}/${total} created (tx ${txHash})`),
    },
    records,
    reader,
  );
  if (report.stoppedForFunds) console.log("Stopped cleanly: publisher funds are below the funding allowance. No further writes attempted.");
  console.log(
    `publisher ${report.publisher}: ${report.created} created, ${report.alreadyThere} already on Arkiv, ${report.txHashes.length} transactions`,
  );
  if (report.txHashes.length > 0) console.log(`first tx: https://rabdi.explorer.arkiv.network/tx/${report.txHashes[0]}`);
}

function runLabels(): void {
  const all = readEvidence(values.out);
  const sample = sampleRecords(all, positiveInt(values.n, "--n"), positiveInt(values.seed, "--seed"));
  writeLabelSheet(values.sheet, sample);
  console.log(`${sample.length} of ${all.length} records -> ${values.sheet}. Fill the "label" column with yes / no / unsure.`);
}

function runPrecision(): void {
  const p = readPrecision(values.sheet);
  const pct = p.precision === null ? "n/a" : `${(100 * p.precision).toFixed(1)}%`;
  console.log(`yes ${p.yes} · no ${p.no} · unsure ${p.unsure} · unlabelled ${p.unlabelled} -> precision ${pct}`);
}

function positiveInt(s: string, name: string): number {
  const n = Number(s);
  if (!Number.isSafeInteger(n) || n <= 0) throw new Error(`${name} must be a positive integer`);
  return n;
}

main().catch((e: unknown) => {
  // RPC errors may include request URLs or signed transaction details.
  console.error(values.scheduled ? "Scheduled publication failed; no automatic retry. Check configuration, RPC availability and publisher funds." : e instanceof Error ? e.message : e);
  process.exit(1);
});
