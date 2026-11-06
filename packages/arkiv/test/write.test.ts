import { PoisoningEvidenceSchema } from "@hexfence/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { publishEvidence } from "../src/write.js";
import type { ArkivReadClient } from "../src/read.js";
import saved from "../../../apps/explorer/test/fixtures/receipts.json";

const mock = vi.hoisted(() => ({ executeBatch: vi.fn(), fetchAllEvidence: vi.fn(), getBalance: vi.fn() }));
vi.mock("@arkiv-network/sdk", async (original) => ({
  ...await original<typeof import("@arkiv-network/sdk")>(),
  createWalletClient: () => ({ executeBatch: mock.executeBatch }),
}));
vi.mock("../src/read.js", async (original) => ({
  ...await original<typeof import("../src/read.js")>(),
  fetchAllEvidence: mock.fetchAllEvidence,
}));

const zero = PoisoningEvidenceSchema.parse(saved.zeroValue.evidence);
const dust = PoisoningEvidenceSchema.parse(saved.dust.evidence);
// Public test vector only; no funded account and all wallet operations are mocked.
const opts = { privateKey: `0x${"01".repeat(32)}` as const, batchSize: 1, maxRecords: 1, budget: { perRecord: 10n, reserve: 5n } };
const reader = { getBalance: mock.getBalance } as unknown as ArkivReadClient;

beforeEach(() => {
  vi.resetAllMocks();
  mock.fetchAllEvidence.mockResolvedValue([]);
  mock.getBalance.mockResolvedValue(100n);
  mock.executeBatch.mockResolvedValue({ txHash: `0x${"ab".repeat(32)}` });
});

describe("bounded publication", () => {
  it("applies the cap after existing-record and input deduplication", async () => {
    mock.fetchAllEvidence.mockResolvedValue([zero]);
    const report = await publishEvidence(opts, [zero, zero, dust], reader);
    expect(report.created).toBe(1);
    expect(report.alreadyThere).toBe(2);
    expect(mock.executeBatch).toHaveBeenCalledTimes(1);
    expect(mock.executeBatch.mock.calls[0]?.[0].creates[0].values.evidenceId).toBe(dust.evidenceId);
  });

  it("never writes more new records than the cap", async () => {
    expect((await publishEvidence(opts, [zero, dust], reader)).created).toBe(1);
    expect(mock.executeBatch).toHaveBeenCalledTimes(1);
  });

  it("stops before writing when balance is below the allowance", async () => {
    mock.getBalance.mockResolvedValue(14n);
    expect(await publishEvidence(opts, [zero], reader)).toMatchObject({ created: 0, stoppedForFunds: true });
    expect(mock.executeBatch).not.toHaveBeenCalled();
  });

  it("rechecks balance between batches and reports only completed writes", async () => {
    mock.getBalance.mockResolvedValueOnce(100n).mockResolvedValueOnce(0n);
    const report = await publishEvidence({ ...opts, maxRecords: 2 }, [zero, dust], reader);
    expect(report).toMatchObject({ created: 1, stoppedForFunds: true });
    expect(report.txHashes).toHaveLength(1);
  });

  it("handles a funding refusal cleanly but propagates ambiguous errors without retry", async () => {
    mock.executeBatch.mockRejectedValueOnce(new Error("insufficient funds for gas"));
    expect(await publishEvidence(opts, [zero], reader)).toMatchObject({ created: 0, stoppedForFunds: true });
    mock.executeBatch.mockRejectedValueOnce(new Error("timeout"));
    await expect(publishEvidence(opts, [zero], reader)).rejects.toThrow("timeout");
    expect(mock.executeBatch).toHaveBeenCalledTimes(2);
  });

  it("recognizes the Rabdi total-cost funding refusal", async () => {
    mock.executeBatch.mockRejectedValueOnce(new Error("total cost of transaction exceeds the balance"));
    expect(await publishEvidence(opts, [zero], reader)).toMatchObject({ created: 0, stoppedForFunds: true });
  });

  it("writes nothing on a repeat run", async () => {
    mock.fetchAllEvidence.mockResolvedValue([zero, dust]);
    expect(await publishEvidence(opts, [zero, dust], reader)).toMatchObject({ created: 0, alreadyThere: 2 });
    expect(mock.executeBatch).not.toHaveBeenCalled();
  });

  it("rejects invalid limits and batches before any RPC or write", async () => {
    await expect(publishEvidence({ ...opts, maxRecords: 0 }, [zero], reader)).rejects.toThrow("maxRecords");
    await expect(publishEvidence({ ...opts, batchSize: 0 }, [zero], reader)).rejects.toThrow("batchSize");
    expect(mock.fetchAllEvidence).not.toHaveBeenCalled();
    expect(mock.executeBatch).not.toHaveBeenCalled();
  });
});
