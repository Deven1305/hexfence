import { encodeFunctionData, parseAbi, type Address } from "viem";
import { describe, expect, it } from "vitest";
import { toHindi } from "../src/i18n";
import { explainView, parseDescriptors } from "../src/explain";
import type { SafeInfo } from "../src/safe";

// Synthetic unit fixtures: a made-up contract and descriptor (ERC-7730 shape), the repo's usual P / L lookalike pair.
const SAFE = "0x3BCc3969713778F3Ed26AE1490529eeBAD43FbD5" as Address;
const V1 = "0xA061fB511D69e5c92E50E3BE5c789472d6f19748" as Address;
const CONTRACT = "0x1111111111111111111111111111111111111111" as Address;
const P = "0x4E185e251Ac7fB83E9DE10723EAda46cadE74120" as Address;
const L = "0x4E185a3FC4B530244aB9ed0dE38167b403344120" as Address;
const info: SafeInfo = { address: SAFE, version: "1.4.1", owners: [SAFE], threshold: 1, guard: { active: true }, payees: [P] };
const descriptor = JSON.stringify({
  context: { contract: { deployments: [{ chainId: 11155111, address: CONTRACT }] } },
  display: { formats: { "payOut(address to,uint256 amount)": { intent: "Pay out", interpolatedIntent: "Pay out {amount} to {to}", fields: [{ path: "to", label: "To", format: "addressName" }, { path: "amount", label: "Amount", format: "raw" }] } } },
});
const data = (to: Address) => encodeFunctionData({ abi: parseAbi(["function payOut(address to, uint256 amount)"]), functionName: "payOut", args: [to, 5n] });

describe("Pay explain panel logic", () => {
  it("explains a described call and warns on a lookalike of an approved payee, while the verdict stays cannot verify", () => {
    const v = explainView({ to: CONTRACT, value: 0n, data: data(L) }, info, V1, parseDescriptors(descriptor));
    expect(v.verdict).toEqual({ level: "GREY", reason: "unsupported" });
    expect(v.explanation?.text).toBe(`Pay out 5 to ${L}`);
    expect(v.warnings).toHaveLength(1);
    expect(v.warnings[0]).toContain(P);
  });
  it("no warning and still cannot verify when the described address is the approved payee itself", () => {
    const v = explainView({ to: CONTRACT, value: 0n, data: data(P) }, info, V1, parseDescriptors(descriptor));
    expect(v.verdict.level).toBe("GREY");
    expect(v.warnings).toEqual([]);
  });
  it("without a matching descriptor there is no explanation and the verdict is unchanged", () => {
    const v = explainView({ to: SAFE.replace("3BCc", "3BCd") as Address, value: 0n, data: data(P) }, info, V1, parseDescriptors(descriptor));
    expect(v.explanation).toBeNull();
    expect(v.verdict.level).toBe("GREY");
  });
  it("rejects input that is not a descriptor", () => {
    expect(() => parseDescriptors("nope")).toThrow(/not valid JSON/);
    expect(() => parseDescriptors("[]")).toThrow(/Paste an ERC-7730/);
    expect(() => parseDescriptors("[1]")).toThrow(/Paste an ERC-7730/);
  });
  it("has Hindi for the panel text, including the lookalike warning", () => {
    expect(toHindi("Explain call")).toBe("कॉल समझाएँ");
    const w = `To ${L} resembles your approved payee ${P} (same first 4 and last 4 characters) but is a different address. HexFence Guard does not check this call type, so it will not stop it.`;
    expect(toHindi(w)).toContain("जैसा दिखता है");
    expect(toHindi(w)).toContain(L);
  });
});
