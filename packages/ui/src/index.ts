import { isAddress, keccak256, type Address } from "viem";

export function addressGroups(address: string, compare?: string) {
  if (!isAddress(address, { strict: false }) || (compare && !isAddress(compare, { strict: false }))) throw new Error("Enter a full Ethereum address.");
  const value = address.slice(2);
  return Array.from({ length: 10 }, (_, i) => ({
    text: value.slice(i * 4, i * 4 + 4),
    state: compare ? (value.slice(i * 4, i * 4 + 4).toLowerCase() === compare.slice(2 + i * 4, 6 + i * 4).toLowerCase() ? "match" : "diff") : "plain",
  }));
}

/** Hash the address bytes: checksum casing never changes the colour code. */
export function addressColors(address: Address): string[] {
  if (!isAddress(address, { strict: false })) throw new Error("Enter a full Ethereum address.");
  const hash = keccak256(address);
  return Array.from({ length: 8 }, (_, i) => `#${hash.slice(2 + i * 6, 8 + i * 6)}`);
}

export function AddressXray(address: Address, compare?: Address, label = "Address"): HTMLElement {
  const root = document.createElement("div");
  root.className = "hf-xray";
  const title = document.createElement("div"); title.className = "hf-xray-label"; title.textContent = label;
  const code = document.createElement("code"); code.className = "hf-address";
  code.setAttribute("aria-label", `${label}: ${address}`);
  const prefix = document.createElement("span"); prefix.textContent = "0x"; code.append(prefix);
  for (const group of addressGroups(address, compare)) {
    const span = document.createElement("span"); span.className = `hf-${group.state}`; span.textContent = group.text; code.append(span);
  }
  const colors = document.createElement("div"); colors.className = "hf-colors"; colors.setAttribute("aria-hidden", "true");
  for (const color of addressColors(address)) { const tile = document.createElement("i"); tile.style.backgroundColor = color; colors.append(tile); }
  root.append(title, code, colors);
  if (compare) {
    const differences = [...address.slice(2).toLowerCase()].filter((c, i) => c !== compare.slice(2).toLowerCase()[i]).length;
    const count = document.createElement("p"); count.className = "hf-difference-count"; count.textContent = `${differences} of 40 characters differ`; root.append(count);
  }
  if (compare) { const key = document.createElement("small"); key.textContent = "Amber: matching group · Red: different group. Compare the full address."; root.append(key); }
  return root;
}

export function Pill(text: string): HTMLElement { const p = document.createElement("span"); p.className = "hf-pill"; p.textContent = text; return p; }
export function StatTile(label: string, value: string): HTMLElement {
  const p = document.createElement("div"); p.className = "hf-stat";
  const strong = document.createElement("strong"); strong.textContent = value;
  const caption = document.createElement("span"); caption.textContent = label; p.append(strong, caption); return p;
}
export function SafeHeader(address: Address, detail: string): HTMLElement {
  const p = document.createElement("header"); p.className = "hf-safe-header"; p.append(AddressXray(address, undefined, "Safe"), Pill(detail)); return p;
}
export function VerdictCard(level: string): HTMLElement { const p = document.createElement("div"); p.className = `verdict ${level}`; p.setAttribute("role", "status"); return p; }
export function RadarBanner(text: string): HTMLElement { const p = document.createElement("aside"); p.className = "hf-radar"; p.setAttribute("role", "status"); p.textContent = text; return p; }
export function DataTable(headers: string[], rows: (string | Node)[][], details: Node[] = []): HTMLElement {
  const wrap = document.createElement("div"); wrap.className = "hf-table-wrap";
  const table = document.createElement("table"); table.className = "hf-table";
  const head = table.createTHead().insertRow(); for (const label of headers) { const th = document.createElement("th"); th.scope = "col"; th.textContent = label; head.append(th); }
  if (details.length) { const th = document.createElement("th"); th.scope = "col"; th.textContent = "Inspect"; head.append(th); }
  const body = table.createTBody(); rows.forEach((row, i) => {
    const tr = body.insertRow(); for (const value of row) tr.insertCell().append(value);
    const detail = details[i];
    if (detail) {
      const button = document.createElement("button"); button.type = "button"; button.textContent = "X-Ray"; button.setAttribute("aria-expanded", "false");
      tr.insertCell().append(button);
      const expansion = body.insertRow(); expansion.hidden = true;
      const cell = expansion.insertCell(); cell.colSpan = headers.length + 1; cell.append(detail);
      button.onclick = () => { expansion.hidden = !expansion.hidden; button.setAttribute("aria-expanded", String(!expansion.hidden)); };
    }
  });
  wrap.append(table); return wrap;
}

export function EmptyState(text: string): HTMLElement { const p = document.createElement("p"); p.className = "hf-empty"; p.textContent = text; return p; }
