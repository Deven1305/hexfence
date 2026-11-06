import { readFileSync, writeFileSync } from "node:fs";
import { fingerprint } from "@hexfence/shared";
import { formatUnits, getAddress, isHex, parseEventLogs, type Address, type Hex, type PublicClient, type TransactionReceipt } from "viem";
import { TRANSFER_EVENT } from "./fetch.js";

// H9 helper: public mainnet facts next to each row of the label sheet, so a person can judge each row quickly.
// It never writes the CSV, never fills the `label` column and never says yes/no: H9 stays human-labelled.

const USDT = "0xdac17f958d2ee523a2206206994597c13d831ec7";
const USDC = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48";
const TOKENS: Record<string, { symbol: string; decimals: number }> = { [USDT]: { symbol: "USDT", decimals: 6 }, [USDC]: { symbol: "USDC", decimals: 6 } };

export interface SheetRow {
  n: string;
  variant: string;
  victim: Address;
  impersonated: Address;
  lookalike: Address;
  attackTx: Hex;
  referenceTx: Hex;
}

/** Reads rows from the label sheet. Only reads; the `label` column is ignored. */
export function readSheetRows(csv: string): SheetRow[] {
  const [head, ...lines] = csv.trim().split(/\r?\n/);
  const cols = (head ?? "").split(",");
  const at = (cells: string[], name: string): string => cells[cols.indexOf(name)]?.trim() ?? "";
  const hash = (url: string): Hex => {
    const h = url.slice(url.lastIndexOf("/") + 1);
    if (!isHex(h) || h.length !== 66) throw new Error(`not a transaction link: ${url}`);
    return h;
  };
  return lines.map((line) => {
    const c = line.split(",");
    return {
      n: at(c, "n"),
      variant: at(c, "variant"),
      victim: getAddress(at(c, "victim")),
      impersonated: getAddress(at(c, "impersonated")),
      lookalike: getAddress(at(c, "lookalike")),
      attackTx: hash(at(c, "attack_tx")),
      referenceTx: hash(at(c, "reference_tx")),
    };
  });
}

export interface TransferFact {
  contract: Address;
  from: Address;
  to: Address;
  value: bigint;
}

export interface TxFacts {
  status: "success" | "reverted";
  block: bigint;
  from: Address;
  /** The contract or account the transaction was sent to. */
  to: Address | null;
  toIsContract: boolean | null;
  selector: Hex | null;
  /** Every ERC-20 Transfer log in the transaction (any token). */
  transfers: TransferFact[];
}

export async function loadTxFacts(client: PublicClient, hash: Hex): Promise<TxFacts> {
  const [tx, receipt] = await Promise.all([client.getTransaction({ hash }), client.getTransactionReceipt({ hash })]);
  const code = tx.to ? await client.getCode({ address: tx.to }) : undefined;
  return factsOf(tx.from, tx.to, tx.to ? (code ?? "0x") !== "0x" : null, tx.input, receipt);
}

export function factsOf(from: Address, to: Address | null, toIsContract: boolean | null, input: Hex, receipt: TransactionReceipt): TxFacts {
  const logs = parseEventLogs({ abi: [TRANSFER_EVENT], logs: receipt.logs, strict: false });
  return {
    status: receipt.status,
    block: receipt.blockNumber,
    from: getAddress(from),
    to: to ? getAddress(to) : null,
    toIsContract,
    selector: input.length >= 10 ? (input.slice(0, 10) as Hex) : null,
    transfers: logs.flatMap((l) =>
      l.args.from && l.args.to && l.args.value !== undefined
        ? [{ contract: getAddress(l.address), from: getAddress(l.args.from), to: getAddress(l.args.to), value: l.args.value }]
        : [],
    ),
  };
}

const same = (a: string, b: string): boolean => a.toLowerCase() === b.toLowerCase();

/** First 4 and last 4 hex characters in bold; everything else plain. */
export function highlight(address: string): string {
  const h = address.slice(2);
  return `0x**${h.slice(0, 4)}**${h.slice(4, -4)}**${h.slice(-4)}**`;
}

function amount(contract: string, value: bigint): string {
  const t = TOKENS[contract.toLowerCase()];
  return t ? `${formatUnits(value, t.decimals)} ${t.symbol} (raw ${value})` : `raw ${value} (token is not USDT/USDC)`;
}

const tx = (h: string): string => `[${h}](https://etherscan.io/tx/${h})`;
const addr = (a: string): string => `[${a}](https://etherscan.io/address/${a})`;
const yn = (b: boolean): string => (b ? "yes" : "no");

export function renderRow(row: SheetRow, ref: TxFacts, atk: TxFacts): string {
  const refPay = ref.transfers.filter((t) => same(t.from, row.victim) && same(t.to, row.impersonated));
  const involving = atk.transfers.filter((t) => [t.from, t.to].some((x) => same(x, row.lookalike)));
  const stable = atk.transfers.filter((t) => TOKENS[t.contract.toLowerCase()]);
  const lines: string[] = [`### Row ${row.n} (detector variant: ${row.variant})`, ""];
  lines.push("| | |", "|---|---|");
  lines.push(`| Victim | ${highlight(row.victim)} ${addr(row.victim)} |`);
  lines.push(`| Impersonated (the real counterparty) | ${highlight(row.impersonated)} ${addr(row.impersonated)} |`);
  lines.push(`| Lookalike | ${highlight(row.lookalike)} ${addr(row.lookalike)} |`);
  lines.push(
    `| Lookalike vs impersonated | different address: ${yn(!same(row.lookalike, row.impersonated))}; first 4 + last 4 hex equal: ${yn(fingerprint(row.lookalike) === fingerprint(row.impersonated))} |`,
  );
  lines.push(
    `| Reference tx | ${tx(row.referenceTx)}, block ${ref.block}, ${ref.status}. Victim to impersonated Transfer in this tx: **${yn(refPay.length > 0)}**${refPay.map((t) => ` (${amount(t.contract, t.value)}, token ${t.contract})`).join("")} |`,
  );
  lines.push(`| Attack tx | ${tx(row.attackTx)}, block ${atk.block}, ${atk.status}. Reference block is not after attack block: ${yn(ref.block <= atk.block)} |`);
  lines.push(`| Attack tx sent by | ${addr(atk.from)} |`);
  lines.push(
    `| Attack tx sent to | ${atk.to ? `${addr(atk.to)} (${atk.toIsContract ? "contract" : "plain account"})` : "contract creation"}; method id ${atk.selector ?? "none"} |`,
  );
  lines.push(`| Transfer logs in attack tx | ${atk.transfers.length} in total, ${stable.length} of them USDT/USDC |`);
  lines.push(
    `| Transfers touching the lookalike | ${involving.length === 0 ? "none" : involving.map((t) => `${amount(t.contract, t.value)}: ${t.from} to ${t.to} (token ${t.contract})`).join("<br>")} |`,
  );
  lines.push("", "Your label (write it in the CSV, not here): ____", "");
  return lines.join("\n");
}

export function renderSheet(rows: readonly { row: SheetRow; ref: TxFacts; atk: TxFacts }[], source: string): string {
  const head = [
    "# H9 evidence sheet (facts only)",
    "",
    `Source: public Ethereum mainnet data read through ${source}. Generated by \`pnpm --filter @hexfence/detector h9-evidence\`.`,
    "",
    "This sheet only collects facts from the chain so each row is quick to judge. It does **not** say whether a row is address poisoning:",
    "that is your decision. Fill the `label` column of `apps/detector/labels/h9-sample.csv` with `yes`, `no` or `unsure`, then run",
    "`pnpm --filter @hexfence/detector precision`. Bold marks the first 4 and last 4 hex characters.",
    "",
    "Facts per row: whether the reference transaction shows the victim paying the impersonated address, what the attack transaction moved,",
    "who sent it and to what, and how many Transfer logs it emitted.",
    "",
  ];
  return [...head, ...rows.map((r) => renderRow(r.row, r.ref, r.atk))].join("\n");
}

export async function buildSheet(client: PublicClient, csvPath: string, source: string): Promise<{ markdown: string; rows: number }> {
  const rows = readSheetRows(readFileSync(csvPath, "utf8"));
  const out: { row: SheetRow; ref: TxFacts; atk: TxFacts }[] = [];
  for (const row of rows) {
    out.push({ row, ref: await loadTxFacts(client, row.referenceTx), atk: await loadTxFacts(client, row.attackTx) });
    console.error(`  row ${row.n}/${rows.length}`);
  }
  return { markdown: renderSheet(out, source), rows: rows.length };
}

export function writeSheet(path: string, markdown: string): void {
  writeFileSync(path, markdown);
}
