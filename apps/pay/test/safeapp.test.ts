import { readFileSync, existsSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

const send = vi.fn(async () => ({ safeTxHash: "0x" + "ab".repeat(32) }));
const getInfo = vi.fn();
vi.mock("@safe-global/safe-apps-sdk", () => ({
  default: class {
    safe = { getInfo };
    txs = { send };
  },
}));

import { detectSafeApp, proposeInSafe } from "../src/safeapp";

const SAFE = "0x3BCc3969713778F3Ed26AE1490529eeBAD43FbD5";
const L = "0x4E185a3FC4B530244aB9ed0dE38167b403344120";

describe("Safe App mode", () => {
  it("is off outside an iframe (no window here), so standalone Pay is unchanged", async () => {
    expect(await detectSafeApp(10)).toBeUndefined();
    expect(getInfo).not.toHaveBeenCalled();
  });

  it("reads the Safe from Safe{Wallet} when embedded", async () => {
    vi.stubGlobal("window", { parent: {} });
    getInfo.mockResolvedValueOnce({ safeAddress: SAFE.toLowerCase(), chainId: 11155111, owners: [L.toLowerCase()], threshold: 1, isReadOnly: false });
    expect(await detectSafeApp(50)).toEqual({ safeAddress: SAFE, chainId: 11155111, owners: [L], threshold: 1 });
  });

  it("gives up when the parent never answers", async () => {
    vi.stubGlobal("window", { parent: {} });
    getInfo.mockReturnValueOnce(new Promise(() => undefined));
    expect(await detectSafeApp(20)).toBeUndefined();
    vi.unstubAllGlobals();
  });

  it("proposes the exact call: to, decimal value, data, no operation", async () => {
    const hash = await proposeInSafe({ to: L, value: 1000n, data: "0x", operation: 0 });
    expect(hash).toBe("0x" + "ab".repeat(32));
    expect(send).toHaveBeenCalledWith({ txs: [{ to: L, value: "1000", data: "0x" }] });
  });

  it("refuses to propose a delegatecall", async () => {
    await expect(proposeInSafe({ to: L, value: 0n, data: "0x", operation: 1 })).rejects.toThrow(/plain calls/);
  });
});

describe("manifest", () => {
  const dir = new URL("../public/", import.meta.url);
  const m = JSON.parse(readFileSync(new URL("manifest.json", dir), "utf8"));
  it("has what Safe{Wallet} reads, and the icon exists", () => {
    expect(m.name).toBe("HexFence Pay");
    expect(typeof m.description).toBe("string");
    expect(m.iconPath).toBe("icon.svg");
    expect(m.icons[0].src).toBe("icon.svg");
    expect(existsSync(new URL(m.iconPath, dir))).toBe(true);
  });
  it("description avoids banned words", () => {
    expect(m.description).not.toMatch(/\bsafe\b|verified|scam|malicious/);
  });
});
