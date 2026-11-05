import { describe, expect, it } from "vitest";
import { fingerprint, isLookalike } from "../src/fingerprint.js";

// The shared test vectors from spec §2; the Guard's Hardhat test checks the same ones on-chain.
const USDT = "0xdAC17F958D2ee523a2206206994597C13D831ec7";
const USDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
const ZERO = "0x0000000000000000000000000000000000000000";
const P_DEMO = "0x4E185e251Ac7fB83E9DE10723EAda46cadE74120";
const L_DEMO = "0x4E185a3FC4B530244aB9ed0dE38167b403344120";

describe("fingerprint", () => {
  it("matches the spec vectors", () => {
    expect(fingerprint(USDT)).toBe("0xdac11ec7");
    expect(fingerprint(USDC)).toBe("0xa0b8eb48");
    expect(fingerprint(ZERO)).toBe("0x00000000");
    expect(fingerprint("0x2ef9a83c5e1b77d04c3f9a2b6d81e0c452d18bf7")).toBe("0x2ef98bf7");
    expect(fingerprint("0x2ef970bc13aa94e2f05c7d6b8e3a21f991f38bf7")).toBe("0x2ef98bf7");
  });

  it("gives both addresses of the ready-made demo pair 0x4e184120", () => {
    expect(fingerprint(P_DEMO)).toBe("0x4e184120");
    expect(fingerprint(L_DEMO)).toBe("0x4e184120");
  });

  it("ignores checksum case and keeps leading zeros", () => {
    expect(fingerprint(USDT.toLowerCase())).toBe(fingerprint(USDT));
    expect(fingerprint("0x0000aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa0001")).toBe("0x00000001");
  });

  it("rejects non-addresses", () => {
    expect(() => fingerprint("0x1234")).toThrow();
    expect(() => fingerprint("hello")).toThrow();
  });
});

describe("isLookalike", () => {
  it("is true only for a different address with the same fingerprint", () => {
    expect(isLookalike(L_DEMO, P_DEMO)).toBe(true);
    expect(isLookalike(P_DEMO, P_DEMO.toLowerCase())).toBe(false);
    expect(isLookalike(USDT, P_DEMO)).toBe(false);
  });
});
