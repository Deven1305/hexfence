import { describe, expect, it } from "vitest";
import { MAINNET_USDC, MAINNET_USDT, type PoisoningEvidence, type SuspectedLoss } from "@hexfence/shared";
import { compactAmount, evidenceStats, exactAmount, lossTotals } from "../stats";

const ev = (id: string, tx: string, victim: string) => ({ evidenceId: id, attackTx: tx, victim }) as unknown as PoisoningEvidence;
const loss = (token: string, amount: string, origin: string, more: unknown[] = []) =>
  ({ token, amount, origin, additionalPayments: more }) as unknown as SuspectedLoss;

describe("landing stats", () => {
  it("counts distinct records, attack transactions and the most victims behind one transaction", () => {
    const s = evidenceStats([ev("a", "0x1", "v1"), ev("b", "0x1", "v2"), ev("b", "0x1", "v2"), ev("c", "0x2", "v1"), ev("d", "0x1", "V1")]);
    expect(s).toEqual({ records: 4, attackTxs: 2, mostVictims: 2 });
  });
  it("reports zero for no records", () => { expect(evidenceStats([])).toEqual({ records: 0, attackTxs: 0, mostVictims: 0 }); });
  it("sums loss payments per token, skips unclassified ones, and keeps the exact value", () => {
    const totals = lossTotals([
      loss(MAINNET_USDT, "303635007", "safe", [{ token: MAINNET_USDT, amount: "1000000", origin: "direct" }]),
      loss(MAINNET_USDC, "5000000", "direct"),
      loss(MAINNET_USDT, "999000000", "unclassified"),
    ]);
    expect(totals.map(exactAmount)).toEqual(["304.635007 USDT", "5 USDC"]);
    expect(compactAmount(totals[0]!)).toBe("304.64");
  });
  it("returns no total when no loss records exist", () => { expect(lossTotals([])).toEqual([]); });
});
