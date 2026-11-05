import { MAINNET_USDC, MAINNET_USDT } from "@hexfence/shared";
import { describe, expect, it } from "vitest";
import { EVIDENCE_LABEL, etherscanTx, parseSearch, splitAddress, tokenName } from "../src/format.js";

const L = "0x4E185a3FC4B530244aB9ed0dE38167b403344120";

describe("format", () => {
  it("uses the exact required label", () => {
    expect(EVIDENCE_LABEL).toBe("Ethereum mainnet evidence · status: suspected");
  });

  it("links transactions on mainnet Etherscan", () => {
    expect(etherscanTx("0xabc")).toBe("https://etherscan.io/tx/0xabc");
  });

  it("names only the two canonical tokens", () => {
    expect(tokenName(MAINNET_USDT.toLowerCase())).toBe("USDT");
    expect(tokenName(MAINNET_USDC)).toBe("USDC");
    expect(tokenName(L)).toBe(L);
  });

  it("accepts an address in any case and refuses anything else", () => {
    expect(parseSearch(`  ${L.toLowerCase()} `)).toBe(L);
    expect(parseSearch(L.toUpperCase().replace("0X", "0x"))).toBe(L);
    expect(parseSearch("0x1234")).toBeNull();
    expect(parseSearch("vitalik.eth")).toBeNull();
    expect(parseSearch("")).toBeNull();
  });

  it("splits out the matching first and last characters without losing any", () => {
    const p = splitAddress(L, 4, 4);
    expect(p.head).toBe("4E18");
    expect(p.tail).toBe("4120");
    expect(p.prefix + p.head + p.middle + p.tail).toBe(L);
  });
});
