import { arkivReadClient } from "@hexfence/arkiv";
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
  el("p", undefined, "This check stays in the browser and uses only downloaded records. Your address is not sent to a server. A match is suspected evidence; no match does not show an address is harmless."),
  ownForm, ownResult);

app.append(el("h1", undefined, "HexFence evidence explorer"), el("p", "label", EVIDENCE_LABEL),
  el("p", "intro", "Address-poisoning patterns the HexFence detector found in Ethereum mainnet USDT and USDC transfers, read directly from Arkiv in your browser. A record is a suspected pattern, not a finding about any person."));

if (!isAddress(publisherEnv, { strict: false })) {
  app.append(el("p", "status error", "VITE_ARKIV_PUBLISHER is not set to an address, so no evidence can be loaded."));
} else {
  const publisher = publisherEnv as Address;
  const accessKey = (import.meta.env.VITE_ARKIV_ACCESS_KEY as string | undefined)?.trim();
  const client = arkivReadClient(accessKey ? { accessKey } : undefined);
  app.append(el("p", "publisher", `Publisher ${publisher}`), status, retry, dashboard, ownPanel, form, searchStatus, results);
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
      (matches.length === 0 ? "No match does not show an address is harmless. " : "A match can be in the lookalike, impersonated or victim role. ") +
      (complete ? "Bulk loading complete." : "Bulk loading is incomplete; results may change as pages arrive.");
  }

  function updateSearch(replace = true, added: PoisoningEvidence[] = []): void {
    const records = search ? checkOwnAddress(downloaded, search)! : downloaded;
    if (replace || search) results.replaceChildren(...records.map((e) => recordCard(e, rpcUrl)));
    else results.append(...added.map((e) => recordCard(e, rpcUrl)));
    searchStatus.textContent = search ?
      `${records.length} suspected ${records.length === 1 ? "record mentions" : "records mention"} ${search} among downloaded records. ` +
      (complete ? "" : "More pages are still loading. ") +
      "No match does not show an address is harmless." : "";
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
          (complete ? "Bulk loading complete. Counts reflect downloaded, valid, unique evidence; the publisher total can change or include duplicates." : "Loading next page…");
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
