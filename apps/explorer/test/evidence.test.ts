import { expect, it, vi } from "vitest";
import type { ArkivReadClient } from "@hexfence/arkiv";
import { fetchEvidencePage } from "../src/evidence.js";
const publisher = "0x36141ba063390f0d91Af7a5a9dF8dc1d80D699ec";
it("counts once across pages", async () => {
  const count = { from: vi.fn().mockReturnThis(), createdBy: vi.fn().mockReturnThis(), fetch: vi.fn().mockResolvedValue(200n) };
  const query = { from: vi.fn().mockReturnThis(), createdBy: vi.fn().mockReturnThis(), orderBy: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), fetch: vi.fn().mockResolvedValue({ entities: [] }) };
  const client = { select: () => query, count: vi.fn(() => count) } as unknown as ArkivReadClient;
  expect((await fetchEvidencePage(client, publisher)).total).toBe(200n);
  await fetchEvidencePage(client, publisher, `0x${"01".repeat(32)}`);
  await fetchEvidencePage(client, publisher, `0x${"02".repeat(32)}`);
  expect(client.count).toHaveBeenCalledTimes(1);
  expect(query.fetch).toHaveBeenCalledTimes(3);
});
