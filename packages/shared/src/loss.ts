import { z } from "zod";
import { getAddress, isAddress, type Address, type Hex } from "viem";
import { MAINNET_USDC, MAINNET_USDT, PoisoningEvidenceSchema, evidenceId, matchLengths, type PoisoningEvidence } from "./evidence.js";
import { decodeSafeCall, safeCallFromExecTransaction } from "./decoder.js";
import { zeroAddress } from "viem";

export interface LossHop {
  from: Address; to: Address; token: Address; amount: string; txHash: Hex; blockNumber: number; logIndex: number; depth: 1 | 2;
}
export interface LossPayment {
  victim: Address; token: Address; amount: string; lossLogIndex: number;
  attackTx: Hex; attackBlock: number; attackLogIndex: number; attackToken: Address;
  referenceTx: Hex; referenceBlock: number; variant: "zero-value" | "dust"; repeat: number;
  origin: "direct-payment" | "safe-shaped-payment" | "unclassified";
}
export interface SuspectedLoss {
  evidenceId: Hex; victim: Address; lookalike: Address; impersonated: Address;
  token: Address; amount: string; lossTx: Hex; lossBlock: number; lossLogIndex: number;
  attackTx: Hex; attackBlock: number; attackLogIndex: number; attackToken: Address;
  referenceTx: Hex; referenceBlock: number; variant: "zero-value" | "dust";
  detectorVersion: string; repeat: number; hops: LossHop[]; status: "suspected";
  scanFromBlock: number; scanToBlock: number; packHash: string;
  additionalPayments: LossPayment[];
  origin: LossPayment["origin"];
}
const address = z.string().refine(a => isAddress(a, { strict: false })).transform(a => getAddress(a));
const hash = z.string().regex(/^0x[\da-fA-F]{64}$/).transform(s => s.toLowerCase() as Hex);
const integer = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const amount = z.string().max(78).regex(/^[1-9]\d*$/).refine(n => BigInt(n) < 2n ** 256n);
const canonical = (a: string) => [MAINNET_USDC, MAINNET_USDT].some(t => t.toLowerCase() === a.toLowerCase());
const hop = z.object({ from: address, to: address, token: address.refine(canonical), amount, txHash: hash, blockNumber: integer, logIndex: integer, depth: z.union([z.literal(1), z.literal(2)]) }).strict();
const payment = z.object({ victim: address, token: address.refine(canonical), amount: amount.refine(n => BigInt(n) >= 1_000_000n), lossLogIndex: integer,
  attackTx: hash, attackBlock: integer, attackLogIndex: integer, attackToken: address.refine(canonical), referenceTx: hash, referenceBlock: integer,
  variant: z.enum(["zero-value", "dust"]), repeat: integer.refine(n => n >= 1), origin: z.enum(["direct-payment", "safe-shaped-payment", "unclassified"]).default("unclassified"), }).strict();
export const SuspectedLossSchema: z.ZodType<SuspectedLoss> = z.object({
  evidenceId: hash, victim: address, lookalike: address, impersonated: address,
  token: address.refine(canonical), amount: amount.refine(n => BigInt(n) >= 1_000_000n), lossTx: hash, lossBlock: integer, lossLogIndex: integer,
  attackTx: hash, attackBlock: integer, attackLogIndex: integer, attackToken: address.refine(canonical), referenceTx: hash, referenceBlock: integer,
  variant: z.enum(["zero-value", "dust"]), detectorVersion: z.string().min(1), repeat: integer.refine(n => n >= 1),
  hops: z.array(hop).max(20), status: z.literal("suspected"), scanFromBlock: integer, scanToBlock: integer,
  packHash: z.string().regex(/^[a-f0-9]{64}$/),
  additionalPayments: z.array(payment).max(99),
  origin: z.enum(["direct-payment", "safe-shaped-payment", "unclassified"]).default("unclassified"),
}).strict().superRefine((e, ctx) => {
  if (e.evidenceId !== evidenceId(1, e.lookalike, e.impersonated, e.detectorVersion)) ctx.addIssue({ code: "custom", message: "evidenceId mismatch" });
  const seen = new Set<string>();
  for (const p of lossPayments(e)) {
    const unique = `${p.victim.toLowerCase()}:${p.token.toLowerCase()}`;
    if (seen.has(unique)) ctx.addIssue({ code: "custom", message: "duplicate payment case" }); seen.add(unique);
    if (!PoisoningEvidenceSchema.safeParse(lossEvidence({ ...e, ...p })).success) ctx.addIssue({ code: "custom", message: "invalid poisoning context" });
    if (p.attackBlock > e.lossBlock || (p.attackBlock === e.lossBlock && p.attackLogIndex >= p.lossLogIndex)) ctx.addIssue({ code: "custom", message: "loss must follow attack" });
    if (e.scanFromBlock > p.attackBlock || e.scanToBlock < e.lossBlock || e.scanFromBlock > e.scanToBlock) ctx.addIssue({ code: "custom", message: "loss is outside scan" });
  }
});
export function lossPayments(e: Pick<SuspectedLoss, "additionalPayments"> & LossPayment): LossPayment[] { return [e, ...e.additionalPayments]; }
export interface LossTransaction { from: Address; to: Address | null; input: Hex; value: bigint; blockNumber: bigint | null }
/** Check explicit payment calldata. This establishes a supported call shape, never causation. */
export function lossPaymentOrigin(e: Pick<SuspectedLoss, "lookalike" | "lossBlock">, p: LossPayment, tx: LossTransaction): LossPayment["origin"] {
  if (!tx.to || tx.blockNumber !== BigInt(e.lossBlock)) return "unclassified";
  const direct = tx.from.toLowerCase() === p.victim.toLowerCase();
  const throughSafe = tx.to.toLowerCase() === p.victim.toLowerCase();
  const call = direct ? { to: tx.to, value: tx.value, data: tx.input, operation: 0 as const } : throughSafe ? safeCallFromExecTransaction(tx.input) : null;
  if (!call) return "unclassified";
  const decoded = decodeSafeCall(call, { safe: p.victim, guard: zeroAddress });
  if (decoded.kind !== "erc20-transfer" && decoded.kind !== "erc20-transferFrom") return "unclassified";
  if (decoded.token.toLowerCase() !== p.token.toLowerCase() || decoded.recipient.toLowerCase() !== e.lookalike.toLowerCase() || decoded.amount !== BigInt(p.amount)) return "unclassified";
  if (decoded.kind === "erc20-transferFrom" && decoded.from.toLowerCase() !== p.victim.toLowerCase()) return "unclassified";
  return direct ? "direct-payment" : "safe-shaped-payment";
}
export function lossKey(e: Pick<SuspectedLoss, "evidenceId" | "lossTx">): string { return `${e.evidenceId.toLowerCase()}:${e.lossTx.toLowerCase()}`; }
export function lossEvidence(e: Omit<SuspectedLoss, "packHash"> | SuspectedLoss): PoisoningEvidence {
  return { evidenceId: e.evidenceId, chainId: 1, victim: e.victim, lookalike: e.lookalike, impersonated: e.impersonated, token: e.attackToken,
    attackTx: e.attackTx, attackBlock: e.attackBlock, referenceTx: e.referenceTx, referenceBlock: e.referenceBlock,
    variant: e.variant, detectorVersion: e.detectorVersion, ...matchLengths(e.lookalike, e.impersonated), status: "suspected" };
}

/** Stable UTF-8 core: SHA-256 is published separately to avoid a self-referential hash. */
export function rescuePackBody(e: Omit<SuspectedLoss, "packHash"> | SuspectedLoss): string {
  const token = e.token.toLowerCase() === MAINNET_USDT.toLowerCase() ? "USDT" : "USDC";
  return ["# HexFence Rescue pack", "", "Status: suspected. This is an investigative lead, not a finding about a person or proof of causation.", "", "## Incident",
    `Ethereum mainnet (chain 1). Scanned blocks ${e.scanFromBlock}–${e.scanToBlock}.`,
    `Victim address: ${e.victim}`, `Impersonated address: ${e.impersonated}`, `Lookalike address: ${e.lookalike}`,
    `Token: ${token} (${e.token}); amount: ${e.amount} base units (6 decimals).`, `Payment number within the scan: ${e.repeat}. Call shape: ${e.origin === "safe-shaped-payment" ? "execTransaction payment calldata" : e.origin === "direct-payment" ? "direct token payment calldata" : "cannot verify"}.`, "",
    ...e.additionalPayments.flatMap(p => [`Additional payment in this transaction: victim ${p.victim}; token ${p.token}; ${p.amount} base units; payment number ${p.repeat}; first log ${p.lossLogIndex}; call shape ${p.origin === "safe-shaped-payment" ? "execTransaction payment calldata" : p.origin === "direct-payment" ? "direct token payment calldata" : "cannot verify"}.`,
      `Its reference, block ${p.referenceBlock}: https://etherscan.io/tx/${p.referenceTx}`, `Its suspected planting, block ${p.attackBlock}, log ${p.attackLogIndex}: https://etherscan.io/tx/${p.attackTx}`]), "",
    "## Timeline", `Reference payment, block ${e.referenceBlock}: https://etherscan.io/tx/${e.referenceTx}`,
    `Suspected planting, block ${e.attackBlock}, log ${e.attackLogIndex}: https://etherscan.io/tx/${e.attackTx}`,
    `Later payment, block ${e.lossBlock}, first eligible log ${e.lossLogIndex}: https://etherscan.io/tx/${e.lossTx}`, "",
    "## Outgoing transfers observed in the same scan",
    ...(e.hops.length ? e.hops.map(h => `Hop ${h.depth}: ${h.from} → ${h.to}; token ${h.token}, ${h.amount} base units; block ${h.blockNumber}, log ${h.logIndex}: https://etherscan.io/tx/${h.txHash}`) : ["No outgoing transfer was retained in this scanned window."]),
    "These are public outgoing transfers, not an attribution of these particular funds. At most 20 transfers and two hops are retained. No exchange identity is inferred.", "",
    "## Receipt checks and current balance", "Use the explorer's receipt check and the user-requested balance snapshot. Their results belong in the separately dated supplement; this core remains unchanged so its digest matches Arkiv.", "",
    "## Request draft for human review", "Please review this suspected address-poisoning incident and the linked receipts. Please preserve relevant records and assess whether an address freeze or other response is appropriate under your procedures. This is an investigative lead; do not treat an address match as proof of identity.",
    `Token issuer: ${token === "USDT" ? "Tether (https://cs.tether.to/)" : "Circle (https://help.circle.com/)"}. An issuer response is at its discretion.`,
    "If an exchange is independently identified, send the reviewed material through its official compliance channel. Do not infer a deposit owner from a transfer alone.",
    "For India: report promptly through 1930 and https://cybercrime.gov.in/ (NCRP). A human supplies any personal details directly to the authority; none are included here.", "",
    "## Integrity", `Poisoning evidence ID: ${e.evidenceId}`, "The SHA-256 shown by the explorer covers the exact UTF-8 bytes of this core Markdown file, including its final newline. Compare it with packHash on Arkiv. A digest detects edits; it does not validate the allegation.", ""].join("\n");
}


export const LossRunSchema = z.object({
  schema: z.literal("hexfence.loss-run.v1"), chainId: z.literal(1), fromBlock: integer, toBlock: integer,
  logCount: integer, poisoningPairs: integer, lossTransactions: integer, paymentCases: integer,
  totals: z.array(z.object({ token: address.refine(canonical), amount: z.string().max(90).regex(/^\d+$/) })).length(2),
  completedAt: z.iso.datetime(), status: z.literal("suspected"), publication: z.unknown().optional(),
}).refine(r => r.fromBlock <= r.toBlock && new Set(r.totals.map(t => t.token.toLowerCase())).size === 2);
