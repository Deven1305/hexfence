import { addr, dec } from "@arkiv-network/sdk/schema";
import { PoisoningEvidenceSchema, type PoisoningEvidence } from "@hexfence/shared";

/** The typed column values `createEntity(PoisoningSchema, …)` takes for one record. */
export function toArkivValues(e: PoisoningEvidence) {
  return {
    evidenceId: e.evidenceId,
    chainId: dec(e.chainId),
    lookalike: addr(e.lookalike),
    impersonated: addr(e.impersonated),
    victim: addr(e.victim),
    variant: e.variant,
    attackBlock: dec(e.attackBlock),
    detectorVersion: e.detectorVersion,
    token: addr(e.token),
    attackTx: e.attackTx,
    referenceTx: e.referenceTx,
    referenceBlock: dec(e.referenceBlock),
    prefixLen: dec(e.prefixLen),
    suffixLen: dec(e.suffixLen),
    status: e.status,
  };
}

const COLUMNS = [
  "evidenceId",
  "chainId",
  "lookalike",
  "impersonated",
  "victim",
  "variant",
  "attackBlock",
  "detectorVersion",
  "token",
  "attackTx",
  "referenceTx",
  "referenceBlock",
  "prefixLen",
  "suffixLen",
  "status",
] as const;
const NUMERIC = new Set<string>(["chainId", "attackBlock", "referenceBlock", "prefixLen", "suffixLen"]);

/**
 * A fetched Arkiv row (each column is `{ type, value }`) back to a validated record, or null.
 * Anyone can write entities with our schema tag, so every row goes through PoisoningEvidenceSchema
 * (fingerprint match, evidenceId, status "suspected", …) before anything shows it.
 */
export function fromArkivRow(row: Record<string, unknown>): PoisoningEvidence | null {
  const plain: Record<string, unknown> = {};
  for (const c of COLUMNS) {
    const cell = row[c];
    const v = typeof cell === "object" && cell !== null && "value" in cell ? (cell as { value: unknown }).value : cell;
    plain[c] = NUMERIC.has(c) && (typeof v === "string" || typeof v === "bigint") ? Number(v) : v;
  }
  const parsed = PoisoningEvidenceSchema.safeParse(plain);
  return parsed.success ? parsed.data : null;
}
