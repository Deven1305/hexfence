import { describe, expect, it } from "vitest";
import { MAINNET_USDT, MAINNET_USDC } from "@hexfence/shared";
import type { Address, Hex } from "viem";
import { LossDetector, sealLoss } from "../src/loss.js";
import { ONE_TOKEN, WINDOW_BLOCKS, type TransferLog } from "../src/detect.js";
const victim = "0x1111111111111111111111111111111111111111" as Address;
const p = "0x4E185e251Ac7fB83E9DE10723EAda46cadE74120" as Address;
const l = "0x4E185a3FC4B530244aB9ed0dE38167b403344120" as Address;
const tx = (n: number) => `0x${n.toString(16).padStart(64, "0")}` as Hex;
const log = (n: number, from: Address, to: Address, value: bigint, extra: Partial<TransferLog> = {}): TransferLog => ({ token: MAINNET_USDT, from, to, value, blockNumber: n, logIndex: 0, txHash: tx(n), ...extra });
const reference = log(10, victim, p, ONE_TOKEN);
const attack = log(11, victim, l, 0n);
describe("streaming suspected loss pass", () => {
  it("finds a loss and repeat, retains exact integer amounts, follows outgoing scan logs", () => {
    const d = new LossDetector();
    d.add([reference, attack, log(12, victim, l, 2n * ONE_TOKEN)]);
    d.add([log(13, victim, l, 3n * ONE_TOKEN), log(14, l, p, ONE_TOKEN)]);
    expect(d.results().map(x => [x.amount, x.repeat, x.status])).toEqual([["2000000", 1, "suspected"], ["3000000", 2, "suspected"]]);
    expect(d.results()[0]?.hops[0]).toMatchObject({ from: l, to: p, depth: 1 });
    expect(d.evidence()).toHaveLength(1);
  });
  it("rejects payments before planting, dust, other victims, unobserved pairs and expired attacks", () => {
    const d = new LossDetector();
    d.add([reference, log(10, victim, l, ONE_TOKEN, { logIndex: 1 }), attack,
      log(12, victim, l, ONE_TOKEN - 1n), log(13, p, l, ONE_TOKEN),
      log(14, victim, p, ONE_TOKEN), log(11 + WINDOW_BLOCKS + 1, victim, l, ONE_TOKEN)]);
    expect(d.results()).toHaveLength(0);
  });
  it("uses log order inside a block and does not count replayed log entries twice", () => {
    const d = new LossDetector();
    const loss = log(11, victim, l, ONE_TOKEN, { logIndex: 1, txHash: tx(12) });
    d.add([reference, attack, loss, loss]);
    expect(d.results()).toHaveLength(1); expect(d.results()[0]?.amount).toBe("1000000");
  });
  it("tracks a second victim even when the poisoning pair already has an evidenceId", () => {
    const other = "0x2222222222222222222222222222222222222222" as Address;
    const d = new LossDetector();
    d.add([reference, attack, log(12, other, p, ONE_TOKEN), log(13, other, l, 0n), log(14, other, l, ONE_TOKEN)]);
    expect(d.results()[0]?.victim).toBe(other);
  });
  it("accepts a later canonical token payment and aggregates multiple eligible logs in one tx", () => {
    const d = new LossDetector();
    d.add([reference, attack, log(12, victim, l, ONE_TOKEN, { token: MAINNET_USDC }), log(12, victim, l, 2n * ONE_TOKEN, { token: MAINNET_USDC, logIndex: 1 })]);
    expect(d.results()[0]).toMatchObject({ token: MAINNET_USDC, amount: "3000000", repeat: 1 });
  });
});

it("seals normalized addresses before hashing the core", async () => {
  const { rescuePackBody } = await import("@hexfence/shared");
  const { createHash } = await import("node:crypto");
  const d = new LossDetector(); d.add([reference, attack, log(12, victim, l, ONE_TOKEN, { token: MAINNET_USDT.toLowerCase() as Address })]);
  const sealed = sealLoss(d.results()[0]!);
  expect(sealed.token).toBe(MAINNET_USDT);
  expect(createHash("sha256").update(rescuePackBody(sealed)).digest("hex")).toBe(sealed.packHash);
});
