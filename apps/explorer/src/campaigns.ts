import { matchLengths, type PoisoningEvidence } from "@hexfence/shared";
import { AddressXray, DataTable, EmptyState, StatTile } from "@hexfence/ui";
import { createPublicClient, http } from "viem";
import { mainnet } from "viem/chains";
import { el } from "./render.js";
import { renderDashboard } from "./dashboard.js";

const uniqueRecords = (rows: readonly PoisoningEvidence[]) => [...new Map(rows.map(e => [e.evidenceId.toLowerCase(), e])).values()];
export function groupCampaigns(rows: readonly PoisoningEvidence[]) {
  const groups = new Map<string, PoisoningEvidence[]>();
  for (const row of uniqueRecords(rows)) {
    const tx = row.attackTx.toLowerCase(); const group = groups.get(tx) ?? []; group.push(row); groups.set(tx, group);
  }
  return [...groups].map(([tx, records]) => ({ tx, records,
    victims: new Set(records.map(e => e.victim.toLowerCase())).size,
    lookalikes: new Set(records.map(e => e.lookalike.toLowerCase())).size,
    block: Math.min(...records.map(e => e.attackBlock)),
  })).sort((a, b) => b.victims - a.victims || b.records.length - a.records.length || a.tx.localeCompare(b.tx));
}

/** Conditional model: 4+4 already match; the remaining 32 hex digits are independent/uniform.
 * For s extra matches there are s+1 prefix/suffix splits. With one mismatch left, count it once.
 * Identical addresses are excluded from the sample space. */
export function chanceMatchProbability(length: number): number {
  if (!Number.isInteger(length) || length < 8 || length > 39) return 0;
  const s = length - 8; const match = 1 / 16; const different = 15 / 16;
  return (s === 31 ? 32 * different * match ** 31 : (s + 1) * different ** 2 * match ** s) / (1 - match ** 32);
}
export function matchComparison(rows: readonly PoisoningEvidence[]) {
  const records = uniqueRecords(rows);
  const lengths = records.map(e => { const m = matchLengths(e.lookalike, e.impersonated); return m.prefixLen + m.suffixLen; });
  return [8, 9, 10, 11, 12].map(length => ({
    label: length === 12 ? "12+ characters" : `${length} characters`,
    observed: lengths.filter(n => length === 12 ? n >= 12 : n === length).length,
    expected: records.length * (length === 12 ? Array.from({ length: 28 }, (_, i) => chanceMatchProbability(i + 12)).reduce((a, b) => a + b, 0) : chanceMatchProbability(length)),
  }));
}

export function utcHourBins(rows: readonly PoisoningEvidence[], times: ReadonlyMap<number, number>) {
  const seconds = uniqueRecords(rows).map(e => {
    const value = times.get(e.attackBlock);
    if (value === undefined || !Number.isSafeInteger(value) || value < 0) throw new Error("Block times are incomplete"); return value;
  });
  if (!seconds.length) return [];
  const first = Math.floor(Math.min(...seconds) / 3600) * 3600;
  const last = Math.floor(Math.max(...seconds) / 3600) * 3600;
  const bins: { from: number; to: number; count: number }[] = [];
  for (let from = first; from <= last; from += 3600) bins.push({ from, to: from + 3600, count: 0 });
  for (const value of seconds) bins[Math.floor((value - first) / 3600)]!.count++;
  return bins;
}
/** The busiest UTC hour and how many distinct attack blocks fill it. A tall bar from very few blocks
 * points at how records were picked for publishing, not at an hourly attack rate. */
export function peakHour(rows: readonly PoisoningEvidence[], times: ReadonlyMap<number, number>) {
  const bins = utcHourBins(rows, times); if (!bins.length) return null;
  const peak = bins.reduce((a, b) => b.count > a.count ? b : a);
  const inPeak = uniqueRecords(rows).filter(e => { const s = times.get(e.attackBlock)!; return s >= peak.from && s < peak.to; });
  return { from: peak.from, count: peak.count, total: uniqueRecords(rows).length, blocks: new Set(inPeak.map(e => e.attackBlock)).size };
}
export function utcLabel(seconds: number): string { return new Date(seconds * 1000).toISOString().slice(0, 16).replace("T", " "); }

function countBars(title: string, entries: { label: string; count: number }[]): HTMLElement {
  const root = el("section", "dashboard-chart", el("h3", undefined, title));
  const max = Math.max(1, ...entries.map(e => e.count));
  for (const e of entries) {
    const fill = el("span", "dashboard-fill"); fill.style.width = `${100 * e.count / max}%`;
    const row = el("div", "dashboard-row", el("span", undefined, e.label), el("span", "dashboard-track", fill), el("strong", undefined, String(e.count)));
    row.dataset.count = String(e.count); root.append(row);
  }
  if (!entries.length) root.append(EmptyState("No downloaded records yet."));
  return root;
}
function renderComparison(rows: readonly PoisoningEvidence[]): HTMLElement {
  const data = matchComparison(rows); const max = Math.max(1, ...data.flatMap(d => [d.observed, d.expected]));
  const root = el("section", "match-comparison", el("h3", undefined, "Observed match lengths and a random-middle model"),
    el("p", "dashboard-note", "Downloaded suspected records. Model: independent uniform middle digits, conditioned on matching the first 4 and last 4 characters and on distinct addresses."));
  for (const d of data) {
    const observed = el("span", "comparison-fill observed"); observed.style.width = `${100 * d.observed / max}%`;
    const expected = el("span", "comparison-fill expected"); expected.style.width = `${100 * d.expected / max}%`;
    root.append(el("div", "comparison-row", el("strong", undefined, d.label),
      el("div", "comparison-series", el("span", undefined, `Observed · ${d.observed}`), el("div", "dashboard-track", observed)),
      el("div", "comparison-series", el("span", undefined, `Model expected · ${d.expected.toFixed(2)}`), el("div", "dashboard-track", expected))));
  }
  const observed = data.slice(2).reduce((n, d) => n + d.observed, 0);
  const expected = data.slice(2).reduce((n, d) => n + d.expected, 0);
  if (expected > 0) root.append(el("p", "dashboard-note", `10+ matching characters: ${observed} observed; ${expected.toFixed(2)} expected under this model; ${(observed / expected).toFixed(1)}× observed/expected.`));
  return root;
}

// Public block metadata only; no address is part of a timestamp request.
const blockTimes = new Map<number, number>();
export function campaignsPanel(input: readonly PoisoningEvidence[], rpcUrl?: string): HTMLElement {
  const records = uniqueRecords(input); const groups = groupCampaigns(records);
  const root = el("section", "campaigns-panel", el("h2", undefined, "Campaigns · grouped by transaction"),
    el("p", "dashboard-note", "Counts refer to downloaded suspected records and the victims they mention."));
  root.append(el("div", "campaign-stats", StatTile("Downloaded records", String(records.length)), StatTile("Distinct attack transactions", String(groups.length)),
    StatTile("Most victims mentioned in one transaction", String(groups[0]?.victims ?? 0))));
  const details = groups.map(g => {
    const section = el("div", "campaign-detail", el("p", undefined, `${g.records.length} downloaded records mention ${g.victims} distinct victims in this transaction.`));
    section.append(DataTable(["Victim", "Pattern", "Address comparison"], g.records.map(e => [e.victim, e.variant,
      el("div", undefined, AddressXray(e.impersonated, e.lookalike, "Impersonated"), AddressXray(e.lookalike, e.impersonated, "Lookalike"))])));
    return section;
  });
  root.append(DataTable(["Attack transaction", "Victims mentioned", "Records", "Lookalikes", "Block"], groups.map(g => {
    const link = el("a", undefined, `${g.tx.slice(0, 10)}…${g.tx.slice(-6)}`) as HTMLAnchorElement;
    link.href = `https://etherscan.io/tx/${g.tx}`; link.target = "_blank"; link.rel = "noreferrer"; link.title = g.tx;
    return [link, String(g.victims), String(g.records.length), String(g.lookalikes), String(g.block)];
  }), details, "Records"));
  root.append(countBars("Victims mentioned by campaign transaction", groups.slice(0, 12).map(g => ({ label: `${g.tx.slice(0, 10)}…${g.tx.slice(-6)}`, count: g.victims }))));
  const timeSection = el("section", "hourly-panel", el("h3", undefined, "Published records per UTC hour"),
    el("p", "dashboard-note", "This counts the records this publisher chose to publish, not how many attacks happened in each hour."));
  const blocks = [...new Set(records.map(e => e.attackBlock))].sort((a, b) => a - b);
  const load = el("button", undefined, "Read real block times") as HTMLButtonElement; load.type = "button"; load.disabled = !rpcUrl || !blocks.length;
  const status = el("p", "status", `${blocks.length} distinct recorded attack blocks. Timestamps are read by block number.`); status.setAttribute("role", "status");
  const chart = el("div", "hourly-chart"); let running = false; let stop = false;
  load.onclick = () => {
    if (running) { stop = true; load.disabled = true; return; }
    running = true; stop = false; load.textContent = "Stop reading block times";
    const client = createPublicClient({ chain: mainnet, transport: http(rpcUrl, { retryCount: 1, timeout: 15_000 }) });
    void (async () => {
      if (await client.getChainId() !== 1) throw new Error("Expected Ethereum mainnet");
      for (const blockNumber of blocks) {
        if (stop || !root.isConnected) break;
        if (!blockTimes.has(blockNumber)) {
          const block = await client.getBlock({ blockNumber: BigInt(blockNumber) });
          const timestamp = Number(block.timestamp);
          if (block.number !== BigInt(blockNumber) || !Number.isSafeInteger(timestamp) || Number.isNaN(new Date(timestamp * 1000).getTime())) throw new Error("Invalid block time");
          blockTimes.set(blockNumber, timestamp);
        }
        status.textContent = `Block times loaded: ${blocks.filter(b => blockTimes.has(b)).length}/${blocks.length}`;
      }
      if (stop || !root.isConnected) { status.textContent = "Block-time read stopped. Loaded timestamps are retained for retry."; return; }
      const bins = utcHourBins(records, blockTimes);
      chart.replaceChildren(countBars("Downloaded suspected records · UTC hours", bins.map(b => ({ label: `${utcLabel(b.from)}–${utcLabel(b.to).slice(11)} UTC`, count: b.count }))));
      status.textContent = `${records.length} downloaded records assigned to ${bins.length} UTC hours using ${blocks.length} actual block timestamps.`;
      const peak = peakHour(records, blockTimes);
      if (peak && bins.length > 1 && peak.count * 2 > peak.total) chart.append(el("p", "dashboard-note",
        `${peak.count} of ${peak.total} records fall in ${utcLabel(peak.from)} UTC and come from ${peak.blocks} attack block${peak.blocks === 1 ? "" : "s"}. A spike like this shows which records were selected for publishing; it is not an hourly attack rate.`));
      chart.dataset.records = String(records.length); chart.dataset.blocks = String(blocks.length);
    })().catch(() => { status.textContent = "Could not finish reading block times. Retry to continue from loaded timestamps."; })
      .finally(() => { running = false; load.disabled = false; load.textContent = "Read real block times"; });
  };
  timeSection.append(load, status, chart); root.append(timeSection, renderComparison(records), renderDashboard(records));
  return root;
}
