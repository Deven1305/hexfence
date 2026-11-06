import { evidenceId, MAINNET_USDT } from "../../src/evidence.js";
import { type SuspectedLoss } from "../../src/loss.js";
const p = "0x4E185e251Ac7fB83E9DE10723EAda46cadE74120";
const l = "0x4E185a3FC4B530244aB9ed0dE38167b403344120";
export function lossFixture(): SuspectedLoss {
  const draft: SuspectedLoss = {
    evidenceId: evidenceId(1, l, p, "test"), victim: "0x1111111111111111111111111111111111111111", lookalike: l, impersonated: p,
    token: MAINNET_USDT, attackToken: MAINNET_USDT, amount: "2000000", lossTx: `0x${"ab".repeat(32)}`, lossBlock: 12, lossLogIndex: 0,
    attackTx: `0x${"bc".repeat(32)}`, attackBlock: 11, attackLogIndex: 0, referenceTx: `0x${"cd".repeat(32)}`, referenceBlock: 10,
    origin: "direct-payment", variant: "zero-value", detectorVersion: "test", repeat: 1, additionalPayments: [], hops: [], status: "suspected", scanFromBlock: 10, scanToBlock: 20, packHash: "0".repeat(64),
  };
  return draft;
}
