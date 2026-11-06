import { describe, expect, it, vi, beforeEach } from "vitest";
import { hexToString, sha256, stringToHex } from "viem";
import { str } from "@arkiv-network/sdk/schema";
import { MAX_RELEASE_MANIFEST_BYTES, releaseValues, writeRelease } from "../src/release.js";

const mocks = vi.hoisted(() => ({ fetch: vi.fn(), create: vi.fn(), reader: vi.fn(), wallet: vi.fn() }));
vi.mock("../src/read.js", () => ({ arkivReadClient: mocks.reader }));
vi.mock("../src/write.js", () => ({ arkivWalletClient: mocks.wallet }));
const opts = { privateKey: `0x${"11".repeat(32)}` as const };
const commit = "a".repeat(40);
const sums = Array.from({ length: 75 }, (_, i) => `${"1".repeat(64)}  pay/assets/file-${i}.js\n`).join("");
const digest = (s: string) => sha256(stringToHex(s)).slice(2);
const key = `0x${"22".repeat(32)}`;

beforeEach(() => {
  vi.clearAllMocks();
  const query = { from: () => query, createdBy: () => query, where: () => query, limit: () => query, fetch: mocks.fetch };
  mocks.reader.mockReturnValue({ select: () => query });
  mocks.wallet.mockReturnValue({ createEntity: mocks.create });
  mocks.fetch.mockResolvedValue({ entities: [] });
  mocks.create.mockResolvedValue({ entityKey: key });
});

describe("release record", () => {
  it("reproduces the str limit and encodes a real-sized manifest losslessly as SDK bytes", () => {
    expect(() => str(sums)).toThrow(/128/);
    const values = releaseValues(commit, sums, digest(sums));
    expect(values.sums.type).toBe("bytes");
    expect(hexToString(values.sums.value)).toBe(sums);
  });

  it("rejects bad inputs and mismatched hashes before any network call", async () => {
    for (const [c, s, h, error] of [
      ["abc", sums, digest(sums), "commit"], [commit, " ", "h", "empty"],
      [commit, sums, "0".repeat(64), "digest"],
      [commit, "x".repeat(MAX_RELEASE_MANIFEST_BYTES + 1), "h", "64 KiB"],
    ]) await expect(writeRelease(opts, c!, s!, h!)).rejects.toThrow(error);
    expect(mocks.reader).not.toHaveBeenCalled();
    expect(mocks.wallet).not.toHaveBeenCalled();
  });

  it("rejects malformed, duplicate or traversing manifest paths", () => {
    for (const s of ["nonsense\n", `${"1".repeat(64)}  ../secret\n`, `${"1".repeat(64)}  /root\n`, sums + sums])
      expect(() => releaseValues(commit, s, digest(s))).toThrow(/path\/line/);
  });

  it("writes the encoded manifest once with bounded expiry", async () => {
    await expect(writeRelease(opts, commit, sums, digest(sums))).resolves.toEqual({ entityKey: key, created: true });
    expect(mocks.create).toHaveBeenCalledOnce();
    expect(mocks.create.mock.calls[0]![1]).toEqual(releaseValues(commit, sums, digest(sums)));
    expect(mocks.create.mock.calls[0]![2]).toHaveProperty("expiration");
  });

  it("skips an existing matching release and refuses a conflicting commit record", async () => {
    mocks.fetch.mockResolvedValue({ entities: [{ $key: key, sumsSha256: { value: digest(sums) } }] });
    await expect(writeRelease(opts, commit, sums, digest(sums))).resolves.toEqual({ entityKey: key, created: false });
    expect(mocks.wallet).not.toHaveBeenCalled();
    mocks.fetch.mockResolvedValue({ entities: [{ $key: key, sumsSha256: { value: "0".repeat(64) } }] });
    await expect(writeRelease(opts, commit, sums, digest(sums))).rejects.toThrow("different manifest");
    expect(mocks.wallet).not.toHaveBeenCalled();
  });
});
