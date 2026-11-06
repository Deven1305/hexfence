import { describe, expect, it } from "vitest";
import {
  fingerprint,
  sameFingerprint,
  isLookalike,
  sameAddress,
  checksum,
  verdictFor,
  EvidenceBloomFilter,
  createEvidenceBloomFilter,
  checkRecipientOffline,
} from "../src/index.js";

const P_DEMO = "0x4E185e251Ac7fB83E9DE10723EAda46cadE74120";
const L_DEMO = "0x4E185a3FC4B530244aB9ed0dE38167b403344120";
const USDT = "0xdAC17F958D2ee523a2206206994597C13D831ec7";
const USDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";

describe("@hexfence/check re-exports", () => {
  it("re-exports fingerprint and lookalike utilities from @hexfence/shared", () => {
    expect(fingerprint(P_DEMO)).toBe("0x4e184120");
    expect(fingerprint(L_DEMO)).toBe("0x4e184120");
    expect(sameFingerprint(P_DEMO, L_DEMO)).toBe(true);
    expect(isLookalike(L_DEMO, P_DEMO)).toBe(true);
    expect(sameAddress(P_DEMO, P_DEMO.toLowerCase())).toBe(true);
    expect(checksum(P_DEMO.toLowerCase())).toBe(P_DEMO);
  });

  it("re-exports verdictFor from @hexfence/shared", () => {
    const verdict = verdictFor(
      { kind: "eth", recipient: L_DEMO, amount: 1000n },
      [P_DEMO],
    );
    expect(verdict.level).toBe("RED");
    if (verdict.level === "RED" && verdict.reason === "resembles") {
      expect(verdict.payee).toBe(P_DEMO);
    }
  });
});

describe("EvidenceBloomFilter", () => {
  const sampleAddresses = [
    "0x1111111111111111111111111111111111111111",
    "0x2222222222222222222222222222222222222222",
    "0x3333333333333333333333333333333333333333",
    "0x4444444444444444444444444444444444444444",
  ];

  it("adds and checks addresses with zero false negatives", () => {
    const filter = EvidenceBloomFilter.fromAddresses(sampleAddresses);
    for (const addr of sampleAddresses) {
      expect(filter.has(addr)).toBe(true);
      expect(filter.check(addr)).toBe(true);
    }
  });

  it("matches regardless of case or checksumming", () => {
    const filter = EvidenceBloomFilter.fromAddresses([USDT]);
    expect(filter.has(USDT.toLowerCase())).toBe(true);
    expect(filter.has(USDT.toUpperCase())).toBe(true);
  });

  it("returns false for addresses not in the set", () => {
    const filter = EvidenceBloomFilter.fromAddresses(sampleAddresses);
    expect(filter.has(USDC)).toBe(false);
    expect(filter.has("0x9999999999999999999999999999999999999999")).toBe(false);
  });

  it("supports createEvidenceBloomFilter functional constructor", () => {
    const filter = createEvidenceBloomFilter([P_DEMO]);
    expect(filter.has(P_DEMO)).toBe(true);
    expect(filter.has(L_DEMO)).toBe(false);
  });

  it("handles empty address list gracefully", () => {
    const filter = EvidenceBloomFilter.fromAddresses([]);
    expect(filter.has(USDT)).toBe(false);
    filter.add(USDT);
    expect(filter.has(USDT)).toBe(true);
  });

  it("serializes and deserializes correctly via toJSON / fromJSON", () => {
    const original = EvidenceBloomFilter.fromAddresses(sampleAddresses, 0.005);
    const json = original.toJSON();
    const restored = EvidenceBloomFilter.fromJSON(json);

    expect(restored.m).toBe(original.m);
    expect(restored.k).toBe(original.k);
    for (const addr of sampleAddresses) {
      expect(restored.has(addr)).toBe(true);
    }
    expect(restored.has(USDC)).toBe(false);
  });

  it("serializes and deserializes correctly via toBase64 / fromBase64", () => {
    const original = EvidenceBloomFilter.fromAddresses([USDT, USDC]);
    const b64 = original.toBase64();
    const restored = EvidenceBloomFilter.fromBase64(b64);

    expect(restored.has(USDT)).toBe(true);
    expect(restored.has(USDC)).toBe(true);
    expect(restored.has(P_DEMO)).toBe(false);
  });
});

describe("checkRecipientOffline", () => {
  const filter = EvidenceBloomFilter.fromAddresses([USDT]);

  it("returns GREEN approved for payee", () => {
    const res = checkRecipientOffline(P_DEMO, [P_DEMO], filter);
    expect(res).toEqual({ level: "GREEN", reason: "approved", recipient: P_DEMO });
  });

  it("returns RED listed for address in evidence filter", () => {
    const res = checkRecipientOffline(USDT, [P_DEMO], filter);
    expect(res).toEqual({ level: "RED", reason: "listed", recipient: USDT });
  });

  it("returns RED resembles for lookalike of approved payee", () => {
    const res = checkRecipientOffline(L_DEMO, [P_DEMO], filter);
    expect(res).toEqual({ level: "RED", reason: "resembles", recipient: L_DEMO, payee: P_DEMO });
  });

  it("returns AMBER new for unlisted new recipient", () => {
    const res = checkRecipientOffline(USDC, [P_DEMO], filter);
    expect(res).toEqual({ level: "AMBER", reason: "new", recipient: USDC });
  });

  it("prioritizes approved payee over listed evidence", () => {
    // If a recipient is in approvedPayees AND in the evidence filter, approved takes precedence
    const res = checkRecipientOffline(USDT, [USDT], filter);
    expect(res.level).toBe("GREEN");
  });
});
