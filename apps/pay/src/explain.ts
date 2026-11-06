import { explainCall, resemblingPayees, type Explanation, type VerdictV2 } from "@hexfence/shared";
import { VerdictCard } from "@hexfence/ui";
import { getAddress, isAddress, type Address, type Hex } from "viem";
import { SEPOLIA_CHAIN_ID } from "./config";
import type { SafeInfo } from "./safe";
import { paymentVerdict, paymentVerdictText } from "./upgrade";
import type { Lang } from "./verdictCopy";

export interface ExplainView {
  /** Exactly what Pay would show for this call without the explain layer. The explanation never changes it. */
  verdict: VerdictV2;
  explanation: Explanation | null;
  /** Extra warnings from the explanation. They can only add risk, never remove it. */
  warnings: string[];
}

/** Parse pasted text as one ERC-7730 descriptor or an array of them. Throws a readable error for anything else. */
export function parseDescriptors(text: string): unknown[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("The descriptor is not valid JSON.");
  }
  const list = Array.isArray(parsed) ? parsed : [parsed];
  if (list.length === 0 || list.some((d) => typeof d !== "object" || d === null)) throw new Error("Paste an ERC-7730 descriptor (a JSON object) or an array of them.");
  return list;
}

export function explainView(call: { to: Address; value: bigint; data: Hex }, info: SafeInfo, v1Guard: Address, descriptors: unknown[]): ExplainView {
  const safeCall = { ...call, operation: 0 as const };
  const verdict = paymentVerdict(safeCall, info, v1Guard);
  const explanation = explainCall(safeCall, SEPOLIA_CHAIN_ID, descriptors);
  const known = info.v2 ? info.v2.known.map((k) => k.recipient) : [];
  const warnings = explanation
    ? resemblingPayees(explanation, [...info.payees, ...known]).map(
        (r) => `${r.label} ${r.address} resembles your approved payee ${r.payee} (same first 4 and last 4 characters) but is a different address. HexFence Guard does not check this call type, so it will not stop it.`,
      )
    : [];
  return { verdict, explanation, warnings };
}

export function explainPanel(info: SafeInfo, v1Guard: Address, lang: Lang, publisher?: string): HTMLElement {
  const box = document.createElement("details");
  const summary = document.createElement("summary");
  summary.textContent = "Explain another call (ERC-7730)";
  const intro = document.createElement("p");
  intro.className = "small";
  intro.textContent = "Paste an ERC-7730 descriptor for a contract, then the call. The descriptor only explains the call. It can never lower a risk level, and nothing is sent anywhere.";
  const make = (tag: "input" | "textarea", id: string, label: string, placeholder: string) => {
    const l = document.createElement("label");
    l.htmlFor = id;
    l.textContent = label;
    const f = document.createElement(tag);
    f.id = id;
    f.placeholder = placeholder;
    f.spellcheck = false;
    if (f instanceof HTMLTextAreaElement) f.rows = 8;
    return [l, f] as const;
  };
  const [dl, desc] = make("textarea", "descriptor", "ERC-7730 descriptor (JSON)", "{ \"context\": { \"contract\": { \"deployments\": [...] } }, \"display\": { \"formats\": {...} } }");
  const [tl, to] = make("input", "explain-to", "Contract the call goes to", "Contract address (0x…)");
  const [cl, data] = make("input", "explain-data", "Call data", "0x…");
  const run = document.createElement("button");
  run.textContent = "Explain call";
  const out = document.createElement("div");
  out.setAttribute("aria-live", "polite");
  run.onclick = () => {
    out.replaceChildren();
    try {
      if (!isAddress(to.value.trim(), { strict: false })) throw new Error("Enter the contract address.");
      const hex = data.value.trim();
      if (!/^0x([0-9a-fA-F]{2})*$/.test(hex)) throw new Error("Call data must be 0x followed by whole bytes of hex.");
      const view = explainView({ to: getAddress(to.value.trim()), value: 0n, data: hex as Hex }, info, v1Guard, parseDescriptors(desc.value));
      out.append(...renderView(view, info, lang, publisher));
    } catch (e) {
      const err = document.createElement("div");
      err.className = "error";
      err.textContent = e instanceof Error ? e.message : String(e);
      out.append(err);
    }
  };
  box.append(summary, intro, dl, desc, tl, to, cl, data, run, out);
  return box;
}

function renderView(view: ExplainView, info: SafeInfo, lang: Lang, publisher?: string): HTMLElement[] {
  const text = paymentVerdictText(view.verdict, { guardActive: info.guard.active, publisher, lang }, info);
  const card = VerdictCard(view.verdict.level);
  const label = document.createElement("strong");
  label.textContent = view.verdict.level === "GREY" ? "CANNOT VERIFY" : view.verdict.level;
  card.append(label);
  for (const s of text.sentences) {
    const p = document.createElement("p");
    p.textContent = s;
    card.append(p);
  }
  const rest: HTMLElement[] = [card];
  const note = (cls: string, s: string) => {
    const p = document.createElement(cls === "error" ? "div" : "p");
    p.className = cls;
    p.textContent = s;
    rest.push(p);
  };
  const e = view.explanation;
  if (!e) {
    note("small", "No descriptor you pasted describes this call, so HexFence cannot explain it.");
    return rest;
  }
  note("small", `Described by your descriptor${e.contractName ? ` (${e.contractName})` : ""}. The wording comes from the descriptor you pasted, not from HexFence: ${e.text}`);
  const list = document.createElement("ul");
  for (const f of e.fields) {
    const li = document.createElement("li");
    li.textContent = `${f.label}: ${f.value}`;
    list.append(li);
  }
  rest.push(list);
  for (const w of view.warnings) note("error", w);
  return rest;
}
