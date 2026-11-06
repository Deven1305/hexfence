import { AddressXray, DataTable, EmptyState, StatTile } from "@hexfence/ui";
import { fetchAllLosses, savedCopyNotice, type PublishedRecords, type ReadSource, type ArkivReadClient } from "@hexfence/arkiv";
import { MAINNET_USDT, MAINNET_USDC, LossRunSchema, lossPayments, lossPaymentOrigin, rescuePackBody, type SuspectedLoss } from "@hexfence/shared";
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
    verify.disabled = true; verification.textContent = "Checking reference, attack and loss receipts…";
    const client = createPublicClient({ chain: mainnet, transport: http(rpcUrl) });
    void (async () => {
      const loss = await client.getTransactionReceipt({ hash: e.lossTx });
      const txData = await client.getTransaction({ hash: e.lossTx });
      let result: { ok: true } | { ok: false; reason: string } = { ok: true };
      for (const payment of lossPayments(e)) {
        if (lossPaymentOrigin(e, payment, txData) !== payment.origin) { result = { ok: false, reason: "Payment calldata does not match the recorded call shape" }; break; }
        const attack = await client.getTransactionReceipt({ hash: payment.attackTx });
        const reference = await client.getTransactionReceipt({ hash: payment.referenceTx });
        result = checkLossReceipts({ ...e, ...payment, additionalPayments: [] }, attack, reference, loss);
        if (!result.ok) break;
      }
      verificationSnapshot = `${new Date().toISOString()}: ${result.ok ? "Receipt patterns match the recorded incident. Status remains suspected." : `Could not verify: ${result.reason}`}`;
      verification.textContent = verificationSnapshot;
    })().catch(() => { verificationSnapshot = "Could not verify the incident receipts."; verification.textContent = verificationSnapshot; }).finally(() => { verify.disabled = false; });
  };
  const snapshots = new Map<string, string>();
  const balanceButtons = [...new Set(lossPayments(e).map(p => p.token))].map(token => {
    const balance = button(`Read ${symbol(token)} balance still at lookalike`); balance.disabled = !rpcUrl;
    balance.onclick = () => {
      balance.disabled = true; balanceStatus.textContent = `Reading current ${symbol(token)} balance…`;
      const client = createPublicClient({ chain: mainnet, transport: http(rpcUrl, { retryCount: 0 }) });
      // Exactly one explicit user-clicked balanceOf for this token; never background polling.
      void client.readContract({ address: token, abi: parseAbi(["function balanceOf(address) view returns (uint256)"]), functionName: "balanceOf", args: [e.lookalike] }).then(value => {
        snapshots.set(token, `${new Date().toISOString()}: Still at the lookalike now: ${formatUnits(value, 6)} ${symbol(token)} (${value} base units). This is a current holding, not attribution to this payment.`);
        balanceSnapshot = [...snapshots.values()].join("\n"); balanceStatus.textContent = balanceSnapshot;
      }).catch(() => { balanceStatus.textContent = "Current balance could not be read. Click to retry."; balance.disabled = false; });
    };
    return balance;
  });
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
  for (const p of lossPayments(e)) panel.append(el("p", undefined, `Victim ${p.victim} · ${formatUnits(BigInt(p.amount), 6)} ${symbol(p.token)} · payment ${p.repeat}`));
  panel.append(tx, el("p", undefined, `Payment ${e.repeat} in this scan · ${formatUnits(BigInt(e.amount), 6)} ${symbol(e.token)}`), verify, verification, ...balanceButtons, balanceStatus, pack, supplement, digest);
  return panel;
}

export function lossesPanel(client: ArkivReadClient, publisher: Address, rpcUrl?: string, readRecords?: () => Promise<PublishedRecords & { source: ReadSource }>): HTMLElement {
  const root = el("section", "losses-panel");
  const status = el("p", "status", "Reading published suspected losses…"); root.append(el("h2", undefined, "Suspected losses"), status);
  const retry = button("Retry loss records"); retry.hidden = true; root.append(retry);
  const body = el("div"); root.append(body);
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  const utc = (iso: string) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? iso : `${d.toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "UTC" })} UTC`; };
  let loading = false;
  const load = async () => {
    if (loading) return; loading = true; retry.hidden = true;
    try {
      const read = readRecords ? await readRecords() : undefined;
      const records = (read ? read.losses : await fetchAllLosses(client, publisher)).filter(r => lossPayments(r).every(p => p.origin !== "unclassified"));
      const amount = (r: SuspectedLoss) => lossPayments(r).reduce((n, p) => BigInt(p.amount) > n ? BigInt(p.amount) : n, 0n);
      records.sort((a, b) => amount(a) > amount(b) ? -1 : amount(a) < amount(b) ? 1 : a.lossTx.localeCompare(b.lossTx));
      body.replaceChildren();
      // A static scan manifest is generated by the real scanner, never hand-entered.
      let manifestShown = false;
      try {
        if (read?.source === "saved") throw new Error("Use totals from the saved copy");
        const response = await fetch("./loss-run.json"); if (!response.ok) throw new Error("No scan manifest");
        const data = LossRunSchema.parse(await response.json());
        const heading = el("h3", undefined, "Suspected value sent to lookalikes in the scanned window");
        const stats = el("div", "loss-stats");
        for (const t of data.totals) {
          if (![MAINNET_USDT.toLowerCase(), MAINNET_USDC.toLowerCase()].includes(t.token.toLowerCase()) || !/^\d+$/.test(t.amount)) throw new Error("Invalid token total");
          stats.append(StatTile(symbol(t.token), formatUnits(BigInt(t.amount), 6)));
        }
        manifestShown = true;
        body.append(heading, el("p", "status", `${plural(data.lossTransactions, "suspected loss transaction", "suspected loss transactions")} · ${plural(data.paymentCases, "payment case", "payment cases")} · Ethereum blocks ${data.fromBlock}–${data.toBlock} · scan completed ${utc(data.completedAt)}`), stats);
      } catch { /* Published record totals below remain usable without a scan manifest. */ }
      const totals = new Map<string, bigint>(); for (const r of records.flatMap(lossPayments)) totals.set(symbol(r.token), (totals.get(symbol(r.token)) ?? 0n) + BigInt(r.amount));
      if (!manifestShown) body.append(el("p", "status", `Published records loaded: ${records.length}. ` + [...totals].map(([token, amount]) => `${formatUnits(amount, 6)} ${token}`).join(" · ")));
      if (!records.length) body.append(EmptyState("No published suspected loss records loaded."));
      else body.append(DataTable(["Amount", "Token", "Victim", "Lookalike", "Block", "Payment"], records.map(e => [lossPayments(e).map(p => formatUnits(BigInt(p.amount), 6)).join(" · "), lossPayments(e).map(p => symbol(p.token)).join(" · "), [...new Set(lossPayments(e).map(p => `${p.victim.slice(0, 6)}…${p.victim.slice(-4)}`))].join(" · "), `${e.lookalike.slice(0, 6)}…${e.lookalike.slice(-4)}`, String(e.lossBlock), lossPayments(e).map(p => String(p.repeat)).join(" · ")]), records.map(e => lossDetail(e, rpcUrl))));
      status.textContent = read?.source === "saved" ? savedCopyNotice(read.readAt) : "Publisher loss records loaded in bulk. Every record is suspected; Rescue data is an investigative lead.";
      status.classList.toggle("saved-copy-notice", read?.source === "saved");
    } catch { status.textContent = "Published loss records could not be loaded."; retry.hidden = false; }
    finally { loading = false; }
  };
  retry.onclick = () => void load(); void load(); return root;
}
