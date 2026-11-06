import { AddressXray, StatTile } from "@hexfence/ui";
import "@hexfence/ui/style.css";
import { isAddress, type Address } from "viem";

// These two published demo addresses are a synthetic Sepolia example, not evidence.
const p = "0x4E185e251Ac7fB83E9DE10723EAda46cadE74120";
const l = "0x4E185a3FC4B530244aB9ed0dE38167b403344120";
document.querySelector("#hero-xray")?.append(AddressXray(p, l, "Approved payee"), AddressXray(l, p, "Resembles your approved payee · synthetic Sepolia example"));
const strip = document.querySelector<HTMLElement>("#live-stats")!;
const publisher = import.meta.env.VITE_ARKIV_PUBLISHER;
if (publisher && isAddress(publisher, { strict: false })) {
  strip.textContent = "Reading published evidence…";
  void import("@hexfence/arkiv").then(async ({ arkivReadClient, fetchAllEvidence }) => {
    const records = await fetchAllEvidence(arkivReadClient({ accessKey: import.meta.env.VITE_ARKIV_ACCESS_KEY || undefined }), publisher as Address);
    strip.replaceChildren(StatTile("Published suspected records", String(records.length)),
      StatTile("Victims mentioned", String(new Set(records.map(e => e.victim.toLowerCase())).size)),
      StatTile("Lookalikes mentioned", String(new Set(records.map(e => e.lookalike.toLowerCase())).size)));
  }).catch(() => { strip.textContent = "Published evidence could not be loaded. Open the explorer to retry."; });
}
