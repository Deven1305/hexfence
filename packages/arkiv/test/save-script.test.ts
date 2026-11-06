import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PoisoningEvidenceSchema } from "@hexfence/shared";
import { lossFixture } from "../../shared/test/fixtures/loss.js";
import fixture from "../../../apps/explorer/test/fixtures/receipts.json";
import { writeFile } from "node:fs/promises";
import { arkivReadClient, fetchPublishedRecords, parseSavedRecords } from "../src/index.js";
vi.mock("node:fs/promises", () => ({ writeFile: vi.fn() }));
vi.mock("../src/index.js", async original => ({ ...await original<typeof import("../src/index.js")>(),
  arkivReadClient: vi.fn(() => ({})), fetchPublishedRecords: vi.fn() }));
const publisher = "0x36141ba063390f0d91Af7a5a9dF8dc1d80D699ec";
const argv = process.argv;
beforeEach(() => {
  vi.resetModules(); vi.clearAllMocks(); process.argv = ["node", "save-records.ts", publisher, "/copy.json"];
  vi.spyOn(console, "log").mockImplementation(() => {});
});
afterEach(() => { process.argv = argv; process.exitCode = 0; vi.unstubAllEnvs(); vi.restoreAllMocks(); });
it("writes only validated publisher, read time, evidence and loss JSON without a key", async () => {
  vi.stubEnv("ARKIV_ACCESS_KEY", "");
  const read = { evidence: [PoisoningEvidenceSchema.parse(fixture.zeroValue.evidence)], losses: [lossFixture()], readAt: 1_700_000_000_000 };
  vi.mocked(fetchPublishedRecords).mockResolvedValue(read);
  await import("../scripts/save-records.js");
  expect(arkivReadClient).toHaveBeenCalledWith({ accessKey: undefined });
  const call = vi.mocked(writeFile).mock.calls[0]!;
  expect(call[0]).toBe("/copy.json");
  const data = JSON.parse(String(call[1]));
  expect(Object.keys(data).sort()).toEqual(["evidence", "losses", "publisher", "readAt"]);
  expect(parseSavedRecords(data, publisher)).toEqual({ publisher, ...read });
});
it("uses a nonempty optional key without exposing it, exits zero and writes nothing on read failure", async () => {
  // Deliberately synthetic test string, not a credential.
  const key = "synthetic-test-credential"; vi.stubEnv("ARKIV_ACCESS_KEY", key);
  vi.mocked(fetchPublishedRecords).mockRejectedValue(new Error(`HTTP 429 https://rpc.invalid/${key}`));
  await import("../scripts/save-records.js");
  expect(arkivReadClient).toHaveBeenCalledWith({ accessKey: key });
  expect(writeFile).not.toHaveBeenCalled(); expect(process.exitCode).toBe(0);
  expect(console.log).toHaveBeenCalledWith("No saved copy written: public read limit reached.");
  expect(JSON.stringify(vi.mocked(console.log).mock.calls)).not.toContain(key);
});
