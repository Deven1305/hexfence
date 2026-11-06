import { describe, expect, it, vi, beforeEach } from "vitest";
import { lossFixture } from "../../shared/test/fixtures/loss.js";
import { LossSchema, lossValues, lossFromRow, publishLosses } from "../src/loss.js";
import type { ArkivReadClient } from "../src/read.js";
const mock = vi.hoisted(() => ({ executeBatch: vi.fn() }));
vi.mock("@arkiv-network/sdk", async original => ({ ...await original<typeof import("@arkiv-network/sdk")>(), createWalletClient: () => ({ executeBatch: mock.executeBatch }) }));
const e = lossFixture();
vi.mock("viem/accounts", () => ({ privateKeyToAccount: () => ({ address: "0x1111111111111111111111111111111111111111" }) }));
const opts = { privateKey: "0x" as const }; // Invalid placeholder; account creation is mocked, no key is used.
function reader(rows: unknown[] = [], balance = 10n ** 18n): ArkivReadClient {
  const query = { from: vi.fn().mockReturnThis(), createdBy: vi.fn().mockReturnThis(), orderBy: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), fetch: vi.fn().mockResolvedValue({ entities: rows }) };
  return { select: () => query, getBalance: vi.fn().mockResolvedValue(balance) } as unknown as ArkivReadClient;
}
beforeEach(() => { mock.executeBatch.mockReset(); mock.executeBatch.mockResolvedValue({ txHash: `0x${"aa".repeat(32)}` }); });
describe("loss schema and publisher", () => {
  it("refuses unclassified raw patterns before any write", async () => {
    await expect(publishLosses(opts, [{ ...e, origin: "unclassified" }], reader())).rejects.toThrow("unclassified");
    expect(mock.executeBatch).not.toHaveBeenCalled();
  });
  it("roundtrips typed context and rejects conflicting indexed facts", () => {
    const row = lossValues(e); expect(lossFromRow(row)).toEqual(e);
    expect(() => lossFromRow({ ...row, amount: "1" })).toThrow("disagree");
  });
  it("uses 90-day expiry, correct schema and one create for repeated input", async () => {
    const result = await publishLosses(opts, [e, e], reader());
    expect(result.created).toBe(1); expect(mock.executeBatch).toHaveBeenCalledTimes(1);
    const create = mock.executeBatch.mock.calls[0]?.[0].creates[0];
    expect(create.schema).toBe(LossSchema); expect(create.expiration).toEqual((await import("@arkiv-network/sdk")).ExpirationTime.fromDays(90));
  });
  it("creates zero duplicates when already present, and writes nothing with low funds", async () => {
    expect((await publishLosses(opts, [e], reader([lossValues(e)]))).created).toBe(0);
    expect((await publishLosses(opts, [e], reader([], 0n))).stoppedForFunds).toBe(true);
    expect(mock.executeBatch).not.toHaveBeenCalled();
  });
});
