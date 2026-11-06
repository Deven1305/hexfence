import type { CheckRow, Level } from "./index.js";

/** HexFence recipient verdicts (GREEN/RED/AMBER/GREY) as a `recipient` or `action` row. */
export type HexFenceVerdict = "GREEN" | "RED" | "AMBER" | "GREY";

const levelOf: Record<HexFenceVerdict, Level> = { GREEN: "green", RED: "red", AMBER: "amber", GREY: "grey" };

export function recipientRow(verdict: HexFenceVerdict, code: string, params: Record<string, string> = {}, evidence?: string[]): CheckRow {
  return { kind: verdict === "GREY" ? "action" : "recipient", level: levelOf[verdict], code, params, ...(evidence ? { evidence } : {}) };
}

/** Pramaan severities: info/low -> green, medium -> amber, high/critical -> red. */
export type PramaanSeverity = "info" | "low" | "medium" | "high" | "critical";

export function actionRow(sev: PramaanSeverity, code: string, params: Record<string, string> = {}): CheckRow {
  const level: Level = sev === "info" || sev === "low" ? "green" : sev === "medium" ? "amber" : "red";
  return { kind: "action", level, code, params };
}

/** Pramaan signed-release status -> `app` row. Unknown statuses are grey, never green. */
const releaseLevel: Record<string, Level> = { verified: "green", missing: "grey", unverifiable: "grey", mismatch: "red", "invalid-signature": "red", revoked: "red" };

export function releaseRow(status: string, origin: string, ens = ""): CheckRow {
  return { kind: "app", level: releaseLevel[status] ?? "grey", code: `RELEASE_${status.toUpperCase().replace(/-/g, "_")}`, params: { origin, ens } };
}

/** Pramaan served-file check (severity green/amber/red) -> `app` row. */
export function siteFilesRow(status: string, severity: "green" | "amber" | "red", summary: string): CheckRow {
  return { kind: "app", level: severity, code: `SITE_FILES_${status.toUpperCase().replace(/-/g, "_")}`, params: { summary } };
}

/** Contracts listed by a release vs what is deployed -> one `contract` row. Nothing checked is grey. */
export function contractsRow(checked: number, worst: Level, notes: string[]): CheckRow {
  return {
    kind: "contract",
    level: checked === 0 ? "grey" : worst,
    code: checked === 0 ? "NO_CONTRACTS_ON_THIS_CHAIN" : worst === "green" ? "CONTRACTS_MATCH_RELEASE" : "CONTRACT_NOT_AS_RELEASED",
    params: { checked: String(checked), notes: notes.join("; ") },
  };
}
