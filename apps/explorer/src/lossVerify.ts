import { decodeEventLog, parseAbiItem, type TransactionReceipt } from "viem";
import { lossEvidence, type SuspectedLoss } from "@hexfence/shared";
import { checkReceipts, type Verification } from "./verify.js";
const transfer = parseAbiItem("event Transfer(address indexed from, address indexed to, uint256 value)");
type Receipt = Pick<TransactionReceipt, "status" | "blockNumber" | "logs">;
export function checkLossReceipts(e: SuspectedLoss, attack: Receipt, reference: Receipt, loss: Receipt): Verification {
  const poisoning = checkReceipts(lossEvidence(e), attack, reference);
  if (!poisoning.ok) return poisoning;
  if (loss.status !== "success" || loss.blockNumber !== BigInt(e.lossBlock)) return { ok: false, reason: "loss receipt failed or has a different block" };
  let total = 0n; let first: number | undefined;
  for (const log of loss.logs) {
    if (log.address.toLowerCase() !== e.token.toLowerCase()) continue;
    try {
      const { args } = decodeEventLog({ abi: [transfer], data: log.data, topics: log.topics });
      if (args.from.toLowerCase() !== e.victim.toLowerCase() || args.to.toLowerCase() !== e.lookalike.toLowerCase() || args.value < 1_000_000n) continue;
      if (e.lossBlock === e.attackBlock && log.logIndex <= e.attackLogIndex) continue;
      first = first === undefined ? log.logIndex : Math.min(first, log.logIndex); total += args.value;
    } catch { /* Other token events do not prove a loss. */ }
  }
  return total === BigInt(e.amount) && first === e.lossLogIndex ? { ok: true } : { ok: false, reason: "loss Transfer logs do not match the recorded amount and order" };
}
