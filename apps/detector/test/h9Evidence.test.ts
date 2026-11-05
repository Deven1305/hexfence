import { describe, expect, it } from "vitest";
import { getAddress, type Address, type Hex } from "viem";
import { factsOf, highlight, readSheetRows, renderRow, type SheetRow, type TxFacts } from "../src/h9Evidence.js";

// Synthetic data, only to exercise parsing and rendering.
const V: Address = getAddress("0x1111111111111111111111111111111111111111");
const R: Address = getAddress("0x2ef9a83c5e1b77d04c3f9a2b6d81e0c452d18bf7");
const L: Address = getAddress("0x2ef970bc13aa94e2f05c7d6b8e3a21f991f38bf7");
const USDT: Address = getAddress("0xdac17f958d2ee523a2206206994597c13d831ec7");
const H1 = `0x${"aa".repeat(32)}` as Hex;
const H2 = `0x${"bb".repeat(32)}` as Hex;

describe("h9 evidence sheet", () => {
  it("reads rows and ignores the label column", () => {
    const csv = `n,label,variant,victim,impersonated,lookalike,attack_tx,reference_tx,notes\n1,yes,zero-value,${V},${R},${L},https://etherscan.io/tx/${H1},https://etherscan.io/tx/${H2},\n`;
    expect(readSheetRows(csv)).toEqual([{ n: "1", variant: "zero-value", victim: V, impersonated: R, lookalike: L, attackTx: H1, referenceTx: H2 }]);
  });

  it("highlights first 4 and last 4 hex", () => {
    expect(highlight(R)).toBe("0x**" + R.slice(2, 6) + "**" + R.slice(6, -4) + "**" + R.slice(-4) + "**");
  });

  const facts = (over: Partial<TxFacts>): TxFacts => ({ status: "success", block: 10n, from: V, to: USDT, toIsContract: true, selector: "0x23b872dd", transfers: [], ...over });
  const row: SheetRow = { n: "7", variant: "zero-value", victim: V, impersonated: R, lookalike: L, attackTx: H1, referenceTx: H2 };

  it("states facts, never a verdict or a label", () => {
    const md = renderRow(
      row,
      facts({ block: 9n, transfers: [{ contract: USDT, from: V, to: R, value: 2_000_000n }] }),
      facts({ transfers: [{ contract: USDT, from: V, to: L, value: 0n }] }),
    );
    expect(md).toContain("Victim to impersonated Transfer in this tx: **yes** (2 USDT");
    expect(md).toContain("first 4 + last 4 hex equal: yes");
    expect(md).toContain("1 in total, 1 of them USDT/USDC");
    expect(md).toContain(`etherscan.io/tx/${H1}`);
    expect(md).not.toMatch(/\b(is|looks like|likely) (a )?(poisoning|scam)|verified|malicious/i);
  });

  it("reports when the reference tx does not show the payment", () => {
    expect(renderRow(row, facts({}), facts({}))).toContain("Victim to impersonated Transfer in this tx: **no**");
  });

  it("factsOf decodes Transfer logs from a receipt", () => {
    const topic = (a: Address): Hex => `0x${a.slice(2).toLowerCase().padStart(64, "0")}`;
    const receipt = {
      status: "success",
      blockNumber: 5n,
      logs: [
        {
          address: USDT,
          topics: ["0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef", topic(V), topic(L)],
          data: `0x${"0".repeat(64)}`,
          logIndex: 0,
          blockNumber: 5n,
          transactionHash: H1,
          transactionIndex: 0,
          blockHash: H2,
          removed: false,
        },
      ],
    } as never;
    const f = factsOf(V, USDT, true, "0x23b872dd00", receipt);
    expect(f.transfers).toEqual([{ contract: USDT, from: V, to: L, value: 0n }]);
    expect(f.selector).toBe("0x23b872dd");
  });
});
