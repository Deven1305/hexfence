// Read-only Ethereum scan; only the explicit publish command writes to Rabdi testnet.
import { parseArgs } from "node:util";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { createHash } from "node:crypto";
import { SuspectedLossSchema, rescuePackBody, MAINNET_USDT, MAINNET_USDC, type SuspectedLoss } from "@hexfence/shared";
import { publishLosses } from "@hexfence/arkiv";
import { formatUnits, isHex } from "viem";
import { LossDetector, sealLoss } from "./loss.js";
import { fetchTransferLogs, mainnetClient } from "./fetch.js";
import { mergeEvidence } from "./jsonl.js";

const { positionals, values } = parseArgs({ allowPositionals: true, options: {
  blocks: { type: "string", default: "7200" }, window: { type: "string", default: "100" },
  out: { type: "string", default: "out/losses.jsonl" }, summary: { type: "string", default: "out/loss-run.json" },
  limit: { type: "string", default: "5" },
} });
function positive(s: string): number { const n = Number(s); if (!Number.isSafeInteger(n) || n < 1) throw new Error("Expected a positive integer"); return n; }
function save(file: string, text: string) { mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, text); }
async function main() {
  if (positionals[0] === "scan") {
    if (!process.env.MAINNET_RPC_URL) throw new Error("Set MAINNET_RPC_URL in the root .env");
    const client = mainnetClient(process.env.MAINNET_RPC_URL);
    if (await client.getChainId() !== 1) throw new Error("Refusing a non-mainnet data source");
    const d = new LossDetector(); let windows = 0;
    const scan = await fetchTransferLogs(client, { blocks: positive(values.blocks), window: positive(values.window), onWindow: (logs, from, to) => {
      d.add(logs); if (++windows % 10 === 0) console.log(`Scanned blocks ${from}-${to}; ${d.results().length} suspected loss transactions so far`);
    } });
    const records = d.results(Number(scan.fromBlock), Number(scan.toBlock)).map(sealLoss);
    save(values.out, records.map(r => JSON.stringify(r)).join("\n") + (records.length ? "\n" : ""));
    mergeEvidence("out/loss-evidence.jsonl", d.evidence());
    const totals = [MAINNET_USDT, MAINNET_USDC].map(token => {
      const amount = records.filter(r => r.token.toLowerCase() === token.toLowerCase()).reduce((n, r) => n + BigInt(r.amount), 0n);
      return { token, amount: amount.toString(), formatted: formatUnits(amount, 6) };
    });
    const summary = { schema: "hexfence.loss-run.v1", chainId: 1, fromBlock: Number(scan.fromBlock), toBlock: Number(scan.toBlock), logCount: scan.count,
      poisoningPairs: d.evidence().length, lossTransactions: records.length, totals, completedAt: new Date().toISOString(), status: "suspected", publication: "not attempted" };
    save(values.summary, JSON.stringify(summary, null, 2) + "\n"); console.log(JSON.stringify(summary, null, 2));
    return;
  }
  if (positionals[0] === "publish") {
    const privateKey = process.env.ARKIV_PRIVATE_KEY;
    if (!privateKey || !isHex(privateKey) || privateKey.length !== 66) { console.log("Missing testnet publisher key; nothing written. Set ARKIV_PRIVATE_KEY in .env and rerun publish:losses."); return; }
    const records: SuspectedLoss[] = readFileSync(values.out, "utf8").split("\n").filter(Boolean).map(s => SuspectedLossSchema.parse(JSON.parse(s)));
    for (const r of records) if (createHash("sha256").update(rescuePackBody(r), "utf8").digest("hex") !== r.packHash) throw new Error("Rescue pack digest mismatch");
    const report = await publishLosses({ privateKey, accessKey: process.env.ARKIV_ACCESS_KEY, maxRecords: positive(values.limit) }, records);
    console.log(JSON.stringify(report, null, 2));
    try {
      const summary = JSON.parse(readFileSync(values.summary, "utf8")); summary.publication = report;
      save(values.summary, JSON.stringify(summary, null, 2) + "\n");
    } catch { console.log("Scan manifest not updated; retain the publication report above."); }
    return;
  }
  throw new Error("Use scan or publish");
}
main().catch((error: unknown) => {
  if (error instanceof Error && error.message.startsWith("A multi-token")) console.error(error.message);
  else console.error(`Failure type: ${error instanceof Error ? error.name : "unknown"}`);
  console.error("Loss command failed. Check RPC availability, input validity and testnet publisher funds; raw provider details withheld."); process.exitCode = 1; });
