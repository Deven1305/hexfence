import { evidenceId, MAINNET_USDC, MAINNET_USDT } from "@hexfence/shared";
import { getAddress, type Address, type Hex } from "viem";
import { describe, expect, it } from "vitest";
import { detect, DETECTOR_VERSION, type TransferLog } from "../src/detect.js";

// Fixture logs with synthetic addresses (not real users). R and X share a fingerprint, so X is a lookalike of R.
const V = getAddress("0x1111111111111111111111111111111111111111"); // victim
const R = getAddress("0x2ef9a83c5e1b77d04c3f9a2b6d81e0c452d18bf7"); // real recipient, fp 0x2ef98bf7
const X = getAddress("0x2ef970bc13aa94e2f05c7d6b8e3a21f991f38bf7"); // lookalike, fp 0x2ef98bf7
const N = getAddress("0x7c41d2e09b3f5a6c8e1d4f2a0b9c3e5d7f6a1b20"); // unrelated address
let tx = 0;
const log = (from: Address, to: Address, value: bigint, blockNumber: number, logIndex = 0, token: Address = MAINNET_USDT): TransferLog => ({
  token,
  from,
  to,
  value,
  blockNumber,
  logIndex,
  txHash: `0x${(++tx).toString(16).padStart(64, "0")}` as Hex,
});

describe("detect", () => {
  it("finds the zero-value variant: victim -> lookalike, value 0, after a real payment", () => {
    const ref = log(V, R, 5_000_000n, 100);
    const attack = log(V, X, 0n, 101);
    const [e, ...rest] = detect([attack, ref]); // input order doesn't matter
    expect(rest).toEqual([]);
    expect(e).toMatchObject({
      evidenceId: evidenceId(1, X, R, DETECTOR_VERSION),
      lookalike: X,
      impersonated: R,
      victim: V,
      variant: "zero-value",
      token: MAINNET_USDT,
      attackTx: attack.txHash,
      attackBlock: 101,
      referenceTx: ref.txHash,
      referenceBlock: 100,
      prefixLen: 4,
      suffixLen: 4,
      status: "suspected",
    });
  });

  it("finds the dust variant: lookalike -> victim, 0 < value < 1 token, across USDT/USDC", () => {
    const [e] = detect([log(V, R, 1_000_000n, 100, 0, MAINNET_USDC), log(X, V, 999_999n, 150, 3)]);
    expect(e).toMatchObject({ variant: "dust", victim: V, lookalike: X, impersonated: R, token: MAINNET_USDT });
  });

  it("needs the reference BEFORE the attack (block, then log index)", () => {
    expect(detect([log(V, X, 0n, 100), log(V, R, 5_000_000n, 101)])).toEqual([]);
    expect(detect([log(V, X, 0n, 100, 1), log(V, R, 5_000_000n, 100, 2)])).toEqual([]);
    expect(detect([log(V, R, 5_000_000n, 100, 1), log(V, X, 0n, 100, 2)])).toHaveLength(1);
  });

  it("needs a reference of at least 1 token", () => {
    expect(detect([log(V, R, 999_999n, 100), log(V, X, 0n, 101)])).toEqual([]);
  });

  it("needs the reference within 7,200 blocks", () => {
    expect(detect([log(V, R, 5_000_000n, 100), log(V, X, 0n, 7_300)])).toHaveLength(1);
    expect(detect([log(V, R, 5_000_000n, 100), log(V, X, 0n, 7_301)])).toEqual([]);
  });

  it("ignores non-matches: other fingerprints, other victims, the payee itself, and big transfers", () => {
    const ref = log(V, R, 5_000_000n, 100);
    expect(detect([ref, log(V, N, 0n, 101)])).toEqual([]); // different fingerprint
    expect(detect([ref, log(N, X, 0n, 101)])).toEqual([]); // a different victim
    expect(detect([ref, log(V, R, 0n, 101)])).toEqual([]); // zero to the real payee is not a lookalike
    expect(detect([ref, log(X, V, 1_000_000n, 101)])).toEqual([]); // 1 token is not dust
  });

  it("emits one record per (lookalike, impersonated): the earliest attack", () => {
    const first = log(V, X, 0n, 101);
    const out = detect([log(V, R, 5_000_000n, 100), first, log(V, X, 0n, 102), log(X, V, 5n, 103)]);
    expect(out).toHaveLength(1);
    expect(out[0]?.attackTx).toBe(first.txHash);
  });

  it("skips a reference to the lookalike itself and uses the real payee's", () => {
    // The victim was already fooled once (paid X), but the real payee R is what X imitates.
    const out = detect([log(V, R, 5_000_000n, 100), log(V, X, 2_000_000n, 101), log(V, X, 0n, 102)]);
    expect(out).toHaveLength(1);
    expect(out[0]?.impersonated).toBe(R);
  });
});
