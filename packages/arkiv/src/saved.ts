import { PoisoningEvidenceSchema, SuspectedLossSchema, type SuspectedLoss } from "@hexfence/shared";
import { isAddress, type Address } from "viem";
import { fetchAllEvidenceWithReadTime, type ArkivReadClient, type EvidenceRead } from "./read.js";
import { fetchAllLosses } from "./loss.js";

export interface PublishedRecords extends EvidenceRead { losses: SuspectedLoss[] }
export interface SavedRecords extends PublishedRecords { publisher: Address }
export type ReadSource = "live" | "saved";

/** Validate every row; a damaged copy must never silently become an empty/partial result. */
export function parseSavedRecords(value: unknown, publisher: Address): SavedRecords | undefined {
  if (!value || typeof value !== "object") return undefined;
  const data = value as Record<string, unknown>;
  if (typeof data.publisher !== "string" || !isAddress(data.publisher, { strict: false }) ||
      data.publisher.toLowerCase() !== publisher.toLowerCase() ||
      typeof data.readAt !== "number" || !Number.isSafeInteger(data.readAt) || data.readAt <= 0 || data.readAt > Date.now()) return undefined;
  const evidence = PoisoningEvidenceSchema.array().safeParse(data.evidence);
  const losses = SuspectedLossSchema.array().safeParse(data.losses);
  if (!evidence.success || !losses.success) return undefined;
  return { publisher: data.publisher as Address, readAt: data.readAt, evidence: evidence.data, losses: losses.data };
}

export async function loadSavedRecords(url: string, publisher: Address): Promise<SavedRecords | undefined> {
  try {
    const response = await fetch(url);
    if (!response.ok) return undefined;
    return parseSavedRecords(await response.json(), publisher);
  } catch { return undefined; }
}

/** The copy is fetched only after rejection, including when a successful live read is empty. */
export async function evidenceWithSavedCopy(
  client: ArkivReadClient, publisher: Address, url: string,
): Promise<EvidenceRead & { source: ReadSource }> {
  try { return { ...await fetchAllEvidenceWithReadTime(client, publisher), source: "live" }; }
  catch (error) {
    const saved = await loadSavedRecords(url, publisher);
    if (!saved) throw error;
    return { evidence: saved.evidence, readAt: saved.readAt, source: "saved" };
  }
}

/** Evidence and losses switch together; never combine live rows with saved rows. */
export async function publishedRecordsWithSavedCopy(
  client: ArkivReadClient, publisher: Address, url: string,
): Promise<PublishedRecords & { source: ReadSource }> {
  try {
    const read = await fetchPublishedRecords(client, publisher);
    return { ...read, source: "live" };
  } catch (error) {
    const saved = await loadSavedRecords(url, publisher);
    if (!saved) throw error;
    return { evidence: saved.evidence, losses: saved.losses, readAt: saved.readAt, source: "saved" };
  }
}

export async function fetchPublishedRecords(client: ArkivReadClient, publisher: Address): Promise<PublishedRecords> {
  const read = await fetchAllEvidenceWithReadTime(client, publisher);
  const losses = await fetchAllLosses(client, publisher);
  return { ...read, losses };
}

export function savedCopyNotice(readAt: number): string {
  return `The live Arkiv read failed, so these numbers come from a copy read from Arkiv at ${new Date(readAt).toISOString().replace("T", " ").replace("Z", " UTC")}.`;
}
