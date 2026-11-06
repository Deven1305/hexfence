import {
  EVMClient, HTTPClient, Runner, TxStatus, bytesToHex, consensusIdenticalAggregation,
  encodeCallMsg, getNetwork, handler, hexToBase64, LAST_FINALIZED_BLOCK_NUMBER,
  ok, protoBigIntToBigint, type EVMLog, type NodeRuntime, type Runtime,
} from "@chainlink/cre-sdk";
import { EVM_PB } from "@chainlink/cre-sdk/pb";
import { decodeFunctionResult, encodeFunctionData, keccak256, padHex, parseAbi, toBytes, zeroAddress, type Address, type Hex } from "viem";
import { z } from "zod";
import { candidates, encodeAlert, resembles } from "./logic";

const address = z.string().regex(/^0x[0-9a-fA-F]{40}$/).refine(x => x !== zeroAddress);
const configSchema = z.object({
  chainSelectorName: z.literal("ethereum-testnet-sepolia"),
  guard: address, guardVersion: z.enum(["v1", "v2"]), alerts: address,
  safes: z.array(address).min(1).max(5),
  tokens: z.array(z.object({ address, decimals: z.number().int().min(0).max(18) })).min(1).max(5),
  telegram: z.object({ enabled: z.boolean(), chatId: z.string() }),
  notificationGapBlocks: z.number().int().nonnegative(),
});
type Config = z.infer<typeof configSchema>;
const guardAbi = parseAbi(["function payees(address) view returns (address[])", "function knownRecipients(address) view returns (address[])"]);
const alertsAbi = parseAbi(["function alertsOf(address) view returns ((address lookalike,address resembles,bytes32 txHash,uint8 variant,uint64 observedBlock)[])"]);
const evmFor = (config: Config) => {
  const network = getNetwork({ chainFamily: "evm", chainSelectorName: config.chainSelectorName, isTestnet: true });
  if (!network) throw Error("Sepolia network unavailable");
  return new EVMClient(network.chainSelector.selector);
};

function notify(node: NodeRuntime<Config>, text: string, token: string): boolean {
  // Never log URL, response body or errors: Telegram embeds its credential in the URL.
  try {
    const response = new HTTPClient().sendRequest(node, {
      url: `https://api.telegram.org/bot${token}/sendMessage`, method: "POST",
      headers: { "Content-Type": "application/json" },
      body: hexToBase64(bytesToHex(new TextEncoder().encode(JSON.stringify({ chat_id: node.config.telegram.chatId, text })))),
      cacheSettings: { store: true, maxAge: "60s" },
    }).result();
    return ok(response);
  } catch { return false; }
}

function onLog(runtime: Runtime<Config>, log: EVMLog): string {
  if (log.removed) return "removed log ignored";
  const cfg = runtime.config;
  if (!log.blockNumber || log.txHash.length !== 32) throw Error("Log missing provenance");
  const token = cfg.tokens.find(t => t.address.toLowerCase() === bytesToHex(log.address).toLowerCase());
  if (!token) return "unconfigured token ignored";
  const evm = evmFor(cfg);
  const found = candidates({ topics: log.topics.map(bytesToHex), data: bytesToHex(log.data) }, cfg.safes as Address[], token.decimals);
  for (const candidate of found) {
    // One bulk list read per Safe, never a per-recipient service lookup.
    const fn = cfg.guardVersion === "v1" ? "payees" : "knownRecipients";
    const read = evm.callContract(runtime, {
      call: encodeCallMsg({ from: zeroAddress, to: cfg.guard as Address, data: encodeFunctionData({ abi: guardAbi, functionName: fn, args: [candidate.safe] }) }),
      blockNumber: LAST_FINALIZED_BLOCK_NUMBER,
    }).result();
    const payees = decodeFunctionResult({ abi: guardAbi, functionName: fn, data: bytesToHex(read.data) });
    const payee = resembles(candidate.lookalike, payees);
    if (!payee) continue;
    const prior = evm.callContract(runtime, {
      call: encodeCallMsg({ from: zeroAddress, to: cfg.alerts as Address, data: encodeFunctionData({ abi: alertsAbi, functionName: "alertsOf", args: [candidate.safe] }) }),
      blockNumber: LAST_FINALIZED_BLOCK_NUMBER,
    }).result();
    const existing = decodeFunctionResult({ abi: alertsAbi, functionName: "alertsOf", data: bytesToHex(prior.data) });
    if (existing.some(a => a.lookalike.toLowerCase() === candidate.lookalike.toLowerCase())) continue;
    const report = runtime.report({
      encodedPayload: hexToBase64(encodeAlert(cfg.alerts as Address, candidate, payee, bytesToHex(log.txHash), protoBigIntToBigint(log.blockNumber))),
      encoderName: "evm", signingAlgo: "ecdsa", hashingAlgo: "keccak256",
    }).result();
    const result = evm.writeReport(runtime, { receiver: cfg.alerts, report, gasConfig: { gasLimit: "500000" } }).result();
    if (result.txStatus !== TxStatus.SUCCESS || result.receiverContractExecutionStatus === EVM_PB.ReceiverContractExecutionStatus.REVERTED)
      throw Error("Alert report delivery failed");
    if (!result.txHash) throw Error("Alert delivery returned no transaction hash");
    runtime.log(`Alert report transaction: ${bytesToHex(result.txHash)}`);
    const newest = existing.reduce((block, a) => a.observedBlock > block ? a.observedBlock : block, 0n);
    if (cfg.telegram.enabled && (newest === 0n || protoBigIntToBigint(log.blockNumber) >= newest + BigInt(cfg.notificationGapBlocks))) {
      const text = `Suspected poisoning pattern: ${candidate.lookalike} resembles ${payee}. Safe ${candidate.safe}. Sepolia transaction ${bytesToHex(log.txHash)}. Advisory only.`;
      const token = runtime.getSecret({ id: "TELEGRAM_BOT_TOKEN" }).result().value;
      const sent = runtime.runInNodeMode(notify, consensusIdenticalAggregation<boolean>())(text, token).result();
      runtime.log(sent ? "Telegram accepted notification" : "Telegram notification failed");
    }
  }
  return "log processed";
}

function initWorkflow(config: Config) {
  const evm = evmFor(config);
  const signature = { values: [hexToBase64(keccak256(toBytes("Transfer(address,address,uint256)")))] };
  const safes = { values: config.safes.map(s => hexToBase64(padHex(s as Hex, { size: 32 }))) };
  const common = { addresses: config.tokens.map(t => hexToBase64(t.address)), confidence: "CONFIDENCE_LEVEL_FINALIZED" as const };
  return [
    handler(evm.logTrigger({ ...common, topics: [signature, safes] }), onLog),
    handler(evm.logTrigger({ ...common, topics: [signature, { values: [] }, safes] }), onLog),
  ];
}
export async function main() {
  const runner = await Runner.newRunner<Config>({ configSchema });
  await runner.run(initWorkflow);
}
