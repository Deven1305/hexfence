import { AddressXray, DataTable, EmptyState, StatTile } from "@hexfence/ui";
import { fetchAllLosses, type ArkivReadClient } from "@hexfence/arkiv";
import { MAINNET_USDT, MAINNET_USDC, LossRunSchema, rescuePackBody, type SuspectedLoss } from "@hexfence/shared";
import { createPublicClient, http, formatUnits, parseAbi, type Address } from "viem";
import { mainnet } from "viem/chains";
import { el } from "./render.js";
import { checkLossReceipts } from "./lossVerify.js";

export async function sha256(text: string): Promise<string> {
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)))].map(b => b.toString(16).padStart(2, "0")).join("");
}
export function downloadText(name: string, body: string) {
  const url = URL.createObjectURL(new Blob([body], { type: "text/markdown;charset=utf-8" }));
  const a = document.createElement("a"); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const symbol = (token: string) => token.toLowerCase() === MAINNET_USDT.toLowerCase() ? "USDT" : "USDC";
const button = (text: string) => { const b = el("button", undefined, text) as HTMLButtonElement; b.type = "button"; return b; };

function lossDetail(e: SuspectedLoss, rpcUrl?: string): HTMLElement {
  const panel = el("article", "card", el("p", "label", "Suspected · investigative lead"), AddressXray(e.impersonated, e.lookalike, "Impersonated"), AddressXray(e.lookalike, e.impersonated, "Lookalike"));
  const tx = el("a", undefined, "Loss receipt on Ethereum") as HTMLAnchorElement; tx.href = `https://etherscan.io/tx/${e.lossTx}`; tx.target = "_blank"; tx.rel = "noreferrer";
  const verification = el("p", "status", "Receipt check: not run.");
  const balanceStatus = el("p", "status", "Current token balance: not requested.");
  let balanceSnapshot: string | undefined; let verificationSnapshot = "Receipt check: not run.";
  const verify = button("Check incident receipts");
  verify.disabled = !rpcUrl;
  verify.onclick = () => {
    verify.disabled = true; verification.textContent = "Checking reference, planting and loss receipts…";
    const client = createPublicClient({ chain: mainnet, transport: http(rpcUrl) });
    void (async () => {
      const attack = await client.getTransactionReceipt({ hash: e.attackTx });
      const reference = await client.getTransactionReceipt({ hash: e.referenceTx });
      const loss = await client.getTransactionReceipt({ hash: e.lossTx });
      const result = checkLossReceipts(e, attack, reference, loss);
      verificationSnapshot = `${new Date().toISOString()}: ${result.ok ? "Receipt patterns match the recorded incident. Status remains suspected." : `Could not verify: ${result.reason}`}`;
      verification.textContent = verificationSnapshot;
    })().catch(() => { verificationSnapshot = "Could not verify the incident receipts."; verification.textContent = verificationSnapshot; }).finally(() => { verify.disabled = false; });
  };
  const balance = button("Read balance still at lookalike"); balance.disabled = !rpcUrl;
  balance.onclick = () => {
    balance.disabled = true; balanceStatus.textContent = "Reading current token balance…";
    const client = createPublicClient({ chain: mainnet, transport: http(rpcUrl, { retryCount: 0 }) });
    // The sole address-specific exception: exactly one user-clicked balanceOf, never a background poll.
    void client.readContract({ address: e.token, abi: parseAbi(["function balanceOf(address) view returns (uint256)"]), functionName: "balanceOf", args: [e.lookalike] }).then(value => {
      balanceSnapshot = `${new Date().toISOString()}: Still at the lookalike now: ${formatUnits(value, 6)} ${symbol(e.token)} (${value} base units). This is a current holding, not attribution to this payment.`;
      balanceStatus.textContent = balanceSnapshot;
    }).catch(() => { balanceStatus.textContent = "Current balance could not be read. Click to retry."; balance.disabled = false; });
  };
  const pack = button("Download Rescue pack"); const digest = el("p", "status");
  pack.onclick = () => {
    pack.disabled = true;
    void (async () => {
      const body = rescuePackBody(e); const hash = await sha256(body);
      if (hash !== e.packHash) throw new Error("Pack digest differs from Arkiv; download refused.");
      downloadText(`hexfence-${e.lossTx}-core.md`, body);
      digest.textContent = `Core SHA-256 matches Arkiv packHash: ${hash}`;
    })().catch(() => { digest.textContent = "Pack integrity check failed; no download created."; }).finally(() => { pack.disabled = false; });
  };
  const supplement = button("Download dated supplement");
  supplement.onclick = () => {
    const body = `# HexFence Rescue supplement\n\nStatus: suspected. Investigative lead for human review.\nCore packHash: ${e.packHash}\nLoss transaction: https://etherscan.io/tx/${e.lossTx}\n\n${verificationSnapshot}\n\n${balanceSnapshot ?? "Current balance: not requested."}\n\nThis dated supplement is local and is not the core hashed on Arkiv.\n`;
    downloadText(`hexfence-${e.lossTx}-supplement.md`, body);
  };
  panel.append(tx, el("p", undefined, `Payment ${e.repeat} in this scan · ${formatUnits(BigInt(e.amount), 6)} ${symbol(e.token)}`), verify, verification, balance, balanceStatus, pack, supplement, digest);
  return panel;
}

export function lossesPanel(client: ArkivReadClient, publisher: Address, rpcUrl?: string): HTMLElement {
  const root = el("section", "losses-panel");
  const status = el("p", "status", "Reading published suspected losses…"); root.append(el("h2", undefined, "Rescue · suspected losses"), status);
  const retry = button("Retry loss records"); retry.hidden = true; root.append(retry);
  const body = el("div"); root.append(body);
  let loading = false;
  const load = async () => {
    if (loading) return; loading = true; retry.hidden = true;
    try {
      const records = await fetchAllLosses(client, publisher);
      records.sort((a, b) => BigInt(a.amount) > BigInt(b.amount) ? -1 : BigInt(a.amount) < BigInt(b.amount) ? 1 : a.lossTx.localeCompare(b.lossTx));
      body.replaceChildren();
      // A static scan manifest is generated by the real scanner, never hand-entered.
      try {
        const response = await fetch("./loss-run.json"); if (!response.ok) throw new Error("No scan manifest");
        const data = LossRunSchema.parse(await response.json());
        const heading = el("h3", undefined, "Suspected value sent to lookalikes in the scanned window");
        const stats = el("div", "loss-stats");
        for (const t of data.totals) {
          if (![MAINNET_USDT.toLowerCase(), MAINNET_USDC.toLowerCase()].includes(t.token.toLowerCase()) || !/^\d+$/.test(t.amount)) throw new Error("Invalid token total");
          stats.append(StatTile(symbol(t.token), formatUnits(BigInt(t.amount), 6)));
        }
        body.append(heading, el("p", "status", `${data.lossTransactions} suspected loss transactions · Ethereum blocks ${data.fromBlock}–${data.toBlock} · scan completed ${data.completedAt}`), stats);
      } catch { /* Published record totals below remain usable without a scan manifest. */ }
      const totals = new Map<string, bigint>(); for (const r of records) totals.set(symbol(r.token), (totals.get(symbol(r.token)) ?? 0n) + BigInt(r.amount));
      body.append(el("p", "status", `Published records loaded: ${records.length}. ` + [...totals].map(([token, amount]) => `${formatUnits(amount, 6)} ${token}`).join(" · ")));
      if (!records.length) body.append(EmptyState("No published suspected loss records loaded."));
      else body.append(DataTable(["Amount", "Token", "Victim", "Lookalike", "Block", "Payment"], records.map(e => [formatUnits(BigInt(e.amount), 6), symbol(e.token), `${e.victim.slice(0, 6)}…${e.victim.slice(-4)}`, `${e.lookalike.slice(0, 6)}…${e.lookalike.slice(-4)}`, String(e.lossBlock), String(e.repeat)]), records.map(e => lossDetail(e, rpcUrl))));
      status.textContent = "Publisher loss records loaded in bulk. Every record is suspected; Rescue data is an investigative lead.";
    } catch { status.textContent = "Published loss records could not be loaded."; retry.hidden = false; }
    finally { loading = false; }
  };
  retry.onclick = () => void load(); void load(); return root;
}
