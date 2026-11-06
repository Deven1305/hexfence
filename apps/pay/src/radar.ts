import { AddressXray, RadarBanner } from "@hexfence/ui";
import { parseAbi, type Address, type Hex } from "viem";
import deployment from "../../../sentinel/deployments/sepolia.json";
import type { ReadClient } from "./rpc";
import type { SafeInfo } from "./safe";

export const ALERTS_CONSUMER = deployment.address as Address;
const abi = parseAbi(["function alertsOf(address) view returns ((address lookalike,address resembles,bytes32 txHash,uint8 variant,uint64 observedBlock)[])"]);
export interface RadarAlert { lookalike: Address; resembles: Address; txHash: Hex; variant: number; observedBlock: bigint }
export type RadarState = { status: "ok"; alerts: readonly RadarAlert[] } | { status: "unavailable" };
export async function readRadar(reads: ReadClient, safe: Address): Promise<RadarState> {
  try {
    const alerts = await reads.readContract({ address: ALERTS_CONSUMER, abi, functionName: "alertsOf", args: [safe] });
    return { status: "ok", alerts };
  } catch { return { status: "unavailable" }; }
}
export function radarSummary(result: RadarState): string {
  if (result.status === "unavailable") return "Sentinel simulation alerts unavailable. Guard enforcement is independent of alerts.";
  if (!result.alerts.length) return "Sentinel simulation: no alerts returned for this Safe.";
  return `Sentinel simulation: ${result.alerts.length} alert(s). Public mock forwarder; advisory reports only.`;
}
const requests = new WeakMap<SafeInfo, Promise<RadarState>>();
/** Uses the same read client/Nox route, one bulk read per loaded Safe snapshot. */
export function radarPanel(reads: ReadClient, info: SafeInfo): HTMLElement {
  const root = RadarBanner("Loading Sentinel simulation alerts...");
  let request = requests.get(info);
  if (!request) { request = readRadar(reads, info.address); requests.set(info, request); }
  void request.then(result => {
    root.textContent = radarSummary(result);
    if (result.status !== "ok") return;
    for (const alert of [...result.alerts].reverse()) {
      const detail = document.createElement("details");
      const summary = document.createElement("summary");
      summary.textContent = `Inspect simulation alert: ${alert.lookalike}`;
      summary.style.overflowWrap = "anywhere";
      const text = document.createElement("p");
      text.textContent = `${alert.lookalike} resembles ${alert.resembles}. This advisory report does not establish an attack or current Guard enforcement.`;
      text.style.overflowWrap = "anywhere";
      const link = document.createElement("a");
      link.href = `https://sepolia.etherscan.io/tx/${alert.txHash}`;
      link.target = "_blank"; link.rel = "noopener noreferrer"; link.textContent = "Sepolia trigger transaction";
      detail.append(summary, text, AddressXray(alert.lookalike, alert.resembles, "Alert address"), AddressXray(alert.resembles, alert.lookalike, "Resembles"), link);
      root.append(detail);
    }
  });
  return root;
}
