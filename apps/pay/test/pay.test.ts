import { describe, expect, it } from "vitest";
import { decodeSafeCall, hexFenceGuardAbi, verdictFor, type Verdict } from "@hexfence/shared";
import { encodeAbiParameters, encodeErrorResult, decodeFunctionData, type Address, type Hex } from "viem";
import { ConfigError, loadConfig } from "../src/config";
import { FORCED_GAS_LIMIT, planFromSimulation } from "../src/execute";
import { frictionSatisfied, frictionSuffix, requiresFriction } from "../src/friction";
import { buildPaymentCall, erc20Abi, InputError, parseAddress, parseAmount } from "../src/payment";
import { describeRevert, interpretRevert } from "../src/revert";
import { isWalletMethod } from "../src/rpc";
import { toHindi } from "../src/i18n";
import { GUARD_INACTIVE_SENTENCE, verdictText } from "../src/verdictCopy";

const P: Address = "0x4E185e251Ac7fB83E9DE10723EAda46cadE74120";
const L: Address = "0x4E185a3FC4B530244aB9ed0dE38167b403344120";
const B: Address = "0x1111111111111111111111111111111111111111";
const SAFE: Address = "0x2222222222222222222222222222222222222222";
const GUARD: Address = "0x3333333333333333333333333333333333333333";
const eth = (to: Address) => decodeSafeCall(buildPaymentCall({ kind: "eth" }, to, 1n), { safe: SAFE, guard: GUARD });

describe("verdict strings (spec 3.4)", () => {
  it("RED resembles, guard active: exact text", () => {
    const v = verdictFor(eth(L), [P]);
    expect(v).toMatchObject({ level: "RED", reason: "resembles", payee: P });
    expect(verdictText(v, { guardActive: true }).sentences.join(" ")).toBe(
      `Possible address poisoning. This recipient resembles your approved payee ${P} (same first 4 and last 4 characters) but is a different address. Your protected Safe will refuse this payment.`,
    );
  });
  it("RED resembles, guard NOT active: first two sentences kept, last replaced", () => {
    const t = verdictText(verdictFor(eth(L), [P]), { guardActive: false });
    expect(t.guardNotice).toBe(true);
    expect(t.sentences[2]).toBe(GUARD_INACTIVE_SENTENCE);
    expect(t.sentences.join(" ")).not.toContain("will refuse");
  });
  it("AMBER, GREEN, GREY", () => {
    expect(verdictText(verdictFor(eth(B), [P]), { guardActive: true }).sentences.join(" ")).toBe(
      "New recipient: not one of your approved payees. HexFence will not block this payment. Check the full address with the recipient.",
    );
    expect(verdictText(verdictFor(eth(P), [P]), { guardActive: true }).sentences).toEqual([`Approved payee ${P}.`]);
    const grey = verdictFor({ kind: "unsupported", to: B, selector: null }, [P]);
    expect(verdictText(grey, { guardActive: true }).sentences).toEqual(["Cannot verify this transaction type. HexFence checks only ETH and ERC-20 transfers."]);
    const dc = verdictFor({ kind: "delegatecall", target: B }, [P]);
    expect(verdictText(dc, { guardActive: true }).sentences).toEqual(["This is a delegatecall. Your HexFence Guard will refuse it."]);
    expect(verdictText(dc, { guardActive: false }).sentences.join(" ")).not.toContain("will refuse");
  });
  it("RED listed text names the publisher", () => {
    const v = verdictFor(eth(B), [P], new Map([[B.toLowerCase(), ["0xab" as Hex]]]));
    expect(verdictText(v, { guardActive: true, publisher: "0xPUB" }).sentences[0]).toBe(
      "This exact address is listed in public poisoning evidence on Arkiv (Ethereum mainnet, publisher 0xPUB). Status: suspected. See the explorer.",
    );
  });
  it("the synthetic lookalike L only ever gets RED resembles, never evidence wording", () => {
    const v = verdictFor(eth(L), [P]);
    expect(v).toMatchObject({ reason: "resembles" });
    expect(verdictText(v, { guardActive: true }).sentences.join(" ")).not.toMatch(/evidence|listed/i);
  });
  it("English UI strings avoid banned words", () => {
    const all: Verdict[] = [
      verdictFor(eth(L), [P]),
      verdictFor(eth(B), [P]),
      verdictFor(eth(P), [P]),
      verdictFor(eth(B), [P], new Map([[B.toLowerCase(), ["0xab" as Hex]]])),
      { level: "GREY", reason: "delegatecall" },
      { level: "GREY", reason: "unsupported" },
      { level: "GREY", reason: "admin" },
    ];
    for (const v of all)
      for (const guardActive of [true, false]) {
        const text = verdictText(v, { guardActive, publisher: "0xPUB" }).sentences.join(" ");
        expect(text).not.toMatch(/safe/); // lowercase "safe" (adjective, "safely", "unsafe"); "Safe" the product is fine
        expect(text).not.toMatch(/verified|scam|malicious/i);
      }
  });
});

describe("Hindi (T12, spec 3.4 verbatim)", () => {
  const SPEC_RED = `संभावित एड्रेस पॉइज़निंग: यह प्राप्तकर्ता आपके स्वीकृत प्राप्तकर्ता ${P} जैसा दिखता है (पहले 4 और आख़िरी 4 अक्षर समान), लेकिन यह अलग पता है। आपका सुरक्षित Safe यह भुगतान नहीं करेगा।`;
  const SPEC_AMBER = "नया प्राप्तकर्ता: यह आपके स्वीकृत प्राप्तकर्ताओं में नहीं है। HexFence इस भुगतान को नहीं रोकेगा। पूरा पता प्राप्तकर्ता से मिलाकर देखें।";
  it("RED resembles and AMBER match the spec text exactly", () => {
    expect(verdictText(verdictFor(eth(L), [P]), { guardActive: true, lang: "hi" }).sentences.join(" ")).toBe(SPEC_RED);
    expect(verdictText(verdictFor(eth(B), [P]), { guardActive: true, lang: "hi" }).sentences.join(" ")).toBe(SPEC_AMBER);
  });
  it("Guard not active: the refusal claim is dropped", () => {
    const t = verdictText(verdictFor(eth(L), [P]), { guardActive: false, lang: "hi" });
    expect(t.guardNotice).toBe(true);
    expect(t.sentences.join(" ")).not.toContain("नहीं करेगा");
    expect(t.sentences[1]).toBe(GUARD_INACTIVE_SENTENCE);
  });
  it("every other verdict has Hindi and keeps its address and meaning", () => {
    const listed = verdictFor(eth(B), [P], new Map([[B.toLowerCase(), ["0xab" as Hex]]]));
    const others: Verdict[] = [verdictFor(eth(P), [P]), listed, { level: "GREY", reason: "delegatecall" }, { level: "GREY", reason: "unsupported" }];
    for (const v of others) {
      const text = verdictText(v, { guardActive: true, publisher: "0xPUB", lang: "hi" }).sentences.join(" ");
      expect(text).toMatch(/[\u0900-\u097F]/);
    }
    expect(verdictText(others[0]!, { guardActive: true, lang: "hi" }).sentences.join(" ")).toContain(P);
    expect(verdictText(listed, { guardActive: true, publisher: "0xPUB", lang: "hi" }).sentences.join(" ")).toMatch(/0xPUB.*संदिग्ध/);
    expect(verdictText({ level: "GREY", reason: "delegatecall" }, { guardActive: false, lang: "hi" }).sentences.join(" ")).not.toContain("अस्वीकार करेगा");
  });
  it("interface text translates, keeps addresses, and leaves unknown text alone", () => {
    expect(toHindi("3. Payment")).toBe("3. भुगतान");
    expect(toHindi(`To continue, type the last 6 characters of ${L}`)).toContain(L);
    expect(toHindi(GUARD_INACTIVE_SENTENCE)).toMatch(/[\u0900-\u097F]/);
    expect(toHindi("Some technical error")).toBe("Some technical error");
  });
  it("default language is English", () => {
    expect(verdictText(verdictFor(eth(B), [P]), { guardActive: true }).sentences[0]).toBe("New recipient: not one of your approved payees.");
  });
});

describe("friction", () => {
  it("only RED needs it", () => {
    expect(requiresFriction(verdictFor(eth(L), [P]))).toBe(true);
    expect(requiresFriction(verdictFor(eth(B), [P]))).toBe(false);
    expect(requiresFriction(verdictFor(eth(P), [P]))).toBe(false);
  });
  it("L takes 344120 (any case) and refuses P's E74120", () => {
    expect(frictionSuffix(L)).toBe("344120");
    expect(frictionSatisfied(L, "344120")).toBe(true);
    expect(frictionSatisfied(L, " 344120 ")).toBe(true);
    expect(frictionSatisfied(L, "E74120")).toBe(false);
    expect(frictionSatisfied(L, "34412")).toBe(false);
    expect(frictionSatisfied("0xAbCdEf0000000000000000000000000000AbCdEf", "abcdef")).toBe(true);
    expect(frictionSatisfied("0xAbCdEf0000000000000000000000000000AbCdEf", "ABCDEF")).toBe(true);
  });
});

describe("payment building", () => {
  it("ETH payment is a plain call", () => {
    expect(buildPaymentCall({ kind: "eth" }, B, 5n)).toEqual({ to: B, value: 5n, data: "0x", operation: 0 });
  });
  it("ERC-20 payment is token.transfer(recipient, amount) and decodes as erc20-transfer", () => {
    const token: Address = "0x4444444444444444444444444444444444444444";
    const call = buildPaymentCall({ kind: "erc20", token, decimals: 6 }, L, 42n);
    expect(call.to).toBe(token);
    expect(decodeFunctionData({ abi: erc20Abi, data: call.data })).toMatchObject({ functionName: "transfer", args: [L, 42n] });
    expect(decodeSafeCall(call, { safe: SAFE, guard: GUARD })).toMatchObject({ kind: "erc20-transfer", recipient: L, amount: 42n });
  });
  it("parseAmount", () => {
    expect(parseAmount("1.5", 6)).toBe(1_500_000n);
    expect(parseAmount("0.000001", 6)).toBe(1n);
    for (const bad of ["", "0", "-1", "1e3", "abc", "1.0000001"]) expect(() => parseAmount(bad, 6)).toThrow(InputError);
  });
  it("parseAddress rejects bad checksums and junk", () => {
    expect(parseAddress(L, "x")).toBe(L);
    expect(parseAddress(L.toLowerCase(), "x")).toBe(L);
    expect(() => parseAddress("0x4E185a3FC4B530244aB9ed0dE38167b403344121", "x")).toThrow(InputError);
    expect(() => parseAddress("nope", "x")).toThrow(InputError);
  });
});

describe("revert decoding and send plan", () => {
  const lookalikeData = encodeErrorResult({ abi: hexFenceGuardAbi, errorName: "LookalikeOfApprovedPayee", args: [L, P] });
  const wrapped = (data: Hex) => Object.assign(new Error("call failed"), { cause: Object.assign(new Error("rpc"), { data }) });
  it("decodes LookalikeOfApprovedPayee from a nested viem-style error", () => {
    const r = interpretRevert(wrapped(lookalikeData));
    expect(r).toEqual({ kind: "lookalike", recipient: L, approvedPayee: P });
    expect(describeRevert(r)).toContain("LookalikeOfApprovedPayee");
  });
  it("lookalike refusal is sent with an explicit gas limit", () => {
    expect(planFromSimulation({ ok: false, info: interpretRevert(wrapped(lookalikeData)) })).toEqual({ send: true, gasLimit: FORCED_GAS_LIMIT });
    expect(FORCED_GAS_LIMIT).toBe(200_000);
  });
  it("success is sent normally (no gas limit, Protocol Kit estimates)", () => {
    expect(planFromSimulation({ ok: true })).toEqual({ send: true });
  });
  it("other Guard errors and Safe reasons are shown, not sent", () => {
    const delegate = encodeErrorResult({ abi: hexFenceGuardAbi, errorName: "DelegateCallNotAllowed", args: [B] });
    expect(planFromSimulation({ ok: false, info: interpretRevert(wrapped(delegate)) }).send).toBe(false);
    const errString = ("0x08c379a0" + encodeAbiParameters([{ type: "string" }], ["GS026"]).slice(2)) as Hex;
    const r = interpretRevert(wrapped(errString));
    expect(r).toMatchObject({ kind: "reason" });
    expect(describeRevert(r)).toContain("GS026");
    expect(planFromSimulation({ ok: false, info: r }).send).toBe(false);
  });
  it("unknown failures carry the message and are not sent", () => {
    const r = interpretRevert(new Error("network down"));
    expect(r).toEqual({ kind: "unknown", text: "network down" });
    expect(planFromSimulation({ ok: false, info: r }).send).toBe(false);
  });
});

describe("config and provider routing", () => {
  it("missing values give one clear error and no fallback", () => {
    expect(() => loadConfig({})).toThrow(ConfigError);
    expect(() => loadConfig({})).toThrow(/VITE_GUARD_ADDRESS.*VITE_SEPOLIA_RPC_URL/);
    expect(() => loadConfig({ VITE_GUARD_ADDRESS: "nope", VITE_SEPOLIA_RPC_URL: "ftp://x" })).toThrow(/not an address.*http/);
  });
  it("valid values load; publisher and explorer are optional", () => {
    const c = loadConfig({ VITE_GUARD_ADDRESS: GUARD, VITE_SEPOLIA_RPC_URL: "https://rpc.example" });
    expect(c.guard).toBe(GUARD);
    expect(c.publisher).toBeUndefined();
  });
  it("wallet methods go to the wallet, reads to the read client", () => {
    for (const m of ["eth_accounts", "eth_requestAccounts", "eth_signTypedData_v4", "eth_sendTransaction", "personal_sign"]) expect(isWalletMethod(m)).toBe(true);
    for (const m of ["eth_call", "eth_chainId", "eth_getStorageAt", "eth_estimateGas", "eth_getCode", "eth_getTransactionReceipt"]) expect(isWalletMethod(m)).toBe(false);
  });
});
