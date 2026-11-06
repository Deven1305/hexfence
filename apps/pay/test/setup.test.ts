import { describe, expect, it } from "vitest";
import { hexFenceGuardAbi } from "@hexfence/shared";
import { decodeFunctionData, parseAbi, zeroAddress, type Address } from "viem";
import type { SafeInfo } from "../src/safe";
import {
  buildApprovePayeeCall,
  buildDisableGuardCall,
  buildEnableGuardCall,
  buildRemovePayeeCall,
  checkApprove,
  DISABLE_WARNING,
  enableWarnings,
  removeWarning,
  setupBlocker,
} from "../src/setup";

const P: Address = "0x4E185e251Ac7fB83E9DE10723EAda46cadE74120";
const L: Address = "0x4E185a3FC4B530244aB9ed0dE38167b403344120"; // same first 4 / last 4 as P
const B: Address = "0xcB0a33f755826307CcaC3f4b4833e7e19d38cEb6";
const SAFE: Address = "0x3BCc3969713778F3Ed26AE1490529eeBAD43FbD5";
const GUARD: Address = "0xA061fB511D69e5c92E50E3BE5c789472d6f19748";
const OWNER: Address = "0x1111111111111111111111111111111111111111";

const info = (over: Partial<SafeInfo> = {}): SafeInfo => ({
  address: SAFE,
  version: "1.4.1",
  owners: [OWNER],
  threshold: 1,
  guard: { active: false, reason: "none" },
  payees: [],
  ...over,
});

const safeAbi = parseAbi(["function setGuard(address guard)"]);

describe("setup calldata", () => {
  it("setGuard goes from the Safe to itself as a plain Call with the Guard address", () => {
    const c = buildEnableGuardCall(SAFE, GUARD);
    expect(c).toMatchObject({ to: SAFE, value: 0n, operation: 0 });
    expect(decodeFunctionData({ abi: safeAbi, data: c.data })).toMatchObject({ functionName: "setGuard", args: [GUARD] });
  });
  it("turning the Guard off is setGuard(0x0) to the Safe", () => {
    const c = buildDisableGuardCall(SAFE);
    expect(c).toMatchObject({ to: SAFE, value: 0n, operation: 0 });
    expect(decodeFunctionData({ abi: safeAbi, data: c.data }).args).toEqual([zeroAddress]);
  });
  it("approvePayee and removePayee go to the Guard as plain Calls", () => {
    const a = buildApprovePayeeCall(GUARD, P);
    expect(a).toMatchObject({ to: GUARD, value: 0n, operation: 0 });
    expect(decodeFunctionData({ abi: hexFenceGuardAbi, data: a.data })).toMatchObject({ functionName: "approvePayee", args: [P] });
    const r = buildRemovePayeeCall(GUARD, P);
    expect(r).toMatchObject({ to: GUARD, value: 0n, operation: 0 });
    expect(decodeFunctionData({ abi: hexFenceGuardAbi, data: r.data })).toMatchObject({ functionName: "removePayee", args: [P] });
  });
});

describe("approve pre-check mirrors the contract", () => {
  it("rejects the zero address", () => {
    expect(checkApprove(zeroAddress, [])).toMatchObject({ ok: false });
  });
  it("rejects an address that is already a payee (case-insensitive)", () => {
    expect(checkApprove(P.toLowerCase() as Address, [P])).toMatchObject({ ok: false, reason: "That address is already an approved payee." });
  });
  it("rejects a different address with the same fingerprint, naming the existing payee", () => {
    const r = checkApprove(L, [P]);
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.reason).toContain(P);
  });
  it("accepts a new address and warns that lookalikes of it will be refused", () => {
    const r = checkApprove(B, [P]);
    expect(r.ok).toBe(true);
    expect(r.ok && r.warning).toContain("refuses");
  });
});

describe("who can use setup", () => {
  it("allows a threshold-1 owner", () => {
    expect(setupBlocker(info(), OWNER)).toBeUndefined();
  });
  it("blocks a non-owner, threshold above 1, and Safes without guard support", () => {
    expect(setupBlocker(info(), B)).toMatch(/not an owner/);
    expect(setupBlocker(info({ threshold: 2, owners: [OWNER, B] }), OWNER)).toMatch(/threshold 1 only/);
    expect(setupBlocker(info({ guard: { active: false, reason: "unsupported" } }), OWNER)).toMatch(/does not support guards/);
  });
});

describe("lock-out warnings state what the contract does", () => {
  it("enable: names delegatecall/MultiSend, lookalike refusal and the setGuard(0x0) way out", () => {
    const text = enableWarnings(info()).join(" ");
    expect(text).toMatch(/delegatecall/);
    expect(text).toMatch(/MultiSend/);
    expect(text).toMatch(/different address will be refused/);
    expect(text).toMatch(/setGuard\(0x0\)/);
    expect(text).toMatch(/No payees are approved yet/);
  });
  it("enable over a different guard says it replaces that guard", () => {
    const other: Address = "0x2222222222222222222222222222222222222222";
    expect(enableWarnings(info({ guard: { active: false, reason: "different", current: other } }))[0]).toContain(other);
  });
  it("no warning text uses forbidden words or lowercase 'safe'", () => {
    const all = [...enableWarnings(info({ payees: [P] })), DISABLE_WARNING, removeWarning(P), (checkApprove(B, [P]) as { warning: string }).warning];
    for (const t of all) {
      expect(t).not.toMatch(/safe/);
      expect(t).not.toMatch(/verified|scam|malicious/i);
    }
  });
});
