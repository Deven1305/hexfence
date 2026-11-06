import { describe, expect, it } from "vitest";
import { encodeAbiParameters, encodeEventTopics, parseAbiItem, type Address, type TransactionReceipt } from "viem";
import { lossFixture } from "../../../packages/shared/test/fixtures/loss.js";
import { checkLossReceipts } from "../src/lossVerify.js";
const event = parseAbiItem("event Transfer(address indexed from, address indexed to, uint256 value)");
const e = lossFixture();
function receipt(block: number, from: Address, to: Address, amount: bigint): TransactionReceipt {
  return { status: "success", blockNumber: BigInt(block), logs: [{ address: e.token, logIndex: 0, data: encodeAbiParameters([{ type: "uint256" }], [amount]), topics: encodeEventTopics({ abi: [event], eventName: "Transfer", args: { from, to } }) }] } as unknown as TransactionReceipt;
}
const ref = () => receipt(10, e.victim, e.impersonated, 2_000_000n);
const attack = () => receipt(11, e.victim, e.lookalike, 0n);
const loss = () => receipt(12, e.victim, e.lookalike, 2_000_000n);
describe("loss receipt check", () => {
  it("checks the full reference, planting, payment chain", () => { expect(checkLossReceipts(e, attack(), ref(), loss())).toEqual({ ok: true }); });
  it("refuses an incorrect amount, recipient, block or failed receipt", () => {
    for (const r of [receipt(12, e.victim, e.lookalike, 1_000_000n), receipt(12, e.victim, e.impersonated, 2_000_000n), { ...loss(), blockNumber: 13n }, { ...loss(), status: "reverted" as const }]) expect(checkLossReceipts(e, attack(), ref(), r).ok).toBe(false);
  });
  it("checks the recorded planting log index", () => { expect(checkLossReceipts({ ...e, attackLogIndex: 1 }, attack(), ref(), loss()).ok).toBe(false); });
  it("refuses missing planting evidence even when the payment itself matches", () => {
    expect(checkLossReceipts(e, { ...attack(), logs: [] }, ref(), loss()).ok).toBe(false);
  });
});
