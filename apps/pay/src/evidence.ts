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
  | { status: "ok"; map: Map<string, Hex[]>; count: number }
  | { status: "unavailable"; reason: string };

/** One bulk read, no per-recipient lookups. `fetchAll` is `fetchAllEvidence(client, publisher)` in the app. */
export async function loadListed(publisherConfigured: boolean, fetchAll: () => Promise<PoisoningEvidence[]>): Promise<ListedState> {
  if (!publisherConfigured) return { status: "off" };
  try {
    const records = await fetchAll();
    return { status: "ok", map: listedMap(records), count: records.length };
  } catch (e) {
    return { status: "unavailable", reason: e instanceof Error ? e.message : String(e) };
  }
}

export function listedStatusText(s: ListedState): string {
  switch (s.status) {
    case "off":
      return "Public evidence check is off (VITE_ARKIV_PUBLISHER is not set).";
    case "ok":
      return `Public evidence: ${s.count} record${s.count === 1 ? "" : "s"} loaded once from Arkiv.`;
    case "unavailable":
      return `Evidence unavailable: could not read Arkiv (${s.reason}). Payments are checked against your approved payees only.`;
  }
}
