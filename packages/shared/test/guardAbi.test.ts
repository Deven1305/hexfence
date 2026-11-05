import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { toFunctionSelector } from "viem";
import { describe, expect, it } from "vitest";
import { hexFenceGuardAbi } from "../src/guardAbi.js";

// Written by `cd contracts && npx hardhat test` (artifacts/ is git-ignored, so this test skips without it).
const ARTIFACT = fileURLToPath(
  new URL("../../../contracts/artifacts/contracts/HexFenceGuard.sol/HexFenceGuard.json", import.meta.url),
);

type Entry = {
  type: string;
  name?: string;
  inputs?: readonly { type: string; indexed?: boolean }[];
  outputs?: readonly { type: string }[];
};
const sig = (e: Entry) =>
  `${e.type} ${e.name}(${(e.inputs ?? []).map((i) => i.type + (i.indexed ? " indexed" : "")).join(",")})` +
  (e.outputs ? `->(${e.outputs.map((o) => o.type).join(",")})` : "");

describe("hexFenceGuardAbi", () => {
  it("has the functions clients need with the Guard's selectors", () => {
    const fns = hexFenceGuardAbi.filter((e) => e.type === "function");
    expect(fns.map((f) => toFunctionSelector(f))).toEqual(
      expect.arrayContaining([toFunctionSelector("payees(address)"), toFunctionSelector("approvePayee(address)")]),
    );
  });

  it.skipIf(!existsSync(ARTIFACT))("matches the compiled HexFenceGuard artifact entry by entry", () => {
    const compiled: Entry[] = JSON.parse(readFileSync(ARTIFACT, "utf8")).abi;
    const compiledSigs = new Set(compiled.map(sig));
    for (const e of hexFenceGuardAbi as readonly Entry[]) expect(compiledSigs, sig(e)).toContain(sig(e));
    // Every error and event of the Guard is present, so clients can decode any revert.
    const ours = new Set((hexFenceGuardAbi as readonly Entry[]).map(sig));
    for (const e of compiled.filter((x) => x.type === "error" || x.type === "event")) expect(ours, sig(e)).toContain(sig(e));
  });
});
