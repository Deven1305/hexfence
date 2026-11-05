import type { PoisoningEvidence } from "@hexfence/shared";
import { EVIDENCE_LABEL, etherscanAddress, etherscanTx, splitAddress, tokenName, variantText } from "./format.js";
import { mainnetReader, verificationText, verifyOnEthereum } from "./verify.js";

type Child = Node | string;

/** Text always goes through text nodes, so a record can't inject markup. */
export function el(tag: string, className?: string, ...children: Child[]): HTMLElement {
  const node = document.createElement(tag);
  if (className) node.className = className;
  node.append(...children);
  return node;
}

function link(href: string, text: string): HTMLElement {
  const a = el("a", undefined, text) as HTMLAnchorElement;
  a.href = href;
  a.target = "_blank";
  a.rel = "noreferrer noopener";
  return a;
}

function addressRow(label: string, address: string, match?: { prefixLen: number; suffixLen: number }): HTMLElement {
  const anchor = el("a", "addr") as HTMLAnchorElement;
  anchor.href = etherscanAddress(address);
  anchor.target = "_blank";
  anchor.rel = "noreferrer noopener";
  if (match) {
    const p = splitAddress(address, match.prefixLen, match.suffixLen);
    anchor.append(p.prefix, el("mark", undefined, p.head), p.middle, el("mark", undefined, p.tail));
  } else {
    anchor.append(address);
  }
  return el("div", "row", el("span", "key", label), anchor);
}

/** "Verify on Ethereum": the receipts are fetched only when the user asks. */
function verifyControl(e: PoisoningEvidence, rpcUrl: string | undefined): HTMLElement {
  const button = el("button", "ghost", "Verify on Ethereum") as HTMLButtonElement;
  button.type = "button";
  const result = el("span", "verdict");
  button.addEventListener("click", () => {
    if (!rpcUrl) {
      result.className = "verdict bad";
      result.textContent = "could not verify: VITE_MAINNET_RPC_URL is not set";
      return;
    }
    button.disabled = true;
    result.className = "verdict";
    result.textContent = "Fetching receipts…";
    void verifyOnEthereum(mainnetReader(rpcUrl), e).then((v) => {
      button.disabled = false;
      result.className = v.ok ? "verdict good" : "verdict bad";
      result.textContent = verificationText(v);
    });
  });
  return el("div", "verify", button, result);
}

export function recordCard(e: PoisoningEvidence, rpcUrl: string | undefined): HTMLElement {
  const match = { prefixLen: e.prefixLen, suffixLen: e.suffixLen };
  return el(
    "article",
    "card",
    el("p", "label", EVIDENCE_LABEL),
    el("h3", undefined, `${variantText(e.variant)} · ${tokenName(e.token)}`),
    addressRow("Victim", e.victim),
    addressRow("Impersonated", e.impersonated, match),
    addressRow("Lookalike", e.lookalike, match),
    el(
      "div",
      "row",
      el("span", "key", "Attack tx"),
      el("span", undefined, link(etherscanTx(e.attackTx), `${e.attackTx.slice(0, 18)}…`), ` block ${e.attackBlock}`),
    ),
    el(
      "div",
      "row",
      el("span", "key", "Reference tx"),
      el("span", undefined, link(etherscanTx(e.referenceTx), `${e.referenceTx.slice(0, 18)}…`), ` block ${e.referenceBlock}`),
    ),
    verifyControl(e, rpcUrl),
  );
}
