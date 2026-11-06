import { createPublicClient } from "@arkiv-network/sdk";
import { rabdi } from "@arkiv-network/sdk/chains";
import { PoisoningEvidenceSchema } from "@hexfence/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { http, type Hex } from "viem";
import { toArkivValues } from "../src/codec.js";
import {
  EVIDENCE_CACHE_TTL_MS, PAGE_SIZE, fetchAllEvidence, fetchAllEvidenceWithReadTime,
} from "../src/read.js";
import saved from "../../../apps/explorer/test/fixtures/receipts.json";

const record = PoisoningEvidenceSchema.parse(saved.zeroValue.evidence);
const publisher = "0x36141ba063390f0d91Af7a5a9dF8dc1d80D699ec";
const key = (n: number): Hex => `0x${n.toString(16).padStart(64, "0")}`;
const row = (n: number) => ({
  key: key(n),
  attributes: [
    { name: "arkiv.schema", type: "str", value: "hexfence.poisoning.v1" },
    ...Object.entries(toArkivValues(record)).map(([name, cell]) => ({
      name, ...(typeof cell === "string" ? { type: "str", value: cell } : cell),
    })),
  ],
});
const page = (rows = [row(1)]) => ({ data: rows, blockNumber: "0x1" });
function transport(responses: Array<{ status?: number; body: unknown; retryAfter?: string } | Error>) {
  const queries: string[] = [];
  const fetch = vi.fn(async (_url: unknown, init?: RequestInit) => {
    queries.push((JSON.parse(String(init?.body)) as { params: [string] }).params[0]);
    const response = responses.shift();
    if (!response) throw new Error("Unexpected request");
    if (response instanceof Error) throw response;
    return new Response(JSON.stringify(response.status
      ? response.body : { jsonrpc: "2.0", id: 1, result: response.body }),
      { status: response.status ?? 200, headers: { "Content-Type": "application/json", ...(response.retryAfter ? { "Retry-After": response.retryAfter } : {}) } });
  });
  const client = createPublicClient({
    chain: rabdi({ accessKey: "" }),
    transport: http("https://arkiv.invalid", { retryCount: 0, fetchFn: fetch }),
  });
  return { client, fetch, queries };
}
function browser() {
  const data = new Map<string, string>();
  vi.stubGlobal("window", { sessionStorage: {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => { data.set(k, v); },
    removeItem: (k: string) => { data.delete(k); },
  } });
  return data;
}
const limited = { status: 429, body: {
  error: "ANON_COST_LIMITED",
  message: "unauthenticated query budget exhausted; get an API key at https://hub.arkiv.network for a monthly quota",
} };

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-11-06T12:00:00Z")); });
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("bulk read transport retries", () => {
  it("retries HTTP 429 then succeeds", async () => {
    const t = transport([limited, { body: page() }]);
    const result = fetchAllEvidence(t.client, publisher);
    await vi.runAllTimersAsync();
    expect(await result).toEqual([record]);
    expect(t.fetch).toHaveBeenCalledTimes(2);
    expect(t.queries[1]).toBe(t.queries[0]);
  });

  it("resumes the failed page, keeps prior rows, and deduplicates evidence", async () => {
    const t = transport([
      { body: page(Array.from({ length: PAGE_SIZE }, (_, n) => row(n + 1))) },
      limited, { body: page([row(101)]) },
    ]);
    const result = fetchAllEvidence(t.client, publisher);
    await vi.runAllTimersAsync();
    expect(await result).toEqual([record]);
    expect(t.fetch).toHaveBeenCalledTimes(3);
    expect(t.queries[1]).toContain(key(100));
    expect(t.queries[2]).toBe(t.queries[1]);
    expect(t.queries.every((q) => !q.includes("lookalike ="))).toBe(true);
  });

  it("gives up after six attempts and releases a failed in-progress read", async () => {
    browser();
    const t = transport([...Array.from({ length: 6 }, () => limited), { body: page() }]);
    const result = expect(fetchAllEvidence(t.client, publisher)).rejects.toMatchObject({ status: 429 });
    await vi.runAllTimersAsync();
    await result;
    expect(t.fetch).toHaveBeenCalledTimes(6);
    expect(await fetchAllEvidence(t.client, publisher)).toEqual([record]);
  });

  it.each([408, 500, 502, 503, 504])("retries transient HTTP %s", async (status) => {
    const t = transport([{ status, body: {} }, { body: page() }]);
    const result = fetchAllEvidence(t.client, publisher);
    await vi.runAllTimersAsync();
    expect(await result).toEqual([record]);
  });

  it("fails at once when Retry-After is longer than a person will wait", async () => {
    const { client, fetch } = transport([{ ...limited, retryAfter: "801" }]);
    await expect(fetchAllEvidence(client, publisher)).rejects.toThrow();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("waits a short Retry-After, then succeeds", async () => {
    const { client, fetch } = transport([{ ...limited, retryAfter: "3" }, { body: page([]) }]);
    const read = fetchAllEvidence(client, publisher);
    await vi.advanceTimersByTimeAsync(2_999);
    expect(fetch).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    await expect(read).resolves.toEqual([]);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("retries a network failure", async () => {
    const t = transport([new TypeError("Failed to fetch"), { body: page() }]);
    const result = fetchAllEvidence(t.client, publisher);
    await vi.runAllTimersAsync();
    expect(await result).toEqual([record]);
  });

  it.each([400, 401, 403, 404])("does not retry permanent HTTP %s", async (status) => {
    const t = transport([{ status, body: {} }]);
    await expect(fetchAllEvidence(t.client, publisher)).rejects.toMatchObject({ status });
    expect(t.fetch).toHaveBeenCalledTimes(1);
  });

  it("does not retry Arkiv query validation failures", async () => {
    const t = transport([{ status: 200, body: {
      jsonrpc: "2.0", id: 1, error: { code: -32004, message: "query limit exceeded" },
    } }]);
    await expect(fetchAllEvidence(t.client, publisher)).rejects.toMatchObject({ code: -32004 });
    expect(t.fetch).toHaveBeenCalledTimes(1);
  });

  it("does not retry schema mismatches", async () => {
    const t = transport([{ body: page([{ key: key(1), attributes: [] }]) }]);
    await expect(fetchAllEvidence(t.client, publisher)).rejects.toThrow();
    expect(t.fetch).toHaveBeenCalledTimes(1);
  });
});

describe("browser bulk read reuse", () => {
  it("shares one pending read across callers and clients", async () => {
    browser();
    const a = transport([limited, { body: page() }]);
    const b = transport([]);
    const first = fetchAllEvidenceWithReadTime(a.client, publisher);
    const second = fetchAllEvidenceWithReadTime(b.client, publisher);
    expect(second).toBe(first);
    await vi.runAllTimersAsync();
    expect(await second).toEqual(await first);
    expect((await first).readAt).toBe(Date.now());
    expect(b.fetch).not.toHaveBeenCalled();
  });

  it("reuses a completed read across module reloads and preserves its completion time", async () => {
    const storage = browser();
    const a = transport([{ body: page() }]);
    const initial = await fetchAllEvidenceWithReadTime(a.client, publisher);
    expect(storage.size).toBe(1);
    vi.setSystemTime(Date.now() + 60_000);
    vi.resetModules();
    const reloaded = await import("../src/read.js");
    const b = transport([]);
    expect(await reloaded.fetchAllEvidenceWithReadTime(b.client, publisher)).toEqual(initial);
    expect(b.fetch).not.toHaveBeenCalled();
  });

  it("expires exactly at five minutes and replaces the timestamp", async () => {
    browser();
    const t = transport([{ body: page() }, { body: page() }]);
    const first = await fetchAllEvidenceWithReadTime(t.client, publisher);
    vi.setSystemTime(first.readAt + EVIDENCE_CACHE_TTL_MS);
    const next = await fetchAllEvidenceWithReadTime(t.client, publisher);
    expect(next.readAt).toBe(first.readAt + EVIDENCE_CACHE_TTL_MS);
    expect(t.fetch).toHaveBeenCalledTimes(2);
  });

  it.each(["junk", JSON.stringify({ readAt: 42, evidence: [] })])("discards corrupt or expired cache: %s", async (raw) => {
    const storage = browser();
    const t = transport([{ body: page() }, { body: page() }]);
    await fetchAllEvidence(t.client, publisher);
    storage.set([...storage.keys()][0]!, raw);
    expect(await fetchAllEvidence(t.client, publisher)).toEqual([record]);
    expect(t.fetch).toHaveBeenCalledTimes(2);
  });

  it.each(["schema", "future", "missing"])("discards invalid %s cache", async (kind) => {
    const storage = browser();
    const t = transport([{ body: page() }, { body: page() }]);
    await fetchAllEvidence(t.client, publisher);
    const data = kind === "schema"
      ? { readAt: Date.now(), evidence: [{ ...record, status: "invalid" }] }
      : kind === "future" ? { readAt: Date.now() + 1, evidence: [] } : { evidence: [] };
    storage.set([...storage.keys()][0]!, JSON.stringify(data));
    expect(await fetchAllEvidence(t.client, publisher)).toEqual([record]);
    expect(t.fetch).toHaveBeenCalledTimes(2);
  });

  it("isolates publishers and chains", async () => {
    browser();
    const t = transport([{ body: page() }, { body: page() }, { body: page() }]);
    await fetchAllEvidence(t.client, publisher);
    await fetchAllEvidence(t.client, "0x0000000000000000000000000000000000000001");
    await fetchAllEvidence({ ...t.client, chain: { ...t.client.chain!, id: 1 } }, publisher);
    expect(t.fetch).toHaveBeenCalledTimes(3);
  });

  it("works when sessionStorage is blocked", async () => {
    vi.stubGlobal("window", { get sessionStorage() { throw new Error("blocked"); } });
    const t = transport([{ body: page() }]);
    expect(await fetchAllEvidence(t.client, publisher)).toEqual([record]);
  });

  it("survives sessionStorage quota errors", async () => {
    vi.stubGlobal("window", { sessionStorage: {
      getItem: () => null,
      setItem: () => { throw new Error("quota"); },
      removeItem: () => {},
    } });
    const t = transport([{ body: page() }]);
    expect(await fetchAllEvidence(t.client, publisher)).toEqual([record]);
  });

  it("works in Node without window or sessionStorage, without retaining completed reads", async () => {
    vi.stubGlobal("window", undefined);
    const t = transport([{ body: page() }, { body: page() }]);
    expect(await fetchAllEvidence(t.client, publisher)).toEqual([record]);
    expect(await fetchAllEvidence(t.client, publisher)).toEqual([record]);
    expect(t.fetch).toHaveBeenCalledTimes(2);
  });
});
