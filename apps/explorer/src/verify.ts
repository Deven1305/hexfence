import { MAINNET_USDC, MAINNET_USDT, type PoisoningEvidence } from "@hexfence/shared";
import { createPublicClient, decodeEventLog, http, parseAbiItem, type Hex, type TransactionReceipt } from "viem";
import { mainnet } from "viem/chains";

const TRANSFER = parseAbiItem("event Transfer(address indexed from, address indexed to, uint256 value)");
/** Both tokens have 6 decimals: dust is under 1 token, and a reference payment is at least 1 token. */
const ONE_TOKEN = 1_000_000n;

export type Verification = { ok: true } | { ok: false; reason: string };

type Receipt = Pick<TransactionReceipt, "status" | "blockNumber" | "logs">;

interface Transfer {
  token: string;
  from: string;
  to: string;
  value: bigint;
  logIndex: number;
}

const lc = (s: string) => s.toLowerCase();
const canonical = (token: string) => lc(token) === lc(MAINNET_USDT) || lc(token) === lc(MAINNET_USDC);

function transfers(receipt: Receipt): Transfer[] {
  return receipt.logs.flatMap((log) => {
    try {
      const { args } = decodeEventLog({ abi: [TRANSFER], data: log.data, topics: log.topics });
      return [{ token: lc(log.address), from: lc(args.from), to: lc(args.to), value: args.value, logIndex: log.logIndex }];
    } catch {
      return []; // not a Transfer
    }
  });
}

/**
 * Re-checks a record against the two receipts only, trusting nothing else the record claims.
 * Same-block pairs count as earlier when the reference log comes first, which is the order the
 * detector walks logs in.
 */
export function checkReceipts(e: PoisoningEvidence, attack: Receipt, reference: Receipt): Verification {
  if (!canonical(e.token)) return { ok: false, reason: "the record's token is not USDT or USDC" };
  if (attack.status !== "success") return { ok: false, reason: "the attack transaction reverted" };
  if (reference.status !== "success") return { ok: false, reason: "the reference transaction reverted" };

  const victim = lc(e.victim);
  const lookalike = lc(e.lookalike);
  const hit = transfers(attack).find(
    (t) =>
      t.token === lc(e.token) &&
      (e.variant === "zero-value"
        ? t.from === victim && t.to === lookalike && t.value === 0n
        : t.from === lookalike && t.to === victim && t.value > 0n && t.value < ONE_TOKEN),
  );
  if (!hit) return { ok: false, reason: `no matching ${e.variant} Transfer log in the attack transaction` };

  const ref = transfers(reference).find(
    (t) => canonical(t.token) && t.from === victim && t.to === lc(e.impersonated) && t.value >= ONE_TOKEN,
  );
  if (!ref) return { ok: false, reason: "no matching payment to the impersonated address in the reference transaction" };

  if (Number(attack.blockNumber) !== e.attackBlock) return { ok: false, reason: "the attack is not in the recorded block" };
  if (Number(reference.blockNumber) !== e.referenceBlock) return { ok: false, reason: "the reference is not in the recorded block" };

  const earlier =
    reference.blockNumber < attack.blockNumber || (reference.blockNumber === attack.blockNumber && ref.logIndex < hit.logIndex);
  if (!earlier) return { ok: false, reason: "the reference payment is not earlier than the attack" };
  return { ok: true };
}

export interface ReceiptReader {
  getTransactionReceipt(args: { hash: Hex }): Promise<Receipt>;
}

export function mainnetReader(rpcUrl: string): ReceiptReader {
  return createPublicClient({ chain: mainnet, transport: http(rpcUrl) });
}

/** Any failure, including an RPC error, is "could not verify": never a pass, and never a claim the record is wrong. */
export async function verifyOnEthereum(reader: ReceiptReader, e: PoisoningEvidence): Promise<Verification> {
  try {
    const [attack, reference] = await Promise.all([
      reader.getTransactionReceipt({ hash: e.attackTx as Hex }),
      reader.getTransactionReceipt({ hash: e.referenceTx as Hex }),
    ]);
    return checkReceipts(e, attack, reference);
  } catch (err) {
    return { ok: false, reason: `could not read the receipts (${err instanceof Error ? err.message.split("\n")[0] : String(err)})` };
  }
}

export const verificationText = (v: Verification) => (v.ok ? "✓ Both receipts match this record on Ethereum" : `could not verify: ${v.reason}`);
