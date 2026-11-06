import { createPublicClient, type PublicArkivClient } from "@arkiv-network/sdk";
import { rabdi } from "@arkiv-network/sdk/chains";
import { asc, eq, gt, or } from "@arkiv-network/sdk/query";
import { addr, key } from "@arkiv-network/sdk/schema";
import { PoisoningEvidenceSchema, type PoisoningEvidence } from "@hexfence/shared";
import { http, type Address, type Hex } from "viem";
import { fromArkivRow } from "./codec.js";
import { PoisoningSchema } from "./schema.js";

/** The Arkiv SDK's page cap (MAX_LIMIT in @arkiv-network/sdk 1.0.1). */
export const PAGE_SIZE = 100;

export type ArkivReadClient = PublicArkivClient;

/**
 * Read-only client for the Rabdi testnet (chain 7794095). `accessKey` is optional: without one the
 * SDK uses the public endpoint, which is heavily rate limited.
 */
export function arkivReadClient(opts?: { accessKey?: string }): ArkivReadClient {
  return createPublicClient({
    chain: rabdi({ accessKey: opts?.accessKey ?? "" }),
    // The page retry below owns the budget; avoid multiplying it by viem retries.
    transport: http(undefined, { retryCount: 0, timeout: 10_000 }),
  });
}

/**
 * Bulk read of every record by one publisher (all pages). Used by the explorer and by Pay (T10),
 * so a client never sends a per-recipient lookup. Rows that fail validation are dropped.
 */
export function fetchAllEvidence(client: ArkivReadClient, publisher: Address): Promise<PoisoningEvidence[]> {
  return fetchAllEvidenceWithReadTime(client, publisher).then((read) => read.evidence);
}

/** Cache lifetime in milliseconds; expiration never extends on a cache hit. */
export const EVIDENCE_CACHE_TTL_MS = 5 * 60_000;

export interface EvidenceRead {
  evidence: PoisoningEvidence[];
  /** Unix milliseconds when the bulk read completed, preserved on cache hits.
   * Pages can span different blocks; this is not a chain snapshot time. */
  readAt: number;
}

const inProgress = new Map<string, Promise<EvidenceRead>>();

/** Bulk read with completion time. Browsers share pending reads for the same chain/publisher
 * and reuse validated sessionStorage data across same-origin navigations.
 * Node does not use browser storage or retain completed reads. */
export function fetchAllEvidenceWithReadTime(client: ArkivReadClient, publisher: Address): Promise<EvidenceRead> {
  const browser = typeof window !== "undefined";
  // sessionStorage already isolates origins. Publisher and chain isolate evidence sources.
  const cacheKey = "hexfence:evidence:v1:" + (client.chain?.id ?? client.uid) + ":" + publisher.toLowerCase();
  if (browser) {
    const pending = inProgress.get(cacheKey);
    if (pending) return pending;
    const cached = readCache(cacheKey);
    if (cached) return Promise.resolve(cached);
  }
  const pending = fetchPaged(client, publisher, (q) => q).then((evidence) => {
    const result = { evidence, readAt: Date.now() };
    if (browser) {
      try { window.sessionStorage.setItem(cacheKey, JSON.stringify(result)); } catch { /* Storage is optional. */ }
    }
    return result;
  });
  if (!browser) return pending;
  inProgress.set(cacheKey, pending);
  // Both handlers prevent cleanup from creating an unhandled rejected promise.
  void pending.then(() => inProgress.delete(cacheKey), () => inProgress.delete(cacheKey));
  return pending;
}

function readCache(cacheKey: string): EvidenceRead | undefined {
  try {
    const raw = window.sessionStorage.getItem(cacheKey);
    if (raw === null) return undefined;
    const data: unknown = JSON.parse(raw);
    if (typeof data === "object" && data !== null && "readAt" in data && "evidence" in data &&
        typeof data.readAt === "number" && Number.isSafeInteger(data.readAt) && data.readAt > 0 &&
        data.readAt <= Date.now() && Date.now() - data.readAt < EVIDENCE_CACHE_TTL_MS) {
      const parsed = PoisoningEvidenceSchema.array().safeParse(data.evidence);
      if (parsed.success) return { evidence: parsed.data, readAt: data.readAt };
    }
  } catch { /* Blocked storage, invalid JSON, or bad records cannot prevent a live read. */ }
  try { window.sessionStorage.removeItem(cacheKey); } catch { /* Storage is optional. */ }
  return undefined;
}

/** Only transport failures are retried. Arkiv query/schema errors fail immediately. */
function isTransient(error: unknown): boolean {
  let current = error;
  for (let depth = 0; current && typeof current === "object" && depth < 8; depth++) {
    const link = current as { status?: number; code?: string | number; name?: string; message?: string; cause?: unknown };
    if (link.status !== undefined) return [408, 429, 500, 502, 503, 504].includes(link.status);
    // Arkiv -32001..-32004 describe invalid queries, not rate limits.
    if (typeof link.code === "number" && [-32700, -32600, -32601, -32602, -32001, -32002, -32003, -32004].includes(link.code)) return false;
    if (link.code === -32005 || link.code === 429) return true;
    if (typeof link.code === "string" && ["ETIMEDOUT", "ECONNRESET", "ECONNREFUSED", "EAI_AGAIN", "UND_ERR_CONNECT_TIMEOUT", "UND_ERR_SOCKET"].includes(link.code)) return true;
    if (link.name === "TimeoutError" || (link.name === "TypeError" && /^(fetch failed|failed to fetch|networkerror when attempting to fetch resource\.?|load failed)$/i.test(link.message ?? ""))) return true;
    current = link.cause;
  }
  return false;
}

/** Seconds from a Retry-After header in seconds form, anywhere in the error chain. */
function retryAfterSeconds(error: unknown): number | undefined {
  let current = error;
  for (let depth = 0; current && typeof current === "object" && depth < 8; depth++) {
    const link = current as { headers?: { get?: (name: string) => string | null }; cause?: unknown };
    const value = link.headers?.get?.("retry-after");
    if (value && /^\d+$/.test(value.trim())) return Number(value);
    current = link.cause;
  }
  return undefined;
}

function httpStatus(error: unknown): number | undefined {
  let current = error;
  for (let depth = 0; current && typeof current === "object" && depth < 8; depth++) {
    const link = current as { status?: number; cause?: unknown };
    if (link.status !== undefined) return link.status;
    current = link.cause;
  }
  return undefined;
}

/** A person will not wait longer than this on an open page; longer limits fail straight away. */
const MAX_RETRY_AFTER_SECONDS = 20;

async function retryPage<T>(fetch: () => Promise<T>): Promise<T> {
  // Six attempts outside a browser: at most 46.5 seconds of backoff per page, plus transport timeouts.
  // A person is looking at a browser page, so three attempts there, then the caller's fallback.
  const browser = typeof window !== "undefined";
  for (let attempt = 0; ; attempt++) {
    try { return await fetch(); } catch (error) {
      if (attempt >= (browser ? 2 : 5) || !isTransient(error)) throw error;
      const retryAfter = retryAfterSeconds(error);
      // CORS hides Retry-After from page scripts unless exposed; the measured budget refill is minutes.
      if (browser && retryAfter === undefined && httpStatus(error) === 429) throw error;
      if (retryAfter !== undefined && retryAfter > MAX_RETRY_AFTER_SECONDS) throw error;
      const delay = retryAfter !== undefined
        ? retryAfter * 1_000
        : Math.min(16_000, 1_000 * 2 ** attempt) * (0.5 + Math.random());
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

/**
 * Explorer search only (never used by Pay): records whose lookalike, impersonated or victim equals
 * `address`. All three columns are indexed, so the node does the filtering.
 */
export function findEvidenceByAddress(
  client: ArkivReadClient,
  publisher: Address,
  address: Address,
): Promise<PoisoningEvidence[]> {
  const a = addr(address);
  return fetchPaged(client, publisher, (q) => q.where(or(eq("lookalike", a), eq("impersonated", a), eq("victim", a))));
}

/** Every record by `publisher`, sorted by key. A row that doesn't fit the schema fails the read:
 *  only our own publisher's rows match, and a skipped row would leave a page with no key to continue from. */
function baseQuery(client: ArkivReadClient, publisher: Address) {
  return client
    .select()
    .from(PoisoningSchema, { onMismatch: "throw" })
    .createdBy(publisher)
    .orderBy(asc("$key"))
    .limit(PAGE_SIZE);
}
type Query = ReturnType<typeof baseQuery>;

/**
 * Pages by entity key (`asc("$key")` + `gt("$key", last)`), as the SDK docs advise, so every match
 * is read exactly once even while the detector is writing. Offset paging could repeat or skip rows.
 */
async function fetchPaged(
  client: ArkivReadClient,
  publisher: Address,
  narrow: (q: Query) => Query,
): Promise<PoisoningEvidence[]> {
  const out: PoisoningEvidence[] = [];
  const seen = new Set<Hex>();
  let last: Hex | undefined;
  for (;;) {
    let q = narrow(baseQuery(client, publisher));
    if (last) q = q.where(gt("$key", key(last)));
    const page = await retryPage(() => q.fetch());

    for (const row of page.entities) {
      const e = fromArkivRow(row as unknown as Record<string, unknown>);
      // One record per evidenceId: the writer is idempotent, but anyone could re-post a copy.
      if (e && !seen.has(e.evidenceId)) {
        seen.add(e.evidenceId);
        out.push(e);
      }
    }
    const tail = page.entities.at(-1);
    if (page.entities.length < PAGE_SIZE || !tail) return out;
    last = tail.$key as Hex;
  }
}
