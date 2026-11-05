import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { PoisoningEvidenceSchema, type PoisoningEvidence } from "@hexfence/shared";

/** Read evidence.jsonl (one record per line). Every line is re-validated; a bad line is an error. */
export function readEvidence(path: string): PoisoningEvidence[] {
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8")
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line, i) => {
      const parsed = PoisoningEvidenceSchema.safeParse(JSON.parse(line));
      if (!parsed.success) throw new Error(`${path}:${i + 1}: ${parsed.error.message}`);
      return parsed.data;
    });
}

/**
 * Merge new records into the file, keyed by evidenceId: existing records are kept (runs over
 * different 24-hour windows accumulate), and a re-run adds nothing it already has.
 * Returns how many records were new.
 */
export function mergeEvidence(path: string, records: readonly PoisoningEvidence[]): { added: number; total: number } {
  const byId = new Map(readEvidence(path).map((e) => [e.evidenceId, e]));
  let added = 0;
  for (const e of records) {
    if (byId.has(e.evidenceId)) continue;
    byId.set(e.evidenceId, e);
    added++;
  }
  const all = [...byId.values()].sort((a, b) => a.attackBlock - b.attackBlock || a.evidenceId.localeCompare(b.evidenceId));
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, all.map((e) => JSON.stringify(e)).join("\n") + (all.length ? "\n" : ""));
  return { added, total: all.length };
}
