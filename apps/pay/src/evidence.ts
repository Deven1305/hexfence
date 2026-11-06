import type { PoisoningEvidence } from "@hexfence/shared";
import type { Hex } from "viem";

/**
 * Map of lowercase address -> evidenceIds for `verdictFor(..., listed)`.
 * Keyed on `lookalike` ONLY: `victim` and `impersonated` are innocent parties (the impersonated address is
 * often the user's real payee), so listing them would flag the right address RED.
 */
export function listedMap(records: readonly PoisoningEvidence[]): Map<string, Hex[]> {
  const m = new Map<string, Hex[]>();
  for (const r of records) {
    const k = r.lookalike.toLowerCase();
    const ids = m.get(k);
    if (ids) {
      if (!ids.includes(r.evidenceId)) ids.push(r.evidenceId);
    } else m.set(k, [r.evidenceId]);
  }
  return m;
}

/** Never implied clean: a failed read is its own state, shown to the user. */
export type ListedState =
  | { status: "off" } // no publisher configured
  | { status: "ok"; map: Map<string, Hex[]>; count: number; savedAt?: number }
  | { status: "unavailable"; reason: string };

/** A dated copy read from Arkiv at deploy time, used only after the live read failed. */
export interface SavedEvidenceRead { evidence: PoisoningEvidence[]; source: "live" | "saved"; readAt: number }

/** One bulk read, no per-recipient lookups. `fetchAll` is `evidenceWithSavedCopy(client, publisher, url)` in the app. */
export async function loadListed(publisherConfigured: boolean, fetchAll: () => Promise<PoisoningEvidence[] | SavedEvidenceRead>): Promise<ListedState> {
  if (!publisherConfigured) return { status: "off" };
  try {
    const read = await fetchAll();
    const records = Array.isArray(read) ? read : read.evidence;
    const savedAt = !Array.isArray(read) && read.source === "saved" ? read.readAt : undefined;
    return { status: "ok", map: listedMap(records), count: records.length, ...(savedAt === undefined ? {} : { savedAt }) };
  } catch (e) {
    return { status: "unavailable", reason: e instanceof Error ? e.message : String(e) };
  }
}

export function listedStatusText(s: ListedState): string {
  switch (s.status) {
    case "off":
      return "Public evidence check is off (VITE_ARKIV_PUBLISHER is not set).";
    case "ok":
      if (s.savedAt !== undefined) {
        return `Public evidence: the live Arkiv read failed, so ${s.count} record${s.count === 1 ? "" : "s"} come from a copy read from Arkiv at ${new Date(s.savedAt).toISOString().replace("T", " ").replace("Z", " UTC")}. Newer records would not appear.`;
      }
      return `Public evidence: ${s.count} record${s.count === 1 ? "" : "s"} loaded once from Arkiv.`;
    case "unavailable":
      return `Evidence unavailable: could not read Arkiv (${s.reason}). Payments are checked against your approved payees only.`;
  }
}
