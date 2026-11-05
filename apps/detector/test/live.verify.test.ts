import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createPublicClient, decodeEventLog, http, type Hex } from "viem";
import { mainnet } from "viem/chains";
import { describe, expect, it } from "vitest";
import { ONE_TOKEN } from "../src/detect.js";
import { TRANSFER_EVENT } from "../src/fetch.js";
import { readEvidence } from "../src/jsonl.js";

// Functional check of a real run: re-fetch the receipts of a random sample of records from
// out/evidence.jsonl and confirm each one independently. Opt-in (needs the network and a real run):
//   DETECTOR_LIVE=1 MAINNET_RPC_URL=... pnpm --filter @hexfence/detector test
const OUT = fileURLToPath(new URL("../out/evidence.jsonl", import.meta.url));
const live = process.env.DETECTOR_LIVE === "1" && !!process.env.MAINNET_RPC_URL && existsSync(OUT);
const SAMPLE = Number(process.env.DETECTOR_SAMPLE ?? 30);

describe.skipIf(!live)("real run: records match mainnet receipts", () => {
  it(`a random sample of ${SAMPLE} records is confirmed on Ethereum`, async () => {
    const client = createPublicClient({ chain: mainnet, transport: http(process.env.MAINNET_RPC_URL, { retryCount: 3 }) });
    const all = readEvidence(OUT);
    const sample = [...all].sort(() => Math.random() - 0.5).slice(0, SAMPLE);

    const transfers = async (hash: Hex) => {
      const r = await client.getTransactionReceipt({ hash });
      expect(r.status).toBe("success");
      return r.logs.flatMap((l) => {
        try {
          const d = decodeEventLog({ abi: [TRANSFER_EVENT], data: l.data, topics: l.topics });
          return [{ token: l.address.toLowerCase(), from: d.args.from.toLowerCase(), to: d.args.to.toLowerCase(), value: d.args.value, block: Number(r.blockNumber) }];
        } catch {
          return [];
        }
      });
    };

    for (const e of sample) {
      const lc = (a: string) => a.toLowerCase();
      // The attack: the variant's transfer of the canonical token, in the recorded block.
      const attack = await transfers(e.attackTx);
      const hit = attack.find((t) =>
        t.token === lc(e.token) &&
        (e.variant === "zero-value"
          ? t.from === lc(e.victim) && t.to === lc(e.lookalike) && t.value === 0n
          : t.from === lc(e.lookalike) && t.to === lc(e.victim) && t.value > 0n && t.value < ONE_TOKEN),
      );
      expect(hit, `attack ${e.attackTx}`).toBeDefined();
      expect(hit!.block).toBe(e.attackBlock);
      // The reference: the victim's real payment (>= 1 token) to the impersonated address, earlier.
      const reference = await transfers(e.referenceTx);
      const ref = reference.find((t) => t.from === lc(e.victim) && t.to === lc(e.impersonated) && t.value >= ONE_TOKEN);
      expect(ref, `reference ${e.referenceTx}`).toBeDefined();
      expect(ref!.block).toBe(e.referenceBlock);
      expect(ref!.block).toBeLessThanOrEqual(e.attackBlock);
    }
    console.log(`confirmed ${sample.length} of ${all.length} records on mainnet`);
  }, 300_000);
});
