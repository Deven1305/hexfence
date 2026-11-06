import { describe, expect, it } from "vitest";
import { writeRelease } from "../src/release.js";

const opts = { privateKey: `0x${"11".repeat(32)}` as const };

describe("release record", () => {
  it("rejects a bad commit or empty sums before any network call", async () => {
    await expect(writeRelease(opts, "abc", "x  y", "h")).rejects.toThrow("commit");
    await expect(writeRelease(opts, "a".repeat(40), " ", "h")).rejects.toThrow("empty");
  });
});
