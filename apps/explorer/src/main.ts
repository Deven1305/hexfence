import { lossesPanel } from "./losses.js";
import { DataTable } from "@hexfence/ui";
import "@hexfence/ui/style.css";
﻿import { arkivReadClient } from "@hexfence/arkiv";
import type { PoisoningEvidence } from "@hexfence/shared";
import { isAddress, type Address, type Hex } from "viem";
import { fetchEvidencePage } from "./evidence.js";
import { checkOwnAddress, renderDashboard } from "./dashboard.js";
import { EVIDENCE_LABEL, parseSearch } from "./format.js";
import { el, recordCard } from "./render.js";
import "./style.css";
import "./dashboard.css";

const app = document.querySelector<HTMLElement>("#app")!;
const publisherEnv = (import.meta.env.VITE_ARKIV_PUBLISHER as string | undefined)?.trim() ?? "";
const rpcUrl = (import.meta.env.VITE_MAINNET_RPC_URL as string | undefined)?.trim() || undefined;
const status = el("p", "status bulk-status");
status.setAttribute("role", "status");
const searchStatus = el("p", "status");
const dashboard = el("div");
const results = el("section", "results");
const retry = el("button", "more", "Retry remaining pages") as HTMLButtonElement;
retry.type = "button";
retry.hidden = true;
const input = el("input") as HTMLInputElement;
input.placeholder = "Search by address: lookalike, impersonated or victim";
input.spellcheck = false;
input.setAttribute("aria-label", "Address to search");
const submit = el("button", undefined, "Search") as HTMLButtonElement;
submit.type = "submit";
const clear = el("button", "ghost", "Show all") as HTMLButtonElement;
clear.type = "button";
const form = el("form", "search", input, submit, clear) as HTMLFormElement;

const ownInput = el("input") as HTMLInputElement;
ownInput.placeholder = "0x…";
ownInput.spellcheck = false;
ownInput.setAttribute("aria-label", "My Ethereum address");
const ownSubmit = el("button", undefined, "Check my address") as HTMLButtonElement;
ownSubmit.type = "submit";
const ownResult = el("p");
ownResult.setAttribute("role", "status");
const ownForm = el("form", undefined, ownInput, ownSubmit) as HTMLFormElement;
const ownPanel = el("section", "address-check", el("h2", undefined, "Check my address"),
  el("p", undefined, "Private by design: this check runs in your browser against the downloaded records, so your address never leaves this page."),
  ownForm, ownResult);

app.append(el("h1", undefined, "HexFence evidence explorer"), el("p", "label", EVIDENCE_LABEL),
  el("p", "intro", "Address-poisoning patterns the HexFence detector found in Ethereum mainnet USDT and USDC transfers, read directly from Arkiv in your browser."));

if (!isAddress(publisherEnv, { strict: false })) {
  app.append(el("p", "status error", "VITE_ARKIV_PUBLISHER is not set to an address, so no evidence can be loaded."));
} else {
  const publisher = publisherEnv as Address;
  const accessKey = (import.meta.env.VITE_ARKIV_ACCESS_KEY as string | undefined)?.trim();
  const client = arkivReadClient(accessKey ? { accessKey } : undefined);
  const tabs = el("nav", "hf-tabs"); tabs.setAttribute("aria-label", "Explorer views");
  const tablePanel = el("section");
  const lossPanel = lossesPanel(client, publisher, rpcUrl);
  let view = "Evidence";
  const panels = { Evidence: [form, searchStatus, tablePanel, results], Losses: [lossPanel], Campaigns: [dashboard], "Check my address": [ownPanel] };
  const choose = (name: string) => {
    view = name;
    for (const [label, nodes] of Object.entries(panels)) for (const node of nodes) node.hidden = label !== name;
    for (const b of Array.from(tabs.querySelectorAll("button"))) b.setAttribute("aria-pressed", String(b.textContent === name));
  };
  for (const name of Object.keys(panels)) {
    const b = el("button", undefined, name) as HTMLButtonElement; b.type = "button"; b.onclick = () => choose(name); tabs.append(b);
  }
  app.append(tabs);
  app.append(el("p", "publisher", `Publisher ${publisher}`), status, retry, dashboard, ownPanel, form, searchStatus, tablePanel, results, lossPanel);
  choose(view);
  const downloaded: PoisoningEvidence[] = [];
  const seen = new Set<string>();
  let nextKey: Hex | undefined;
  let complete = false;
  let loading = false;
  let search: Address | undefined;
  let ownChecked = false;

  function updateOwnCheck(): void {
    if (!ownChecked) return;
    const matches = checkOwnAddress(downloaded, ownInput.value);
    ownResult.textContent = matches === null ? "Enter an Ethereum address." :
      `${matches.length} suspected ${matches.length === 1 ? "record mentions" : "records mention"} this address among ${downloaded.length} downloaded records. ` +
      (matches.length === 0 ? "Compare the full address before paying. " : "A match can be in the lookalike, impersonated or victim role. ") +
      (complete ? "Bulk loading complete." : "Bulk loading is incomplete; results may change as pages arrive.");
  }

  function updateSearch(replace = true, added: PoisoningEvidence[] = []): void {
    const records = search ? checkOwnAddress(downloaded, search)! : downloaded;
    tablePanel.replaceChildren(DataTable(["Block", "Pattern", "Token", "Lookalike", "Status"], records.map(e => {
      const address = el("a", undefined, `${e.lookalike.slice(0, 6)}?${e.lookalike.slice(-4)}`) as HTMLAnchorElement;
      address.href = `https://etherscan.io/address/${e.lookalike}`; address.target = "_blank"; address.rel = "noreferrer";
      return [String(e.attackBlock), e.variant, e.token.toLowerCase().startsWith("0xdac1") ? "USDT" : "USDC", address, e.status];
    }), records.map(e => recordCard(e, rpcUrl))));
    results.replaceChildren();
    searchStatus.textContent = search ?
      `${records.length} suspected ${records.length === 1 ? "record mentions" : "records mention"} ${search} among downloaded records. ` +
      (complete ? "" : "More pages are still loading. ") +
      "Compare the full address before paying." : "";
  }

  async function loadAll(): Promise<void> {
    if (loading || complete) return;
    loading = true;
    retry.hidden = true;
    status.className = "status bulk-status";
    status.textContent = `Showing ${downloaded.length} records; reading Arkiv…`;
    try {
      do {
        const page = await fetchEvidencePage(client, publisher, nextKey);
        const added = page.records.filter((e) => {
          const id = e.evidenceId.toLowerCase();
          if (seen.has(id)) return false;
          seen.add(id);
          return true;
        });
        downloaded.push(...added);
        const previous = nextKey;
        nextKey = page.nextKey;
        if (nextKey && previous === nextKey) throw new Error("Arkiv pagination did not advance.");
        complete = nextKey === undefined;
        dashboard.replaceChildren(renderDashboard(downloaded));
        updateSearch(false, added);
        updateOwnCheck();
        status.textContent = `Showing ${downloaded.length} of ${page.total.toString()} publisher records. ` +
          (complete ? "All records loaded." : "Loading next page…");
      } while (!complete);
    } catch {
      status.className = "status error bulk-status";
      status.textContent = `Showing ${downloaded.length} downloaded records. Could not finish reading Arkiv; results and views are incomplete.`;
      retry.hidden = false;
    } finally {
      loading = false;
    }
  }

  ownForm.addEventListener("submit", (ev) => {
    ev.preventDefault();
    ownChecked = true;
    updateOwnCheck();
  });
  ownInput.addEventListener("input", () => { ownChecked = false; ownResult.textContent = ""; });
  form.addEventListener("submit", (ev) => {
    ev.preventDefault();
    if (!input.value.trim()) { search = undefined; updateSearch(); return; }
    const address = parseSearch(input.value);
    if (!address) { searchStatus.textContent = "That is not an Ethereum address."; return; }
    search = address;
    updateSearch();
  });
  clear.addEventListener("click", () => { input.value = ""; search = undefined; updateSearch(); });
  retry.addEventListener("click", () => void loadAll());
  void loadAll();
}
