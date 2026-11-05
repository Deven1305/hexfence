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
import { loadSafeInfo, openSafe, type SafeInfo } from "./safe";
import { verdictText } from "./verdictCopy";
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
  state = { config, reads: createReadClient(config.sepoliaRpcUrl), route: Promise.resolve(), skip: new AbortController() };
  state.route = startRoute();
  render();
}

function render(): void {
  app.replaceChildren(
    el("h1", {}, "HexFence Pay"),
    el("p", { class: "sub" }, "Checks a payment against your approved payees before you sign. Sepolia test network."),
    routeSection(),
    walletSection(),
    safeSection(),
    paymentSection(),
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
      status.textContent = "No browser wallet found. Install one and reload.";
      return;
    }
    status.textContent = "Choose a wallet:";
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
    s.append(el("p", { class: "small" }, "Connect a wallet first."));
    return s;
  }
  const input = el("input", { id: "safe-address", placeholder: "Safe address (0x…)", spellcheck: "false" });
  const load = el("button", {}, "Load Safe");
  const out = el("div");
  load.onclick = () => void onLoadSafe(input.value, out);
  s.append(el("label", { for: "safe-address" }, "Safe address on Sepolia"), input, load, out);
  if (state.info) renderSafeInfo(out, state.info);
  return s;
}

async function onLoadSafe(raw: string, out: HTMLElement): Promise<void> {
  out.replaceChildren(el("p", { class: "small" }, "Loading…"));
  try {
    if (!state.provider || !state.account) throw new InputError("Connect a wallet first.");
    const address = parseAddress(raw, "Safe address");
    await state.route;
    if (state.wallet) state.provider = compositeProvider(state.wallet.provider, state.reads);
    const code = await state.reads.getCode({ address });
    if (!code || code === "0x") throw new InputError("There is no contract at that address on Sepolia.");
    const safe = await openSafe(state.provider, state.account, address);
    const info = await loadSafeInfo(safe, state.reads, state.config.guard);
    state.safe = safe;
    state.info = info;
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
  if (!info.owners.some((o) => o.toLowerCase() === state.account?.toLowerCase())) {
    out.append(el("div", { class: "error" }, "The connected account is not an owner of this Safe, so it cannot sign for it."));
  }
  if (info.threshold > 1) {
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
  out.append(el("p", { class: "small" }, `Approved payees (read once from the Guard): ${info.payees.length === 0 ? "none" : ""}`));
  const evidenceLine = el("p", { class: "small" }, "Public evidence: loading…");
  out.append(evidenceLine);
  void state.listed?.then((l) => {
    evidenceLine.textContent = listedStatusText(l);
    if (l.status === "unavailable") evidenceLine.className = "error";
  });
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

function renderVerdict(out: HTMLElement, verdict: Verdict, recipient: Address, call: Call): void {
  const info = state.info as SafeInfo;
  const text = verdictText(verdict, { guardActive: info.guard.active, publisher: state.config.publisher });
  const box = el("div", { class: `verdict ${verdict.level}` });
  box.append(el("strong", {}, verdict.level === "GREY" ? "CANNOT VERIFY" : verdict.level));
  text.sentences.forEach((sentence, i) => box.append(el("p", {}, i === 0 && verdict.level === "RED" ? el("strong", {}, sentence) : sentence)));
  if (verdict.level === "RED" && verdict.reason === "listed") {
    const url = state.config.explorerUrl;
    if (url) box.append(el("p", { class: "small" }, link(url, "Open the explorer")));
  }
  out.replaceChildren(box);

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

async function onExecute(call: Call, out: HTMLElement): Promise<void> {
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
      return;
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
  } catch (e) {
    out.replaceChildren(isUserRejection(e) ? el("div", { class: "notice" }, "Cancelled in your wallet. Nothing was sent.") : el("div", { class: "error" }, errText(e)));
  }
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
