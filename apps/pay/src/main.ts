import { decodeSafeCall, verdictFor, type Verdict } from "@hexfence/shared";
import { connectAnon, routeStatusText, type AnonOutcome } from "./anon";
import { arkivReadClient, fetchAllEvidence } from "@hexfence/arkiv";
import { getAddress, getContract, type Address, type EIP1193Provider, type Hex } from "viem";
import type Safe from "@safe-global/protocol-kit";
import { ConfigError, loadConfig, SEPOLIA_CHAIN_ID, SEPOLIA_EXPLORER, type Config } from "./config";
import { listedStatusText, loadListed, type ListedState } from "./evidence";
import { frictionSatisfied, frictionSuffix, requiresFriction } from "./friction";
import { planFromSimulation, simulateExec } from "./execute";
import { buildPaymentCall, erc20Abi, InputError, parseAddress, parseAmount, type Asset } from "./payment";
import { describeRevert } from "./revert";
import { compositeProvider, createReadClient, type ReadClient } from "./rpc";
import { loadSafeInfo, openSafe, openSafeReadOnly, type SafeInfo } from "./safe";
import {
  buildApprovePayeeCall,
  buildDisableGuardCall,
  buildEnableGuardCall,
  buildRemovePayeeCall,
  checkApprove,
  DISABLE_WARNING,
  enableWarnings,
  removeWarning,
  setupBlocker,
  type SetupCall,
} from "./setup";
import "./setup.css";
import { toHindi } from "./i18n";
import { GUARD_INACTIVE_SENTENCE, verdictText, type Lang } from "./verdictCopy";
import { connect, discoverWallets, isUserRejection, switchToSepolia, walletChainId, type WalletOption } from "./wallet";

const app = document.getElementById("app") as HTMLElement;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, props: Record<string, string> = {}, ...kids: (string | Node)[]): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) e.setAttribute(k, v);
  for (const k of kids) e.append(k);
  return e;
}

function link(href: string, text: string): HTMLAnchorElement {
  return el("a", { href, target: "_blank", rel: "noopener noreferrer" }, text);
}

type Call = ReturnType<typeof buildPaymentCall>;

interface State {
  config: Config;
  reads: ReadClient;
  wallet?: WalletOption;
  account?: Address;
  provider?: EIP1193Provider;
  safe?: Safe;
  info?: SafeInfo;
  /** Arkiv evidence, read once in bulk the first time a Safe is loaded. */
  listed?: Promise<ListedState>;
  /** Settles when the anonymous-read route is decided (active or direct). Reads wait for it. */
  route: Promise<void>;
  outcome?: AnonOutcome;
  trying?: string;
  skip: AbortController;
  /** Safe address from `?safe=0x…`, loaded once when the Safe section first renders. */
  pendingSafe?: string;
  /** Last Safe loaded, kept so the address survives connecting a wallet. */
  lastSafe?: Address;
  lang: Lang;
  shown?: { verdict: Verdict; box: HTMLElement };
}

let state: State;

function boot(): void {
  let config: Config;
  try {
    config = loadConfig(import.meta.env as Record<string, string | undefined>);
  } catch (e) {
    app.replaceChildren(el("h1", {}, "HexFence Pay"), el("div", { class: "error" }, e instanceof ConfigError ? e.message : String(e)));
    return;
  }
  state = { config, reads: createReadClient(config.sepoliaRpcUrl), route: Promise.resolve(), skip: new AbortController(), lang: "en" };
  state.pendingSafe = new URLSearchParams(window.location.search).get("safe")?.trim() || undefined;
  state.route = startRoute();
  new MutationObserver(applyLang).observe(app, { childList: true, subtree: true });
  render();
}

function render(): void {
  app.replaceChildren(
    el("h1", {}, "HexFence Pay"),
    el("p", { class: "sub" }, "Checks a payment against your approved payees before you sign. Sepolia test network."),
    langBar(),
    routeSection(),
    walletSection(),
    safeSection(),
    paymentSection(),
    setupSection(),
  );
}

// ---------- anonymous reads (T11) ----------
let routeEl: HTMLElement | undefined;

async function startRoute(): Promise<void> {
  const c = state.config;
  const outcome = await connectAnon({
    sepoliaRpcUrl: c.sepoliaRpcUrl,
    signal: state.skip.signal,
    onTry: (r) => {
      state.trying = r.label;
      fillRoute();
    },
  });
  state.trying = undefined;
  state.outcome = outcome;
  if (outcome.fetchFn) state.reads = createReadClient(c.sepoliaRpcUrl, outcome.fetchFn);
  fillRoute();
}

function routeSection(): HTMLElement {
  routeEl = el("section");
  fillRoute();
  return routeEl;
}

function fillRoute(): void {
  const s = routeEl;
  if (!s) return;
  s.replaceChildren(el("h2", {}, "Read route"));
  if (!state.outcome) {
    s.append(el("p", { class: "small" }, `Connecting to anonymous read routes (${state.trying ?? "starting"})… Safe and payee reads wait for this.`));
    const b = el("button", {}, "Skip: read directly (not anonymous)");
    b.onclick = () => state.skip.abort();
    s.append(b);
    return;
  }
  for (const line of routeStatusText(state.outcome)) s.append(el("p", { class: "small" }, line));
}

// ---------- 1. wallet ----------
function walletSection(): HTMLElement {
  const s = el("section");
  s.append(el("h2", {}, "1. Wallet"));
  const status = el("p", { class: "small" });
  s.append(status);
  if (state.account) {
    status.textContent = `Connected: ${state.account} (${state.wallet?.name ?? "wallet"})`;
    return s;
  }
  status.textContent = "Looking for wallets…";
  void discoverWallets().then((wallets) => {
    if (wallets.length === 0) {
      status.textContent = "No browser wallet found yet. The live preview below works without one. To sign and send, install a Sepolia wallet and reload.";
      return;
    }
    status.textContent = "Connect a wallet to sign and send, or use the live preview below:";
    for (const w of wallets) {
      const b = el("button", {}, `Connect ${w.name}`);
      b.onclick = () => void onConnect(w, s);
      s.append(b);
    }
  });
  return s;
}

async function onConnect(w: WalletOption, section: HTMLElement): Promise<void> {
  clearErrors(section);
  try {
    const account = await connect(w.provider);
    if ((await walletChainId(w.provider)) !== SEPOLIA_CHAIN_ID) await switchToSepolia(w.provider);
    state.wallet = w;
    state.account = getAddress(account);
    state.provider = compositeProvider(w.provider, state.reads);
    state.safe = undefined;
    state.info = undefined;
    render();
  } catch (e) {
    showError(section, isUserRejection(e) ? "Connection cancelled in the wallet." : errText(e));
  }
}

// ---------- 2. Safe ----------
function safeSection(): HTMLElement {
  const s = el("section");
  s.append(el("h2", {}, "2. Safe"));
  if (!state.account) {
    s.append(el("div", { class: "notice preview" }, "Live preview: real Safe data and real verdicts, no wallet needed. Connect a Sepolia wallet to sign and send."));
  }
  const input = el("input", { id: "safe-address", placeholder: "Safe address (0x…)", spellcheck: "false" });
  const load = el("button", {}, "Load Safe");
  if (state.info) input.value = state.info.address;
  else if (state.pendingSafe) input.value = state.pendingSafe;
  else if (state.lastSafe) input.value = state.lastSafe;
  const out = el("div");
  load.onclick = () => void onLoadSafe(input.value, out);
  s.append(el("label", { for: "safe-address" }, "Safe address on Sepolia"), input, load, out);
  if (state.info) renderSafeInfo(out, state.info);
  else if (state.pendingSafe) {
    const raw = state.pendingSafe;
    state.pendingSafe = undefined;
    void onLoadSafe(raw, out);
  }
  return s;
}

async function onLoadSafe(raw: string, out: HTMLElement): Promise<void> {
  out.replaceChildren(el("p", { class: "small" }, "Loading…"));
  try {
    const address = parseAddress(raw, "Safe address");
    await state.route;
    if (state.wallet) state.provider = compositeProvider(state.wallet.provider, state.reads);
    const code = await state.reads.getCode({ address });
    if (!code || code === "0x") throw new InputError("There is no contract at that address on Sepolia.");
    const safe = state.provider && state.account ? await openSafe(state.provider, state.account, address) : await openSafeReadOnly(state.reads, address);
    const info = await loadSafeInfo(safe, state.reads, state.config.guard);
    state.safe = safe;
    state.info = info;
    state.lastSafe = info.address;
    const { publisher, arkivAccessKey } = state.config;
    state.listed ??= loadListed(publisher !== undefined, () =>
      fetchAllEvidence(arkivReadClient({ accessKey: arkivAccessKey }), publisher as Address),
    );
    render();
  } catch (e) {
    out.replaceChildren(el("div", { class: "error" }, errText(e)));
  }
}

function renderSafeInfo(out: HTMLElement, info: SafeInfo): void {
  out.replaceChildren();
  out.append(el("p", { class: "mono" }, `Safe ${info.address} · version ${info.version} · threshold ${info.threshold}/${info.owners.length}`));
  if (state.account && !info.owners.some((o) => o.toLowerCase() === state.account?.toLowerCase())) {
    out.append(el("div", { class: "error" }, "The connected account is not an owner of this Safe, so it cannot sign for it."));
  }
  if (state.account && info.threshold > 1) {
    out.append(el("div", { class: "error" }, "Pay signs and sends in one step, so it supports Safes with threshold 1 only."));
  }
  if (info.guard.active) {
    out.append(el("div", { class: "notice" }, `HexFence Guard ${state.config.guard} is active on this Safe.`));
  } else {
    const why =
      info.guard.reason === "unsupported"
        ? "This Safe version does not support guards."
        : info.guard.reason === "none"
          ? "No guard is set on this Safe."
          : `A different guard is set on this Safe (${info.guard.current}).`;
    out.append(el("div", { class: "error" }, `HexFence Guard is not active on this Safe. ${why} Nothing on-chain will refuse a lookalike payment.`));
  }
  const evidenceLine = el("p", { class: "small" }, "Public evidence: loading…");
  out.append(evidenceLine);
  void state.listed?.then((l) => {
    evidenceLine.textContent = listedStatusText(l);
    if (l.status === "unavailable") evidenceLine.className = "error";
  });
  out.append(el("p", { class: "small" }, `Approved payees (read once from the Guard): ${info.payees.length === 0 ? "none" : ""}`));
  const ul = el("ul");
  for (const p of info.payees) ul.append(el("li", { class: "mono" }, p));
  out.append(ul);
}

// ---------- 3. payment ----------
function paymentSection(): HTMLElement {
  const s = el("section");
  s.append(el("h2", {}, "3. Payment"));
  if (!state.info || !state.safe) {
    s.append(el("p", { class: "small" }, "Load a Safe first."));
    return s;
  }
  const asset = el("select", { id: "asset" });
  asset.append(el("option", { value: "eth" }, "ETH"), el("option", { value: "erc20" }, "ERC-20 token"));
  const token = el("input", { id: "token", placeholder: "Token contract address (0x…)", spellcheck: "false" });
  const tokenWrap = el("div", { class: "hidden" }, el("label", { for: "token" }, "Token address (decimals are read on-chain)"), token);
  asset.onchange = () => tokenWrap.classList.toggle("hidden", asset.value !== "erc20");
  const to = el("input", { id: "to", placeholder: "Recipient (0x…)", spellcheck: "false" });
  const amount = el("input", { id: "amount", placeholder: "0.01", inputmode: "decimal" });
  const check = el("button", {}, "Check payment");
  const out = el("div");
  check.onclick = () => void onCheck({ asset: asset.value, token: token.value, to: to.value, amount: amount.value }, out);
  s.append(el("label", { for: "asset" }, "Asset"), asset, tokenWrap, el("label", { for: "to" }, "Recipient"), to, el("label", { for: "amount" }, "Amount"), amount, check, out);
  return s;
}

async function resolveAsset(kind: string, tokenRaw: string): Promise<Asset> {
  if (kind === "eth") return { kind: "eth" };
  const token = parseAddress(tokenRaw, "Token address");
  const code = await state.reads.getCode({ address: token });
  if (!code || code === "0x") throw new InputError("There is no contract at the token address on Sepolia.");
  const c = getContract({ address: token, abi: erc20Abi, client: state.reads });
  let decimals: number;
  try {
    decimals = Number(await c.read.decimals());
  } catch {
    throw new InputError("Could not read decimals() from that token address. Is it an ERC-20 on Sepolia?");
  }
  const symbol = await c.read.symbol().catch(() => undefined);
  return { kind: "erc20", token, decimals, symbol };
}

async function onCheck(f: { asset: string; token: string; to: string; amount: string }, out: HTMLElement): Promise<void> {
  out.replaceChildren(el("p", { class: "small" }, "Checking…"));
  try {
    const { safe, info } = state;
    if (!safe || !info) throw new InputError("Load a Safe first.");
    const asset = await resolveAsset(f.asset, f.token);
    const recipient = parseAddress(f.to, "Recipient");
    const amount = parseAmount(f.amount, asset.kind === "eth" ? 18 : asset.decimals);
    const call = buildPaymentCall(asset, recipient, amount);
    const decoded = decodeSafeCall(call, { safe: info.address, guard: state.config.guard });
    const listed = await state.listed;
    const verdict = verdictFor(decoded, info.payees, listed?.status === "ok" ? listed.map : undefined);
    renderVerdict(out, verdict, recipient, call);
  } catch (e) {
    out.replaceChildren(el("div", { class: "error" }, errText(e)));
  }
}

// ---------- language (T12) ----------
function langBar(): HTMLElement {
  const bar = el("p", { class: "small" });
  for (const [lang, label] of [["en", "English"], ["hi", "हिन्दी"]] as const) {
    const b = el("button", { type: "button", "aria-pressed": String(state.lang === lang) }, label);
    b.onclick = () => {
      state.lang = lang;
      bar.replaceWith(langBar());
      if (state.shown) fillVerdictBox(state.shown.box, state.shown.verdict);
      applyLang();
    };
    bar.append(b);
  }
  return bar;
}

const englishText = new WeakMap<Text, string>();
const englishPlaceholder = new WeakMap<Element, string>();

/** Swaps the interface text in place, so typed values and the current verdict survive a language change. */
function applyLang(): void {
  document.documentElement.lang = state.lang;
  const pick = (english: string) => (state.lang === "hi" ? toHindi(english) : english);
  const walker = document.createTreeWalker(app, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode() as Text | null; n; n = walker.nextNode() as Text | null) {
    const english = englishText.get(n) ?? n.data;
    const next = pick(english);
    if (next !== n.data) {
      englishText.set(n, english);
      n.data = next;
    }
  }
  for (const input of Array.from(app.querySelectorAll("[placeholder]"))) {
    const english = englishPlaceholder.get(input) ?? (input.getAttribute("placeholder") as string);
    const next = pick(english);
    if (next !== input.getAttribute("placeholder")) {
      englishPlaceholder.set(input, english);
      input.setAttribute("placeholder", next);
    }
  }
}

function fillVerdictBox(box: HTMLElement, verdict: Verdict): void {
  const info = state.info as SafeInfo;
  const text = verdictText(verdict, { guardActive: info.guard.active, publisher: state.config.publisher, lang: state.lang });
  const hindi = state.lang === "hi";
  box.replaceChildren(el("strong", {}, verdict.level === "GREY" ? "CANNOT VERIFY" : verdict.level));
  text.sentences.forEach((sentence, i) => {
    const p = el("p", {}, i === 0 && verdict.level === "RED" ? el("strong", {}, sentence) : sentence);
    if (hindi && !(sentence === GUARD_INACTIVE_SENTENCE)) p.lang = "hi";
    box.append(p);
  });
  if (verdict.level === "RED" && verdict.reason === "listed") {
    const url = state.config.explorerUrl;
    if (url) box.append(el("p", { class: "small" }, link(url, "Open the explorer")));
  }
}

function renderVerdict(out: HTMLElement, verdict: Verdict, recipient: Address, call: Call): void {
  const box = el("div", { class: `verdict ${verdict.level}` });
  fillVerdictBox(box, verdict);
  state.shown = { verdict, box };
  out.replaceChildren(box);
  if (!state.account) {
    out.append(el("p", { class: "small" }, "Live preview: this is the real verdict. Connect a Sepolia wallet to sign and send."));
    return;
  }

  const friction = requiresFriction(verdict);
  const go = el("button", {}, friction ? "Continue anyway" : "Sign and send");
  const cancel = el("button", {}, friction ? "Reject" : "Cancel");
  cancel.onclick = () => out.replaceChildren(); // no wallet call
  const result = el("div");
  if (friction) {
    const typed = el("input", { id: "friction", placeholder: `Last ${frictionSuffix(recipient).length} characters`, autocomplete: "off", spellcheck: "false" });
    go.disabled = true;
    typed.oninput = () => (go.disabled = !frictionSatisfied(recipient, typed.value));
    out.append(el("label", { for: "friction" }, `To continue, type the last 6 characters of ${recipient}`), typed);
  }
  go.onclick = () => {
    go.disabled = true;
    cancel.disabled = true;
    void onExecute(call, result).finally(() => (cancel.disabled = false));
  };
  out.append(go, cancel, result);
}

async function onExecute(call: SetupCall, out: HTMLElement): Promise<boolean> {
  out.replaceChildren(el("p", { class: "small" }, "Waiting for your wallet…"));
  try {
    const { safe, info, account, wallet } = state;
    if (!safe || !info || !account || !wallet) throw new InputError("Connect a wallet and load a Safe first.");
    if ((await walletChainId(wallet.provider)) !== SEPOLIA_CHAIN_ID) throw new InputError("Switch your wallet to Sepolia and try again.");
    if (!info.owners.some((o) => o.toLowerCase() === account.toLowerCase())) throw new InputError("The connected account is not an owner of this Safe.");
    if (info.threshold > 1) throw new InputError("Pay supports Safes with threshold 1 only.");

    const tx = await safe.createTransaction({ transactions: [{ to: call.to, value: call.value.toString(), data: call.data, operation: call.operation }] });
    const signed = await safe.signTransaction(tx);

    out.replaceChildren(el("p", { class: "small" }, "Signed. Simulating before sending…"));
    const encoded = (await safe.getEncodedTransaction(signed)) as Hex;
    const sim = await simulateExec(state.reads, account, info.address, encoded);
    const plan = planFromSimulation(sim);
    if (!plan.send) {
      out.replaceChildren(el("div", { class: "error" }, `Not sent. ${describeRevert(plan.info)}`));
      return false;
    }
    const sent = await safe.executeTransaction(signed, plan.gasLimit ? { gasLimit: plan.gasLimit } : undefined);
    const hash = sent.hash as Hex;
    out.replaceChildren(el("p", {}, "Sent: ", link(`${SEPOLIA_EXPLORER}/tx/${hash}`, hash)), el("p", { class: "small" }, "Waiting for confirmation…"));
    const receipt = await state.reads.waitForTransactionReceipt({ hash });
    const done = el("div");
    done.append(el("p", {}, "Transaction: ", link(`${SEPOLIA_EXPLORER}/tx/${hash}`, hash)));
    if (receipt.status === "success") {
      done.append(el("div", { class: "notice" }, `Confirmed in block ${receipt.blockNumber}.`));
    } else {
      done.append(el("div", { class: "error" }, !sim.ok ? describeRevert(sim.info) : "The transaction reverted on-chain."));
    }
    out.replaceChildren(done);
    return receipt.status === "success";
  } catch (e) {
    out.replaceChildren(isUserRejection(e) ? el("div", { class: "notice" }, "Cancelled in your wallet. Nothing was sent.") : el("div", { class: "error" }, errText(e)));
    return false;
  }
}

// ---------- 4. setup (owner only) ----------
function setupSection(): HTMLElement {
  const s = el("section", { id: "setup" });
  s.append(el("h2", {}, "4. Setup"));
  const { info, account } = state;
  if (!info) {
    s.append(el("p", { class: "small" }, "Load a Safe first."));
    return s;
  }
  if (!account) {
    s.append(el("p", { class: "small" }, "Connect a Sepolia wallet that owns this Safe to enable the Guard and approve payees."));
    return s;
  }
  const blocker = setupBlocker(info, account);
  if (blocker) {
    s.append(el("div", { class: "error" }, blocker));
    return s;
  }
  const guard = state.config.guard;

  s.append(el("h3", {}, "HexFence Guard"));
  const guardOut = el("div");
  if (info.guard.active) {
    s.append(el("p", { class: "small" }, `Current state, read from the Safe: the HexFence Guard ${guard} is active.`));
    const off = el("button", { id: "guard-off" }, "Turn Guard off…");
    off.onclick = () => reviewAndSend(guardOut, [DISABLE_WARNING], "Sign and turn Guard off", buildDisableGuardCall(info.address));
    s.append(off, guardOut);
  } else {
    s.append(el("p", { class: "small" }, "Current state, read from the Safe: the HexFence Guard is not active."));
    const on = el("button", { id: "guard-on" }, "Enable HexFence Guard…");
    on.onclick = () => reviewAndSend(guardOut, enableWarnings(info), "Sign and enable Guard", buildEnableGuardCall(info.address, guard));
    s.append(on, guardOut);
  }

  s.append(el("h3", {}, "Approved payees"));
  s.append(el("p", { class: "small" }, `Read from the Guard: ${info.payees.length === 0 ? "none approved." : `${info.payees.length} approved.`}`));
  const list = el("ul");
  for (const p of info.payees) {
    const li = el("li", {}, el("span", { class: "mono" }, p), " ");
    const rm = el("button", {}, "Remove…");
    const rmOut = el("div");
    rm.onclick = () => reviewAndSend(rmOut, [removeWarning(p)], "Sign and remove payee", buildRemovePayeeCall(guard, p));
    li.append(rm, rmOut);
    list.append(li);
  }
  s.append(list);

  const input = el("input", { id: "new-payee", placeholder: "Payee address to approve (0x…)", spellcheck: "false" });
  const add = el("button", {}, "Approve payee…");
  const addOut = el("div");
  add.onclick = () => {
    try {
      const payee = parseAddress(input.value, "Payee address");
      const check = checkApprove(payee, info.payees);
      if (!check.ok) {
        addOut.replaceChildren(el("div", { class: "error" }, check.reason));
        return;
      }
      reviewAndSend(addOut, [check.warning], "Sign and approve payee", buildApprovePayeeCall(guard, payee));
    } catch (e) {
      addOut.replaceChildren(el("div", { class: "error" }, errText(e)));
    }
  };
  s.append(el("label", { for: "new-payee" }, "Approve a payee"), input, add, addOut);
  return s;
}

/** Shows what the contract will do, requires a tick, then sends through the same sign -> simulate -> send path as a payment. */
function reviewAndSend(out: HTMLElement, warnings: string[], label: string, call: SetupCall): void {
  const ul = el("ul", { class: "warnings" });
  for (const w of warnings) ul.append(el("li", {}, w));
  const tick = el("input", { type: "checkbox", id: `ack-${label.replace(/\W+/g, "-")}` });
  const go = el("button", {}, label);
  go.disabled = true;
  tick.onchange = () => (go.disabled = !tick.checked);
  const cancel = el("button", {}, "Cancel");
  cancel.onclick = () => out.replaceChildren();
  const result = el("div");
  go.onclick = () => {
    go.disabled = true;
    cancel.disabled = true;
    void onExecute(call, result)
      .then((ok) => {
        if (!ok) return;
        const refresh = el("button", {}, "Reload Safe state");
        refresh.onclick = () => void onLoadSafe(state.info?.address ?? "", result);
        result.append(refresh);
      })
      .finally(() => (cancel.disabled = false));
  };
  out.replaceChildren(el("div", { class: "notice" }, "Read before you sign:"), ul, el("label", {}, tick, " I have read this"), go, cancel, result);
}

// ---------- helpers ----------
function errText(e: unknown): string {
  if (e instanceof Error) return ("shortMessage" in e && typeof e.shortMessage === "string" ? e.shortMessage : e.message) || String(e);
  return String(e);
}
function showError(section: HTMLElement, msg: string): void {
  section.append(el("div", { class: "error" }, msg));
}
function clearErrors(section: HTMLElement): void {
  section.querySelectorAll(".error").forEach((n) => n.remove());
}

boot();
