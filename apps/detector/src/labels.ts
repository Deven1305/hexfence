import { readFileSync, writeFileSync } from "node:fs";
import type { PoisoningEvidence } from "@hexfence/shared";

// T13 / H9: a precision check on hand-labelled samples. A person opens both transactions on
// Etherscan and decides whether the record really is address poisoning.

const HEADER = ["n", "label", "variant", "victim", "impersonated", "lookalike", "attack_tx", "reference_tx", "notes"] as const;
export const LABELS = ["yes", "no", "unsure"] as const;
export type Label = (typeof LABELS)[number];

/** Deterministic pick of `n` records (seeded shuffle), so the sheet can be regenerated identically. */
export function sampleRecords(records: readonly PoisoningEvidence[], n: number, seed: number): PoisoningEvidence[] {
  let s = seed >>> 0;
  const rand = () => ((s = (Math.imul(s ^ (s >>> 15), 0x2c1b3c6d) + 0x6d2b79f5) >>> 0) / 4294967296);
  const sorted = [...records].sort((a, b) => a.evidenceId.localeCompare(b.evidenceId)); // input order doesn't matter
  for (let i = sorted.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [sorted[i], sorted[j]] = [sorted[j]!, sorted[i]!];
  }
  return sorted.slice(0, n);
}

/** A CSV with an empty `label` column and Etherscan links, for a person to fill in. */
export function labelSheet(sample: readonly PoisoningEvidence[]): string {
  const tx = (h: string) => `https://etherscan.io/tx/${h}`;
  const rows = sample.map((e, i) => [String(i + 1), "", e.variant, e.victim, e.impersonated, e.lookalike, tx(e.attackTx), tx(e.referenceTx), ""]);
  return [HEADER.join(","), ...rows.map((r) => r.join(","))].join("\n") + "\n";
}

export interface Precision {
  yes: number;
  no: number;
  unsure: number;
  unlabelled: number;
  /** yes / (yes + no); null until at least one yes/no label exists. */
  precision: number | null;
}

/** Reads a filled-in sheet. `unsure` rows are reported but left out of the precision. */
export function precisionOf(csv: string): Precision {
  const lines = csv.trim().split(/\r?\n/);
  const header = lines[0]?.split(",") ?? [];
  const col = header.indexOf("label");
  if (col < 0) throw new Error("not a label sheet: no 'label' column");
  const p: Precision = { yes: 0, no: 0, unsure: 0, unlabelled: 0, precision: null };
  for (const line of lines.slice(1)) {
    const label = (line.split(",")[col] ?? "").trim().toLowerCase();
    if (label === "") p.unlabelled++;
    else if ((LABELS as readonly string[]).includes(label)) p[label as Label]++;
    else throw new Error(`unknown label "${label}" (use yes, no or unsure)`);
  }
  p.precision = p.yes + p.no > 0 ? p.yes / (p.yes + p.no) : null;
  return p;
}

export function writeLabelSheet(path: string, sample: readonly PoisoningEvidence[]): void {
  writeFileSync(path, labelSheet(sample));
}

export function readPrecision(path: string): Precision {
  return precisionOf(readFileSync(path, "utf8"));
}
