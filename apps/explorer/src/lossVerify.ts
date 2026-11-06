import { decodeEventLog, parseAbiItem, type TransactionReceipt } from "viem";
import { lossEvidence, lossPayments, type SuspectedLoss } from "@hexfence/shared";
import { checkReceipts, type Verification } from "./verify.js";
const transfer = parseAbiItem("event Transfer(address indexed from, address indexed to, uint256 value)");
type Receipt = Pick<TransactionReceipt, "status" | "blockNumber" | "logs">;
function checkPaymentReceipts(e: SuspectedLoss, attack: Receipt, reference: Receipt, loss: Receipt): Verification {
  const poisoning = checkReceipts(lossEvidence(e), attack, reference);
  if (!poisoning.ok) return poisoning;
  const planting = attack.logs.find(log => log.logIndex === e.attackLogIndex && log.address.toLowerCase() === e.attackToken.toLowerCase());
  if (!planting) return { ok: false, reason: "planting log index does not match" };
  try {
    const { args } = decodeEventLog({ abi: [transfer], data: planting.data, topics: planting.topics });
    const matches = e.variant === "zero-value" ? args.from.toLowerCase() === e.victim.toLowerCase() && args.to.toLowerCase() === e.lookalike.toLowerCase() && args.value === 0n : args.from.toLowerCase() === e.lookalike.toLowerCase() && args.to.toLowerCase() === e.victim.toLowerCase() && args.value > 0n && args.value < 1_000_000n;
    if (!matches) return { ok: false, reason: "planting log does not match the incident" };
  } catch { return { ok: false, reason: "planting event cannot be decoded" }; }
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

export function checkLossReceipts(e: SuspectedLoss, attack: Receipt, reference: Receipt, loss: Receipt): Verification {
  // This call checks one payment's reference/planting context. Additional contexts are fetched separately.
  if (e.additionalPayments.length) return { ok: false, reason: "Check each payment context separately" };
  return checkPaymentReceipts(e, attack, reference, loss);
}
