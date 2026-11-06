import { lossPayments, MAINNET_USDT, MAINNET_USDC, type PoisoningEvidence, type SuspectedLoss } from "@hexfence/shared";
import { formatUnits } from "viem";

/** Distinct records, distinct attack transactions, and the most distinct victims behind one attack transaction. */
export function evidenceStats(records: readonly PoisoningEvidence[]) {
  const unique = [...new Map(records.map(e => [e.evidenceId.toLowerCase(), e])).values()];
  const victimsByTx = new Map<string, Set<string>>();
  for (const e of unique) {
    const tx = e.attackTx.toLowerCase();
    const set = victimsByTx.get(tx) ?? new Set<string>(); set.add(e.victim.toLowerCase()); victimsByTx.set(tx, set);
  }
  return { records: unique.length, attackTxs: victimsByTx.size, mostVictims: Math.max(0, ...[...victimsByTx.values()].map(s => s.size)) };
}

export interface LossTotal { symbol: string; units: bigint }
const symbolOf = (token: string) => token.toLowerCase() === MAINNET_USDT.toLowerCase() ? "USDT" : token.toLowerCase() === MAINNET_USDC.toLowerCase() ? "USDC" : "tokens";

/** Summed payment amounts per token over classified suspected-loss records, largest first. Empty when there are none. */
export function lossTotals(losses: readonly SuspectedLoss[]): LossTotal[] {
  const totals = new Map<string, bigint>();
  for (const p of losses.flatMap(l => lossPayments(l)).filter(p => p.origin !== "unclassified")) {
    const s = symbolOf(p.token); totals.set(s, (totals.get(s) ?? 0n) + BigInt(p.amount));
  }
  return [...totals].map(([symbol, units]) => ({ symbol, units })).sort((a, b) => (a.units > b.units ? -1 : a.units < b.units ? 1 : a.symbol.localeCompare(b.symbol)));
}
export const exactAmount = (t: LossTotal) => `${formatUnits(t.units, 6)} ${t.symbol}`;
export const compactAmount = (t: LossTotal) => Number(formatUnits(t.units, 6)).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
