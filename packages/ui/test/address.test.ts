import { describe, expect, it } from "vitest";
import { addressGroups, addressColors } from "../src/index";
const p = "0x4E185e251Ac7fB83E9DE10723EAda46cadE74120";
const l = "0x4E185a3FC4B530244aB9ed0dE38167b403344120";
describe("address comparison", () => {
  it("retains every character and distinguishes matching ends from different middle", () => {
    const groups = addressGroups(l, p);
    expect(groups.map(g => g.text).join("")).toBe(l.slice(2));
    expect(groups[0]?.state).toBe("match"); expect(groups[9]?.state).toBe("match");
    expect(groups[1]?.state).toBe("diff");
  });
  it("uses address bytes for eight deterministic colour blocks", () => {
    expect(addressColors(p)).toHaveLength(8);
    expect(addressColors(p)).toEqual(addressColors(p.toLowerCase() as typeof p));
    expect(addressColors(l)).not.toEqual(addressColors(p));
  });
  it("rejects incomplete addresses", () => { expect(() => addressGroups("0x1234")).toThrow(); });
});
