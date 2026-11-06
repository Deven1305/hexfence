import { describe, expect, it, vi } from "vitest";
import type Safe from "@safe-global/protocol-kit";
import { encodeErrorResult, type Address } from "viem";
import { hexFenceGuardV2Abi } from "@hexfence/shared";
import { loadSafeInfo, type SafeInfo } from "../src/safe";
import { V2_GUARD, paymentVerdict, paymentVerdictText } from "../src/upgrade";
import { ALERTS_CONSUMER, radarSummary, readRadar } from "../src/radar";
import { interpretRevert } from "../src/revert";
import { FORCED_GAS_LIMIT, planFromSimulation } from "../src/execute";
import { requiresFriction } from "../src/friction";
import type { ReadClient } from "../src/rpc";

// Explicit synthetic unit fixtures; never served as evidence or alert data.
const SAFE = "0x1111111111111111111111111111111111111111" as Address;
const V1 = "0x2222222222222222222222222222222222222222" as Address;
const P = "0x4E185e251Ac7fB83E9DE10723EAda46cadE74120" as Address;
const L = "0x4E185a3FC4B530244aB9ed0dE38167b403344120" as Address;
const known = [{ recipient: P, approved: false, firstPaidAt: 1700000000n }];
const info: SafeInfo = { address: SAFE, version: "1.4.1", owners: [SAFE], threshold: 1, guard: { active: true }, payees: [], v2: { guard: V2_GUARD, known, autoLearn: true } };
const fakeSafe = (guard: Address) => ({ getAddress: async () => SAFE, getGuard: async () => guard, getOwners: async () => [SAFE], getThreshold: async () => 1, getContractVersion: () => "1.4.1" }) as unknown as Safe;

describe("Pay upgrade wiring", () => {
  it("bulk-loads V2 metadata once per Safe, without v1 or per-recipient lookups", async () => {
    const readContract = vi.fn(async ({ functionName }: { functionName: string }) => functionName === "recipientDetails" ? known : true);
    const result = await loadSafeInfo(fakeSafe(V2_GUARD), { readContract } as unknown as ReadClient, V1);
    expect(result.guard.active).toBe(true); expect(result.v2?.known).toEqual(known); expect(result.payees).toEqual([]);
    expect(readContract.mock.calls.map(([c]) => c.functionName)).toEqual(["recipientDetails", "autoLearn"]);
    for (const [call] of readContract.mock.calls) expect(call).toMatchObject({ args: [SAFE] });
  });
  it("preserves v1's single bulk payees read", async () => {
    const readContract = vi.fn(async () => [P]);
    const result = await loadSafeInfo(fakeSafe(V1), { readContract } as unknown as ReadClient, V1);
    expect(result.v2).toBeUndefined(); expect(result.payees).toEqual([P]);
    expect(readContract).toHaveBeenCalledOnce();
    expect(readContract).toHaveBeenCalledWith(expect.objectContaining({ functionName: "payees", args: [SAFE] }));
  });
  it("uses learned history in preview and keeps synthetic resemblance out of evidence wording", () => {
    const call = { to: L, value: 1n, data: "0x" as const, operation: 0 as const };
    const verdict = paymentVerdict(call, info, V1);
    expect(verdict.reason).toBe("resembles-known"); expect(requiresFriction(verdict)).toBe(true);
    const text = paymentVerdictText(verdict, { guardActive: true, lang: "hi" }, info);
    expect(text.englishOnly).toBe(true);
    expect(text.sentences.join(" ")).toContain("2023-11-14");
    expect(text.sentences.join(" ")).not.toMatch(/evidence|listed|verified|scam|malicious/i);
    expect(paymentVerdict(call, { ...info, v2: { ...info.v2!, known: [] } }, V1).level).toBe("AMBER");
  });
  it("does not label a learned exact recipient as explicitly approved or invent missing dates", () => {
    const verdict = paymentVerdict({ to: P, value: 1n, data: "0x", operation: 0 }, info, V1);
    expect(verdict.reason).toBe("known");
    expect(paymentVerdictText(verdict, { guardActive: true }, info).sentences.join(" ")).not.toContain("Approved payee");
    if (verdict.reason !== "known") throw Error("expected known");
    expect(paymentVerdictText({ ...verdict, firstPaidAt: 0n }, { guardActive: true }, info).sentences.join(" ")).toContain("date unavailable");
  });
  it("decodes a V2 lookalike refusal and retains the existing forced-gas flow", () => {
    const data = encodeErrorResult({ abi: hexFenceGuardV2Abi, errorName: "LookalikeOfKnownRecipient", args: [L, P] });
    const decoded = interpretRevert({ data });
    expect(decoded).toEqual({ kind: "known-lookalike", recipient: L, holder: P });
    expect(planFromSimulation({ ok: false, info: decoded })).toEqual({ send: true, gasLimit: FORCED_GAS_LIMIT });
  });
  it("reads alerts in bulk through the supplied read client and labels them simulation data", async () => {
    const alerts = [{ lookalike: L, resembles: P, txHash: `0x${"ab".repeat(32)}`, variant: 0, observedBlock: 123n }];
    const readContract = vi.fn(async () => alerts);
    const result = await readRadar({ readContract } as unknown as ReadClient, SAFE);
    expect(readContract).toHaveBeenCalledOnce();
    expect(readContract).toHaveBeenCalledWith(expect.objectContaining({ address: ALERTS_CONSUMER, functionName: "alertsOf", args: [SAFE] }));
    expect(radarSummary(result)).toMatch(/simulation.*1 alert.*advisory/);
    expect(radarSummary(result)).not.toContain("will refuse");
  });
  it("does not turn a failed alert read into a no-alert claim", async () => {
    const result = await readRadar({ readContract: async () => { throw Error("RPC unavailable"); } } as unknown as ReadClient, SAFE);
    expect(result).toEqual({ status: "unavailable" });
    expect(radarSummary(result)).toContain("unavailable");
    expect(radarSummary({ status: "ok", alerts: [] })).toContain("no alerts returned");
  });
});
