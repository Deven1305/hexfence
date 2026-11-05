import { getAddress, type Address, type Hex } from "viem";
import { describe, expect, it } from "vitest";
import type { DecodedPayment } from "../src/decoder.js";
import { verdictFor } from "../src/verdict.js";

// Synthetic Sepolia demo pair (spec §3.5) and a new supplier B. Not real users.
const P = getAddress("0x4E185e251Ac7fB83E9DE10723EAda46cadE74120");
const L = getAddress("0x4E185a3FC4B530244aB9ed0dE38167b403344120");
const B = getAddress("0x7c41d2e09b3f5a6c8e1d4f2a0b9c3e5d7f6a1b20");
const Q = getAddress("0x1234567890abcdef1234567890abcdef12345678");
const TOKEN = getAddress("0xdAC17F958D2ee523a2206206994597C13D831ec7");
const eth = (recipient: Address): DecodedPayment => ({ kind: "eth", recipient, amount: 1n });
const ID = `0x${"ab".repeat(32)}` as Hex;

describe("verdictFor", () => {
  const payees = [Q, P];

  it("GREY for admin, delegatecall and unsupported, before anything else", () => {
    expect(verdictFor({ kind: "admin" }, payees)).toEqual({ level: "GREY", reason: "admin" });
    expect(verdictFor({ kind: "delegatecall", target: L }, payees)).toEqual({ level: "GREY", reason: "delegatecall" });
    expect(verdictFor({ kind: "unsupported", to: L, selector: null }, payees)).toEqual({ level: "GREY", reason: "unsupported" });
  });

  it("GREEN for an approved payee (case-insensitive), even if it is also listed", () => {
    expect(verdictFor(eth(P), payees)).toEqual({ level: "GREEN", reason: "approved", recipient: P });
    expect(verdictFor(eth(P.toLowerCase() as Address), payees).level).toBe("GREEN");
    expect(verdictFor(eth(P), payees, new Map([[P.toLowerCase(), [ID]]])).level).toBe("GREEN");
  });

  it("RED resembles for the synthetic lookalike: the payee it resembles, never 'listed'", () => {
    expect(verdictFor(eth(L), payees)).toEqual({ level: "RED", reason: "resembles", recipient: L, payee: P });
    expect(verdictFor(eth(L), payees, new Map())).toEqual({ level: "RED", reason: "resembles", recipient: L, payee: P });
    const erc20: DecodedPayment = { kind: "erc20-transfer", token: TOKEN, recipient: L, amount: 1n };
    expect(verdictFor(erc20, payees).level).toBe("RED");
  });

  it("RED listed only on an EXACT match, and it wins over resembles", () => {
    expect(verdictFor(eth(B), payees, new Map([[B.toLowerCase(), [ID]]]))).toEqual({
      level: "RED",
      reason: "listed",
      recipient: B,
      evidenceIds: [ID],
    });
    expect(verdictFor(eth(L), payees, new Map([[L.toLowerCase(), [ID]]])).level === "RED").toBe(true);
    expect(verdictFor(eth(L), payees, new Map([[L.toLowerCase(), [ID]]]))).toMatchObject({ reason: "listed" });
    // A listed lookalike of B is NOT listed itself: no fuzzy matching on evidence.
    expect(verdictFor(eth(Q), [], new Map([[B.toLowerCase(), [ID]]]))).toEqual({ level: "AMBER", reason: "new", recipient: Q });
    // An empty id list is not a listing.
    expect(verdictFor(eth(B), payees, new Map([[B.toLowerCase(), []]])).level).toBe("AMBER");
  });

  it("AMBER for a genuinely new recipient (not an allowlist)", () => {
    expect(verdictFor(eth(B), payees)).toEqual({ level: "AMBER", reason: "new", recipient: B });
    expect(verdictFor(eth(L), [])).toEqual({ level: "AMBER", reason: "new", recipient: L });
  });
});
