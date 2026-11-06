import { createHash } from "node:crypto";
import { SuspectedLossSchema, rescuePackBody, lossKey, type SuspectedLoss, type PoisoningEvidence } from "@hexfence/shared";
import { PoisoningDetector, DETECTOR_VERSION, ONE_TOKEN, WINDOW_BLOCKS, type TransferLog } from "./detect.js";

type Draft = Omit<SuspectedLoss, "packHash">;
/** One pass over the same bulk token logs; never an address-specific RPC. */
export class LossDetector {
  private readonly detector: PoisoningDetector;
  private readonly attacks = new Map<string, { evidence: PoisoningEvidence; log: TransferLog }>();
  private readonly losses = new Map<string, Draft>();
  private readonly counts = new Map<string, number>();
  private readonly seen = new Set<string>();
  private readonly watched = new Map<string, Map<string, 1 | 2>>();
  private first = Number.MAX_SAFE_INTEGER;
  private last = -1;
  constructor(version = DETECTOR_VERSION) {
    this.detector = new PoisoningDetector(version, (evidence, log) => {
      const key = `${evidence.victim.toLowerCase()}:${evidence.lookalike.toLowerCase()}`;
      const before = this.attacks.get(key);
      if (!before || log.blockNumber - before.log.blockNumber > WINDOW_BLOCKS) this.attacks.set(key, { evidence, log });
    });
  }
  add(logs: readonly TransferLog[]): void {
    for (const log of [...logs].sort((a, b) => a.blockNumber - b.blockNumber || a.logIndex - b.logIndex)) {
      if (log.blockNumber < this.last) throw new Error("LossDetector.add: logs must be in block order");
      const eventKey = `${log.txHash.toLowerCase()}:${log.logIndex}`;
      if (this.seen.has(eventKey)) continue;
      this.seen.add(eventKey);
      this.first = Math.min(this.first, log.blockNumber); this.last = log.blockNumber;
      this.detector.add([log]);
      if (log.value <= 0n) continue;
      // Record public outgoing transfers after the loss; no attribution to specific funds.
      for (const [key, depth] of [...(this.watched.get(log.from.toLowerCase()) ?? [])]) {
        const loss = this.losses.get(key)!;
        if (loss.hops.length >= 20 || log.txHash.toLowerCase() === loss.lossTx.toLowerCase()) continue;
        loss.hops.push({ from: log.from, to: log.to, token: log.token, amount: log.value.toString(), txHash: log.txHash, blockNumber: log.blockNumber, logIndex: log.logIndex, depth });
        if (depth === 1) this.watch(log.to, key, 2);
      }
      if (log.value < ONE_TOKEN) continue;
      const pair = `${log.from.toLowerCase()}:${log.to.toLowerCase()}`;
      const attack = this.attacks.get(pair);
      if (!attack || log.blockNumber - attack.log.blockNumber > WINDOW_BLOCKS) continue;
      if (log.blockNumber === attack.log.blockNumber && log.logIndex <= attack.log.logIndex) continue;
      const e = attack.evidence;
      const key = lossKey({ evidenceId: e.evidenceId, lossTx: log.txHash });
      const existing = this.losses.get(key);
      if (existing) {
        // The plan's entity key is evidenceId+lossTx. Never silently merge different assets/cases.
        if (existing.token.toLowerCase() !== log.token.toLowerCase() || existing.victim.toLowerCase() !== log.from.toLowerCase()) throw new Error("A multi-token or multi-victim loss transaction needs separate manual review; no totals published");
        existing.amount = (BigInt(existing.amount) + log.value).toString(); continue;
      }
      const counterKey = `${pair}:${log.token.toLowerCase()}`;
      const repeat = (this.counts.get(counterKey) ?? 0) + 1; this.counts.set(counterKey, repeat);
      this.losses.set(key, { evidenceId: e.evidenceId, victim: e.victim, lookalike: e.lookalike, impersonated: e.impersonated,
        token: log.token, amount: log.value.toString(), lossTx: log.txHash, lossBlock: log.blockNumber, lossLogIndex: log.logIndex,
        attackTx: e.attackTx, attackBlock: e.attackBlock, attackLogIndex: attack.log.logIndex, attackToken: e.token,
        referenceTx: e.referenceTx, referenceBlock: e.referenceBlock, variant: e.variant, detectorVersion: e.detectorVersion,
        repeat, hops: [], status: "suspected", scanFromBlock: this.first, scanToBlock: this.last });
      this.watch(e.lookalike, key, 1);
    }
  }
  private watch(address: string, key: string, depth: 1 | 2): void {
    const lc = address.toLowerCase();
    let set = this.watched.get(lc); if (!set) { set = new Map(); this.watched.set(lc, set); }
    const previous = set.get(key); set.set(key, previous ? Math.min(previous, depth) as 1 | 2 : depth);
  }
  results(from = this.first, to = this.last): Draft[] { return [...this.losses.values()].map(e => ({ ...e, hops: [...e.hops], scanFromBlock: from, scanToBlock: to })); }
  evidence(): PoisoningEvidence[] { return this.detector.results(); }
}


export function sealLoss(draft: Draft): SuspectedLoss {
  const record = SuspectedLossSchema.parse({ ...draft, packHash: "0".repeat(64) });
  record.packHash = createHash("sha256").update(rescuePackBody(record), "utf8").digest("hex");
  return record;
}
