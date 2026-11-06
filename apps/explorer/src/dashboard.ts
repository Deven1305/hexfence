import type { PoisoningEvidence } from "@hexfence/shared";
import { parseSearch, tokenName } from "./format.js";
import { el } from "./render.js";

/** A record has no timestamp. Use block order rather than inventing calendar dates. */
export function aggregateEvidence(records: readonly PoisoningEvidence[]) {
  const unique = [...new Map(records.map((e) => [e.evidenceId.toLowerCase(), e])).values()];
  const variants = new Map<string, number>();
  const tokens = new Map<string, number>();
  const blocks = unique.map((e) => e.attackBlock);
  const first = blocks.reduce((min, block) => Math.min(min, block), blocks[0] ?? 0);
  const last = blocks.reduce((max, block) => Math.max(max, block), blocks[0] ?? 0);
  const width = Math.max(1, Math.ceil((last - first + 1) / 12));
  const timeline: { from: number; to: number; count: number }[] = [];
  for (let from = first; blocks.length && from <= last; from += width)
    timeline.push({ from, to: Math.min(last, from + width - 1), count: 0 });
  for (const e of unique) {
    variants.set(e.variant, (variants.get(e.variant) ?? 0) + 1);
    const token = e.token.toLowerCase();
    tokens.set(token, (tokens.get(token) ?? 0) + 1);
    timeline[Math.floor((e.attackBlock - first) / width)]!.count++;
  }
  return { total: unique.length, variants, tokens, timeline };
}

/** Pure local lookup: exact address equality in any recorded role, never a network call. */
export function checkOwnAddress(records: readonly PoisoningEvidence[], input: string) {
  const address = parseSearch(input);
  if (!address) return null;
  const needle = address.toLowerCase();
  return [...new Map(records
    .filter((e) => [e.lookalike, e.impersonated, e.victim].some((a) => a.toLowerCase() === needle))
    .map((e) => [e.evidenceId.toLowerCase(), e])).values()];
}

function bars(title: string, entries: [string, number][]): HTMLElement {
  const max = Math.max(1, ...entries.map(([, count]) => count));
  const section = el("section", "dashboard-chart", el("h3", undefined, title));
  for (const [label, count] of entries) {
    const fill = el("span", "dashboard-fill");
    fill.style.width = `${100 * count / max}%`;
    section.append(el("div", "dashboard-row", el("span", undefined, label),
      el("span", "dashboard-track", fill), el("strong", undefined, String(count))));
  }
  if (!entries.length) section.append(el("p", undefined, "No downloaded records yet."));
  return section;
}

export function renderDashboard(records: readonly PoisoningEvidence[]): HTMLElement {
  const data = aggregateEvidence(records);
  return el("section", "dashboard",
    el("h2", undefined, "Downloaded evidence"),
    el("p", undefined, `${data.total} suspected records, computed in your browser.`),
    bars("By variant", [...data.variants]),
    bars("By token", [...data.tokens].map(([token, n]) => [tokenName(token), n])),
    el("p", "dashboard-note", "Counts are computed from downloaded publisher records."));
}
