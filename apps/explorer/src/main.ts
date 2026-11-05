import { arkivReadClient, findEvidenceByAddress } from "@hexfence/arkiv";
import { isAddress, type Address, type Hex } from "viem";
import { countByVariant, fetchEvidencePage } from "./evidence.js";
import { EVIDENCE_LABEL, parseSearch } from "./format.js";
import { el, recordCard } from "./render.js";
import "./style.css";

const app = document.querySelector<HTMLElement>("#app")!;
const publisherEnv = (import.meta.env.VITE_ARKIV_PUBLISHER as string | undefined)?.trim() ?? "";

const counts = el("section", "counts", "Loading counts…");
const status = el("p", "status");
const results = el("section", "results");
const more = el("button", "more", "Load more") as HTMLButtonElement;
more.type = "button";
more.hidden = true;
const input = el("input") as HTMLInputElement;
input.placeholder = "Search by address: lookalike, impersonated or victim";
input.spellcheck = false;
input.setAttribute("aria-label", "Address to search");
const submit = el("button", undefined, "Search") as HTMLButtonElement;
const clear = el("button", "ghost", "Show all") as HTMLButtonElement;
clear.type = "button";
const form = el("form", "search", input, submit, clear) as HTMLFormElement;

app.append(
  el("h1", undefined, "HexFence evidence explorer"),
  el("p", "label", EVIDENCE_LABEL),
  el(
    "p",
    "intro",
    "Address-poisoning patterns the HexFence detector found in Ethereum mainnet USDT and USDC transfers, read directly from Arkiv in your browser. ",
    "A record is a suspected pattern, not a finding about any person.",
  ),
);

function fail(where: string, err: unknown): void {
  status.className = "status error";
  status.textContent = `${where}: ${err instanceof Error ? err.message : String(err)}`;
}

if (!isAddress(publisherEnv, { strict: false })) {
  app.append(el("p", "status error", "VITE_ARKIV_PUBLISHER is not set to an address, so no evidence can be loaded."));
} else {
  const publisher = publisherEnv as Address;
  const accessKey = (import.meta.env.VITE_ARKIV_ACCESS_KEY as string | undefined)?.trim();
  const client = arkivReadClient(accessKey ? { accessKey } : undefined);
  app.append(el("p", "publisher", `Publisher ${publisher}`), counts, form, status, results, more);

  // A slow answer to an earlier action must not overwrite a newer one.
  let generation = 0;
  let nextKey: Hex | undefined;

  async function loadPage(gen: number): Promise<void> {
    more.disabled = true;
    try {
      const page = await fetchEvidencePage(client, publisher, nextKey);
      if (gen !== generation) return;
      results.append(...page.records.map(recordCard));
      nextKey = page.nextKey;
      more.hidden = !nextKey;
      const shown = results.childElementCount;
      status.className = "status";
      status.textContent = shown === 0 ? "This publisher has no records on Arkiv yet." : `Showing ${shown} records.`;
    } catch (err) {
      if (gen === generation) fail("Could not read Arkiv", err);
    } finally {
      more.disabled = false;
    }
  }

  function showAll(): void {
    const gen = ++generation;
    nextKey = undefined;
    results.replaceChildren();
    more.hidden = true;
    status.className = "status";
    status.textContent = "Reading Arkiv…";
    void loadPage(gen);
  }

  more.addEventListener("click", () => void loadPage(generation));
  clear.addEventListener("click", () => {
    input.value = "";
    showAll();
  });

  form.addEventListener("submit", (ev) => {
    ev.preventDefault();
    if (input.value.trim() === "") return showAll();
    const address = parseSearch(input.value);
    if (!address) {
      status.className = "status error";
      status.textContent = "That is not an Ethereum address.";
      return;
    }
    const gen = ++generation;
    results.replaceChildren();
    more.hidden = true;
    status.className = "status";
    status.textContent = "Searching Arkiv…";
    findEvidenceByAddress(client, publisher, address)
      .then((records) => {
        if (gen !== generation) return;
        results.append(...records.map(recordCard));
        status.textContent =
          records.length === 0
            ? "No records from this publisher mention this address. That does not show the address is harmless."
            : `${records.length} records mention ${address}.`;
      })
      .catch((err: unknown) => {
        if (gen === generation) fail("Could not search Arkiv", err);
      });
  });

  countByVariant(client, publisher)
    .then(({ zeroValue, dust }) => {
      const tile = (label: string, n: bigint) => el("div", "tile", el("strong", undefined, n.toLocaleString("en-US")), label);
      counts.replaceChildren(tile("suspected records", zeroValue + dust), tile("zero-value", zeroValue), tile("dust", dust));
    })
    .catch((err: unknown) => {
      counts.textContent = `Counts unavailable: ${err instanceof Error ? err.message : String(err)}`;
    });

  showAll();
}
