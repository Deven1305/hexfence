import { describe, expect, it } from "vitest";
import { sha256Hex, writeRelease } from "../src/release.js";

const opts = { privateKey: `0x${"11".repeat(32)}` as const };

describe("release record", () => {
  it("hashes the sums text", () => {
    expect(sha256Hex("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
  it("rejects a bad commit or empty sums before any network call", async () => {
    await expect(writeRelease(opts, "abc", "x  y")).rejects.toThrow("commit");
    await expect(writeRelease(opts, "a".repeat(40), " ")).rejects.toThrow("empty");
  });
});
