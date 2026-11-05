import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MAINNET_USDT } from "@hexfence/shared";
import { getAddress, type Hex } from "viem";
import { describe, expect, it } from "vitest";
import { detect, type TransferLog } from "../src/detect.js";
import { mergeEvidence, readEvidence } from "../src/jsonl.js";

// Synthetic fixture (not real users): V paid R, then got a zero-value transfer to R's lookalike X.
const V = getAddress("0x1111111111111111111111111111111111111111");
const R = getAddress("0x2ef9a83c5e1b77d04c3f9a2b6d81e0c452d18bf7");
const X = getAddress("0x2ef970bc13aa94e2f05c7d6b8e3a21f991f38bf7");
const t = (n: number) => `0x${n.toString(16).padStart(64, "0")}` as Hex;
const logs: TransferLog[] = [
  { token: MAINNET_USDT, from: V, to: R, value: 5_000_000n, blockNumber: 10, logIndex: 0, txHash: t(1) },
  { token: MAINNET_USDT, from: V, to: X, value: 0n, blockNumber: 11, logIndex: 0, txHash: t(2) },
];

describe("evidence.jsonl", () => {
  it("writes records and a re-run adds 0 duplicates", () => {
    const path = join(mkdtempSync(join(tmpdir(), "hexfence-")), "out", "evidence.jsonl");
    expect(mergeEvidence(path, detect(logs))).toEqual({ added: 1, total: 1 });
    expect(mergeEvidence(path, detect(logs))).toEqual({ added: 0, total: 1 });
    expect(readEvidence(path)).toEqual(detect(logs));
    expect(readFileSync(path, "utf8").trim().split("\n")).toHaveLength(1);
  });

  it("refuses a file with a tampered record", () => {
    const path = join(mkdtempSync(join(tmpdir(), "hexfence-")), "evidence.jsonl");
    const [e] = detect(logs);
    writeFileSync(path, JSON.stringify({ ...e, status: "malicious" }) + "\n");
    expect(() => readEvidence(path)).toThrow();
  });
});
