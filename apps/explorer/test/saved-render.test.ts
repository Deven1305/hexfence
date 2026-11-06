import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { publishedRecordsWithSavedCopy, savedCopyNotice } from "@hexfence/arkiv";
vi.mock("@hexfence/arkiv", async original => ({ ...await original<typeof import("@hexfence/arkiv")>(),
  arkivReadClient: vi.fn(() => ({})), publishedRecordsWithSavedCopy: vi.fn() }));
vi.mock("@hexfence/ui", () => ({ DataTable: () => document.createElement("table") }));
vi.mock("../src/campaigns.js", () => ({ campaignsPanel: () => document.createElement("div") }));
vi.mock("../src/losses.js", () => ({ lossesPanel: () => document.createElement("section") }));
// Small DOM double: tests visibility across the actual main.ts tab handlers, without a network/browser.
class Element {
  children: Array<Element | string> = []; hidden = false; className = ""; value = ""; text = "";
  onclick?: () => void;
  classList = { add: (name: string) => { this.className += " " + name; } };
  constructor(readonly tag: string) {}
  append(...kids: Array<Element | string>) { this.children.push(...kids); }
  replaceChildren(...kids: Array<Element | string>) { this.children = kids; this.text = ""; }
  set textContent(text: string) { this.text = text; this.children = []; }
  get textContent(): string { return this.text + this.children.map(c => typeof c === "string" ? c : c.textContent).join(""); }
  setAttribute() {} addEventListener() {}
  querySelectorAll(selector: string): Element[] {
    const matches = (e: Element) => selector.startsWith(".") ? e.className.split(" ").includes(selector.slice(1)) : e.tag === selector;
    return this.children.flatMap(c => typeof c === "string" ? [] : [...(matches(c) ? [c] : []), ...c.querySelectorAll(selector)]);
  }
  querySelector(selector: string) { return this.querySelectorAll(selector)[0]; }
}
let app: Element;
beforeEach(() => {
  vi.resetModules(); app = new Element("main");
  vi.stubGlobal("document", { createElement: (tag: string) => new Element(tag), querySelector: () => app });
  vi.stubEnv("VITE_ARKIV_PUBLISHER", "0x36141ba063390f0d91Af7a5a9dF8dc1d80D699ec");
  vi.stubEnv("VITE_ARKIV_EXTRA_PUBLISHERS", "");
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
it("keeps the saved notice visible atop every view and removes direct-read wording", async () => {
  const readAt = 1_700_000_000_000;
  vi.mocked(publishedRecordsWithSavedCopy).mockResolvedValue({ evidence: [], losses: [], readAt, source: "saved" });
  await import("../src/main.js");
  await vi.waitFor(() => expect(app.textContent).toContain("from the saved copy"));
  for (const name of ["Evidence", "Losses", "Campaigns", "Check my address"]) {
    app.querySelectorAll("button").find(b => b.textContent === name)!.onclick!();
    const notice = app.querySelector(".saved-copy-notice")!;
    expect(notice.hidden).toBe(false);
    expect(notice.textContent).toBe(savedCopyNotice(readAt));
    expect(app.textContent).not.toContain("read directly from Arkiv in your browser");
    expect(app.textContent).not.toContain("Showing 0 of 0");
  }
});
it("keeps live wording and omits the saved notice on a successful read", async () => {
  vi.mocked(publishedRecordsWithSavedCopy).mockResolvedValue({ evidence: [], losses: [], readAt: Date.now(), source: "live" });
  await import("../src/main.js");
  await vi.waitFor(() => expect(app.textContent).toContain("All records loaded"));
  expect(app.querySelector(".saved-copy-notice")).toBeUndefined();
  expect(app.textContent).toContain("read directly from Arkiv in your browser");
});
