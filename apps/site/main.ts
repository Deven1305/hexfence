import { AddressXray } from "@hexfence/ui";
import "@hexfence/ui/style.css";
import { isAddress, type Address } from "viem";
import { compactAmount, evidenceStats, exactAmount, lossTotals } from "./stats.js";

// These two published demo addresses are a synthetic Sepolia example, not evidence.
const p = "0x4E185e251Ac7fB83E9DE10723EAda46cadE74120";
const l = "0x4E185a3FC4B530244aB9ed0dE38167b403344120";
document.querySelector("#hero-xray")?.append(AddressXray(p, l, "Resembles your approved payee · synthetic Sepolia example"));

type Tile = { num: Node | string; label: string; note: string };
const grid = document.querySelector<HTMLElement>("#stats")!;
const tileEl = ({ num, label, note }: Tile) => {
  const card = document.createElement("div"); card.className = "card stat";
  const n = document.createElement("p"); n.className = "num"; n.append(num);
  const lab = document.createElement("p"); lab.className = "stat-l"; lab.textContent = label;
  const sub = document.createElement("p"); sub.className = "stat-s"; sub.textContent = note;
  card.append(n, lab, sub); return card;
};
const tiles = {
  records: { label: "Records", note: "suspected poisoning records read from Arkiv" },
  txs: { label: "Attack transactions", note: "distinct Ethereum transactions behind those records" },
  most: { label: "Most victims in one transaction", note: "the largest single attack transaction in the records" },
  loss: { label: "Suspected loss total", note: "payments that reached a lookalike after poisoning, summed from published loss records" },
};
const slots = Object.fromEntries(Object.entries(tiles).map(([k, t]) => [k, tileEl({ num: "…", label: t.label, note: "Reading from Arkiv…" })]));
const put = (k: keyof typeof tiles, num: Node | string, note = tiles[k].note) => slots[k]!.replaceWith(slots[k] = tileEl({ num, label: tiles[k].label, note }));
grid.append(...Object.values(slots));
const unavailable = (k: keyof typeof tiles) => put(k, "Unavailable", "Could not be read from Arkiv. Open the explorer to retry.");

const publisher = import.meta.env.VITE_ARKIV_PUBLISHER;
if (!publisher || !isAddress(publisher, { strict: false })) {
  for (const k of Object.keys(tiles) as (keyof typeof tiles)[]) put(k, "Unavailable", "No evidence publisher is configured for this build.");
} else {
  void import("@hexfence/arkiv").then(async ({ arkivReadClient, fetchAllEvidence, fetchAllLosses }) => {
    const client = arkivReadClient({ accessKey: import.meta.env.VITE_ARKIV_ACCESS_KEY || undefined });
    const who = publisher as Address;
    const evidence = fetchAllEvidence(client, who).then(records => {
      const s = evidenceStats(records);
      put("records", s.records.toLocaleString("en-US")); put("txs", s.attackTxs.toLocaleString("en-US")); put("most", s.mostVictims.toLocaleString("en-US"));
    }).catch(() => { unavailable("records"); unavailable("txs"); unavailable("most"); });
    const losses = fetchAllLosses(client, who).then(rows => {
      const totals = lossTotals(rows);
      if (!totals.length) { put("loss", "None", "No suspected loss records are published."); return; }
      const top = totals[0]!; const num = document.createElement("span");
      num.append(compactAmount(top)); const unit = document.createElement("small"); unit.textContent = top.symbol; num.append(unit);
      put("loss", num, `${tiles.loss.note}. Exact value: ${totals.map(exactAmount).join(" · ")}.`);
    }).catch(() => unavailable("loss"));
    await Promise.all([evidence, losses]);
  }).catch(() => { for (const k of Object.keys(tiles) as (keyof typeof tiles)[]) unavailable(k); });
}
