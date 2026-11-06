// Read-only Ethereum scan; only the explicit publish command writes to Rabdi testnet.
import { parseArgs } from "node:util";
import { readFileSync, writeFileSync, mkdirSync, existsSync, appendFileSync, createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import { dirname } from "node:path";
import { createHash } from "node:crypto";
import { SuspectedLossSchema, rescuePackBody, lossPayments, lossPaymentOrigin, type LossTransaction, MAINNET_USDT, MAINNET_USDC, type SuspectedLoss } from "@hexfence/shared";
import { publishLosses } from "@hexfence/arkiv";
import { formatUnits, isHex, createPublicClient, http } from "viem";
import { mainnet } from "viem/chains";
import type { TransferLog } from "./detect.js";
import { LossDetector, sealLoss } from "./loss.js";
import { getLogsSplitting } from "./fetch.js";
import { mergeEvidence } from "./jsonl.js";

const { positionals, values } = parseArgs({ allowPositionals: true, options: {
  blocks: { type: "string", default: "7200" }, window: { type: "string", default: "100" },
  out: { type: "string", default: "out/losses.jsonl" }, summary: { type: "string", default: "out/loss-run.json" },
  limit: { type: "string", default: "5" },
  reviewed: { type: "string", default: "out/reviewed-losses.jsonl" },
  cache: { type: "string", default: "out/loss-cache.jsonl" }, resume: { type: "boolean", default: false },
} });
function positive(s: string): number { const n = Number(s); if (!Number.isSafeInteger(n) || n < 1) throw new Error("Expected a positive integer"); return n; }
function save(file: string, text: string) { mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, text); }
async function main() {
  if (positionals[0] === "scan") {
    if (!process.env.MAINNET_RPC_URL) throw new Error("Set MAINNET_RPC_URL in the root .env");
    const client = createPublicClient({ chain: mainnet, transport: http(process.env.MAINNET_RPC_URL, { timeout: 15_000, retryCount: 1 }) });
    if (await client.getChainId() !== 1) throw new Error("Refusing a non-mainnet data source");
    const d = new LossDetector(); let windows = 0; let count = 0;
    const blocks = positive(values.blocks); const window = positive(values.window);
    let toBlock: bigint; let fromBlock: bigint; let next: bigint;
    if (values.resume && existsSync(values.cache)) {
      const lines = createInterface({ input: createReadStream(values.cache), crlfDelay: Infinity });
      let header = true; toBlock = 0n; fromBlock = 0n; next = 0n;
      for await (const line of lines) {
        const item = JSON.parse(line);
        if (header) {
          if (item.schema !== "hexfence.loss-cache.v1" || item.chainId !== 1 || item.blocks !== blocks) throw new Error("Scan cache does not match requested window");
          toBlock = BigInt(item.toBlock); fromBlock = BigInt(item.fromBlock); next = fromBlock; header = false; continue;
        }
        if (BigInt(item.from) !== next || BigInt(item.to) > toBlock) throw new Error("Scan cache is not contiguous");
        const logs: TransferLog[] = item.logs.map((r: Omit<TransferLog, "value"> & { value: string }) => ({ ...r, value: BigInt(r.value) }));
        d.add(logs); count += logs.length; next = BigInt(item.to) + 1n; windows++;
      }
      if (header) throw new Error("Empty scan cache");
      console.log(`Resuming fixed scan ${fromBlock}-${toBlock} after ${windows} cached windows`);
    } else {
      toBlock = await client.getBlockNumber(); fromBlock = toBlock - BigInt(blocks) + 1n; next = fromBlock;
      save(values.cache, JSON.stringify({ schema: "hexfence.loss-cache.v1", chainId: 1, blocks, fromBlock: fromBlock.toString(), toBlock: toBlock.toString() }) + "\n");
    }
    for (let from = next; from <= toBlock; from += BigInt(window)) {
      const to = from + BigInt(window) - 1n < toBlock ? from + BigInt(window) - 1n : toBlock;
      const logs = await getLogsSplitting(client, from, to); d.add(logs); count += logs.length;
      appendFileSync(values.cache, JSON.stringify({ from: from.toString(), to: to.toString(), logs }, (_, value) => typeof value === "bigint" ? value.toString() : value) + "\n");
      if (++windows % 10 === 0) console.log(`Scanned blocks ${from}-${to}; ${d.results().length} suspected loss transactions so far (cached)`);
    }
    const scan = { fromBlock, toBlock, count };
    const records = d.results(Number(scan.fromBlock), Number(scan.toBlock)).map(sealLoss);
    save(values.out, records.map(r => JSON.stringify(r)).join("\n") + (records.length ? "\n" : ""));
    mergeEvidence("out/loss-evidence.jsonl", d.evidence());
    const totals = [MAINNET_USDT, MAINNET_USDC].map(token => {
      const amount = records.flatMap(lossPayments).filter(r => r.token.toLowerCase() === token.toLowerCase()).reduce((n, r) => n + BigInt(r.amount), 0n);
      return { token, amount: amount.toString(), formatted: formatUnits(amount, 6) };
    });
    const summary = { schema: "hexfence.loss-run.v1", chainId: 1, fromBlock: Number(scan.fromBlock), toBlock: Number(scan.toBlock), logCount: scan.count,
      poisoningPairs: d.evidence().length, lossTransactions: records.length, paymentCases: records.flatMap(lossPayments).length, totals, completedAt: new Date().toISOString(), status: "suspected", publication: "not attempted" };
    save(values.summary, JSON.stringify(summary, null, 2) + "\n"); console.log(JSON.stringify(summary, null, 2));
    return;
  }
  if (positionals[0] === "review") {
    if (!process.env.MAINNET_RPC_URL) throw new Error("Set MAINNET_RPC_URL");
    const client = createPublicClient({ chain: mainnet, transport: http(process.env.MAINNET_RPC_URL, { timeout: 15_000, retryCount: 1 }) });
    if (await client.getChainId() !== 1) throw new Error("Refusing non-mainnet transaction source");
    const records = readFileSync(values.out, "utf8").split("\n").filter(Boolean).map(s => SuspectedLossSchema.parse(JSON.parse(s)));
    const cacheFile = "out/loss-transactions.jsonl";
    const cache = new Map<string, LossTransaction>();
    if (existsSync(cacheFile)) for (const line of readFileSync(cacheFile, "utf8").split("\n").filter(Boolean)) {
      const r = JSON.parse(line); cache.set(r.hash, { ...r, value: BigInt(r.value), blockNumber: r.blockNumber === null ? null : BigInt(r.blockNumber) });
    }
    const checked: SuspectedLoss[] = []; let complete = 0;
    for (const r of records) {
      let tx = cache.get(r.lossTx);
      if (!tx) {
        const got = await client.getTransaction({ hash: r.lossTx });
        tx = { from: got.from, to: got.to, input: got.input, value: got.value, blockNumber: got.blockNumber };
        appendFileSync(cacheFile, JSON.stringify({ hash: r.lossTx, ...tx }, (_, v) => typeof v === "bigint" ? v.toString() : v) + "\n"); cache.set(r.lossTx, tx);
      }
      const payments = lossPayments(r).map(p => ({ ...p, origin: lossPaymentOrigin(r, p, tx!) })).filter(p => p.origin !== "unclassified");
      if (payments.length) checked.push(sealLoss({ ...r, ...payments[0]!, additionalPayments: payments.slice(1) }));
      if (++complete % 25 === 0) console.log(`Call shapes checked: ${complete}/${records.length}; ${checked.length} supported transactions`);
    }
    save(values.reviewed, checked.map(r => JSON.stringify(r)).join("\n") + (checked.length ? "\n" : ""));
    const summary = JSON.parse(readFileSync(values.summary, "utf8"));
    summary.rawPatterns ??= { transactions: records.length, paymentCases: records.flatMap(lossPayments).length, totals: summary.totals };
    summary.lossTransactions = checked.length; summary.paymentCases = checked.flatMap(lossPayments).length;
    summary.totals = [MAINNET_USDT, MAINNET_USDC].map(token => {
      const amount = checked.flatMap(lossPayments).filter(p => p.token.toLowerCase() === token.toLowerCase()).reduce((n,p) => n + BigInt(p.amount),0n);
      return { token, amount: amount.toString(), formatted: formatUnits(amount,6) };
    });
    summary.callShapeCheckedAt = new Date().toISOString(); summary.publication = "supported-call publication not attempted";
    if (existsSync("out/loss-retraction.json")) summary.initialRetraction = JSON.parse(readFileSync("out/loss-retraction.json","utf8"));
    save(values.summary, JSON.stringify(summary,null,2) + "\n"); console.log(JSON.stringify(summary,null,2)); return;
  }
  if (positionals[0] === "publish") {
    const privateKey = process.env.ARKIV_PRIVATE_KEY;
    if (!privateKey || !isHex(privateKey) || privateKey.length !== 66) { console.log("Missing testnet publisher key; nothing written. Set ARKIV_PRIVATE_KEY in .env and rerun publish:losses."); return; }
    const records: SuspectedLoss[] = readFileSync(values.reviewed, "utf8").split("\n").filter(Boolean).map(s => SuspectedLossSchema.parse(JSON.parse(s)));
    if (records.some(r => lossPayments(r).some(p => p.origin === "unclassified"))) throw new Error("Unclassified payment cannot be published as a suspected loss");
    for (const r of records) if (createHash("sha256").update(rescuePackBody(r), "utf8").digest("hex") !== r.packHash) throw new Error("Rescue pack digest mismatch");
    const amount = (r: SuspectedLoss) => lossPayments(r).reduce((max, p) => BigInt(p.amount) > max ? BigInt(p.amount) : max, 0n);
    records.sort((a, b) => amount(a) > amount(b) ? -1 : amount(a) < amount(b) ? 1 : a.lossTx.localeCompare(b.lossTx));
    const journalFile = "out/loss-publication.json";
    const journal: { txHash: string; evidenceId: string; lossTx: string }[] = existsSync(journalFile) ? JSON.parse(readFileSync(journalFile, "utf8")) : [];
    const report = await publishLosses({ privateKey, accessKey: process.env.ARKIV_ACCESS_KEY, maxRecords: positive(values.limit), onWrite: (txHash, record) => {
      journal.push({ txHash, evidenceId: record.evidenceId, lossTx: record.lossTx }); save(journalFile, JSON.stringify(journal, null, 2) + "\n");
      console.log(`Created suspected loss entity: ${txHash}`);
    } }, records);
    console.log(JSON.stringify(report, null, 2));
    try {
      const summary = JSON.parse(readFileSync(values.summary, "utf8"));
      summary.publicationHistory ??= [];
      if (summary.publication && typeof summary.publication === "object") summary.publicationHistory.push(summary.publication);
      summary.publication = report;
      save(values.summary, JSON.stringify(summary, null, 2) + "\n");
    } catch { console.log("Scan manifest not updated; retain the publication report above."); }
    return;
  }
  throw new Error("Use scan, review or publish");
}
main().catch((error: unknown) => {
  if (error instanceof Error && error.message.startsWith("A multi-token")) console.error(error.message);
  else console.error(`Failure type: ${error instanceof Error ? error.name : "unknown"}`);
  console.error("Loss command failed. Check RPC availability, input validity and testnet publisher funds; raw provider details withheld."); process.exitCode = 1; });
