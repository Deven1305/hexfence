import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PoisoningEvidenceSchema } from "@hexfence/shared";
import { lossFixture } from "../../shared/test/fixtures/loss.js";
import fixture from "../../../apps/explorer/test/fixtures/receipts.json";
import { evidenceWithSavedCopy, loadSavedRecords, parseSavedRecords, publishedRecordsWithSavedCopy } from "../src/saved.js";
import { fetchAllEvidenceWithReadTime, type ArkivReadClient } from "../src/read.js";
import { fetchAllLosses } from "../src/loss.js";
vi.mock("../src/read.js", () => ({ fetchAllEvidenceWithReadTime: vi.fn() }));
vi.mock("../src/loss.js", () => ({ fetchAllLosses: vi.fn() }));
const publisher = "0x36141ba063390f0d91Af7a5a9dF8dc1d80D699ec";
const record = PoisoningEvidenceSchema.parse(fixture.zeroValue.evidence);
const saved = { publisher, readAt: 1_700_000_000_000, evidence: [record], losses: [lossFixture()] };
const client = {} as ArkivReadClient;
const fetch = vi.fn();
beforeEach(() => { vi.resetAllMocks(); vi.stubGlobal("fetch", fetch); });
afterEach(() => vi.unstubAllGlobals());
const copy = (value: unknown = saved) => fetch.mockResolvedValue(new Response(JSON.stringify(value)));

describe("saved Arkiv records", () => {
  it("loads a publisher case-insensitively and preserves uint256 decimal strings", async () => {
    const loss = { ...lossFixture(), amount: (2n ** 255n).toString() };
    copy({ ...saved, publisher: publisher.toLowerCase(), losses: [loss] });
    const result = await loadSavedRecords("/copy.json", publisher);
    expect(result?.evidence).toEqual([record]);
    expect(result?.losses[0]?.amount).toBe(loss.amount);
    expect(result?.readAt).toBe(saved.readAt);
  });
  it.each([null, {}, { ...saved, publisher: "0x1111111111111111111111111111111111111111" },
    { ...saved, evidence: [{ ...record, status: "other" }] }, { ...saved, losses: [{}] },
    { ...saved, readAt: "yesterday" }, { ...saved, readAt: Date.now() + 86_400_000 }])("rejects an invalid envelope or row", async value => {
    copy(value); expect(await loadSavedRecords("/copy.json", publisher)).toBeUndefined();
  });
  it("returns undefined for malformed JSON, HTTP failures and network failures", async () => {
    fetch.mockResolvedValueOnce(new Response("{"));
    expect(await loadSavedRecords("/copy.json", publisher)).toBeUndefined();
    fetch.mockResolvedValueOnce(new Response("missing", { status: 404 }));
    expect(await loadSavedRecords("/copy.json", publisher)).toBeUndefined();
    fetch.mockRejectedValueOnce(new Error("offline"));
    expect(await loadSavedRecords("/copy.json", publisher)).toBeUndefined();
  });
  it("uses even an empty successful live read without fetching a copy", async () => {
    vi.mocked(fetchAllEvidenceWithReadTime).mockResolvedValue({ evidence: [], readAt: 123 });
    expect(await evidenceWithSavedCopy(client, publisher, "/copy.json")).toEqual({ evidence: [], readAt: 123, source: "live" });
    expect(fetch).not.toHaveBeenCalled();
  });
  it("fetches the copy only after rejection and preserves its timestamp", async () => {
    const order: string[] = [];
    vi.mocked(fetchAllEvidenceWithReadTime).mockImplementation(async () => { order.push("live"); throw new Error("limited"); });
    fetch.mockImplementation(async () => { order.push("saved"); return new Response(JSON.stringify(saved)); });
    expect(await evidenceWithSavedCopy(client, publisher, "/copy.json")).toEqual({ evidence: [record], readAt: saved.readAt, source: "saved" });
    expect(order).toEqual(["live", "saved"]);
  });
  it("rethrows the original live error if no valid copy exists", async () => {
    const error = new Error("limited"); vi.mocked(fetchAllEvidenceWithReadTime).mockRejectedValue(error); copy({});
    await expect(evidenceWithSavedCopy(client, publisher, "/copy.json")).rejects.toBe(error);
  });
  it("uses live evidence and losses without fetching a copy", async () => {
    vi.mocked(fetchAllEvidenceWithReadTime).mockResolvedValue({ evidence: [], readAt: 123 });
    vi.mocked(fetchAllLosses).mockResolvedValue([]);
    expect(await publishedRecordsWithSavedCopy(client, publisher, "/copy.json")).toEqual({ evidence: [], losses: [], readAt: 123, source: "live" });
    expect(fetch).not.toHaveBeenCalled();
  });
  it("switches both datasets when losses fail; never merges live and saved", async () => {
    vi.mocked(fetchAllEvidenceWithReadTime).mockResolvedValue({ evidence: [], readAt: 123 });
    vi.mocked(fetchAllLosses).mockRejectedValue(new Error("limited")); copy();
    expect(await publishedRecordsWithSavedCopy(client, publisher, "/copy.json")).toEqual({ evidence: saved.evidence, losses: saved.losses, readAt: saved.readAt, source: "saved" });
  });
  it("does not read losses after evidence rejects", async () => {
    vi.mocked(fetchAllEvidenceWithReadTime).mockRejectedValue(new Error("limited")); copy();
    await publishedRecordsWithSavedCopy(client, publisher, "/copy.json");
    expect(fetchAllLosses).not.toHaveBeenCalled();
    expect(parseSavedRecords(saved, publisher)).toEqual(saved);
  });
});
