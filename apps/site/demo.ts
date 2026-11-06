import { AddressXray, StatTile, VerdictCard } from "@hexfence/ui";
import "@hexfence/ui/style.css";
import { decodeSafeCall, hexFenceGuardAbi, verdictFor, type Verdict } from "@hexfence/shared";
import { createPublicClient, decodeErrorResult, decodeFunctionData, isHex, getAddress, http, isAddress, keccak256, parseAbi, stringToHex, type Address, type Hex } from "viem";
import { sepolia } from "viem/chains";

// Public demo values recorded in docs/PROGRESS.md. Only the inputs are fixed here: every status,
// payee list and recipient on the page is read live from Sepolia or Arkiv when it opens.
const SAFE: Address = "0x3BCc3969713778F3Ed26AE1490529eeBAD43FbD5";
const P: Address = "0x4E185e251Ac7fB83E9DE10723EAda46cadE74120"; // approved supplier
const L: Address = "0x4E185a3FC4B530244aB9ed0dE38167b403344120"; // synthetic lookalike we generated
const B: Address = "0xcB0a33f755826307CcaC3f4b4833e7e19d38cEb6"; // new supplier
const PAYMENTS: { label: string; hash: Hex }[] = [
  { label: "Pay L through HexFence Pay", hash: "0xa43b0eeef7253281a741deca144e5ddf0c465da9cc6f48d54673a9aa9c0f6d8f" },
  { label: "Pay B, a new supplier", hash: "0x2455ca8f1ce612149f15e80325f372202bffeb0258f808bd84acfb1f904de5ca" },
  { label: "Pay P, the approved payee", hash: "0xea209e9e3c5a9eed080e95dd0ca752b79686400da820ea67b87f98552d2992df" },
  { label: "Pay L again, straight from a script, no HexFence Pay", hash: "0xe77e6a7a8ba5b6f9742ec953826bc47c69ffffdced3a4d40b8fe3a220e1bb46f" },
];
const GUARD_SLOT = keccak256(stringToHex("guard_manager.guard.address"));
const safeAbi = parseAbi([
  "function VERSION() view returns (string)",
  "function execTransaction(address to,uint256 value,bytes data,uint8 operation,uint256 safeTxGas,uint256 baseGas,uint256 gasPrice,address gasToken,address refundReceiver,bytes signatures) payable returns (bool)",
]);

const env = import.meta.env;
const guard = env.VITE_GUARD_ADDRESS?.trim();
const rpc = env.VITE_SEPOLIA_RPC_URL?.trim();
const publisher = env.VITE_ARKIV_PUBLISHER?.trim();
const part = (name: string) => document.querySelector<HTMLElement>(`[data-live="${name}"]`)!;
const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, ...kids: (Node | string)[]) => {
  const n = document.createElement(tag); if (cls) n.className = cls; n.append(...kids); return n;
};
const link = (text: string, href: string) => { const a = el("a", undefined, text); a.href = href; a.target = "_blank"; a.rel = "noreferrer"; return a; };
const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
const nameOf = (a: string) => ({ [P.toLowerCase()]: "P", [L.toLowerCase()]: "L", [B.toLowerCase()]: "B" })[a.toLowerCase()];
/** Revert data inside a viem error or one of its causes. */
const revertData = (err: unknown): Hex | undefined => {
  for (let e = err as { data?: unknown; cause?: unknown } | undefined, i = 0; e && i < 10; e = e.cause as typeof e, i++) {
    const d = typeof e.data === "object" && e.data !== null ? (e.data as { data?: unknown }).data : e.data;
    if (typeof d === "string" && isHex(d) && d.length >= 10) return d;
  }
  return undefined;
};
const fail = (name: string, text: string) => part(name).replaceChildren(el("p", "status", text));

part("xray").append(AddressXray(P, L, "P · approved payee"), AddressXray(L, P, "L · resembles your approved payee · synthetic Sepolia example"));

const verdictText: Record<Verdict["level"], string> = {
  RED: "RED · resembles your approved payee. HexFence Pay asks for 6 typed characters; the Guard will refuse it.",
  AMBER: "AMBER · new recipient, not one of your approved payees. Allowed: check the full address with them.",
  GREEN: "GREEN · approved payee.",
  GREY: "GREY · cannot verify this transaction type.",
};
const verdictRow = (label: string, address: Address, payees: Address[]) => {
  const v = verdictFor({ kind: "eth", recipient: address, amount: 1n }, payees);
  const card = VerdictCard(v.level.toLowerCase()); card.classList.add("demo-level", v.level.toLowerCase()); card.textContent = verdictText[v.level];
  return el("div", "demo-verdict", AddressXray(address, v.level === "RED" && v.reason === "resembles" ? v.payee : undefined, label), card);
};

async function evidence() {
  if (!publisher || !isAddress(publisher, { strict: false })) return fail("evidence", "No Arkiv publisher is configured for this build.");
  const { arkivReadClient, fetchAllEvidence } = await import("@hexfence/arkiv");
  const records = await fetchAllEvidence(arkivReadClient({ accessKey: env.VITE_ARKIV_ACCESS_KEY || undefined }), publisher as Address);
  const latest = [...records].sort((a, b) => b.attackBlock - a.attackBlock)[0];
  const tiles = el("div", "demo-tiles", StatTile("Published records", String(records.length)),
    StatTile("Status", [...new Set(records.map(e => e.status))].join(", ") || "none"),
    StatTile("Victims mentioned", String(new Set(records.map(e => e.victim.toLowerCase())).size)));
  if (!latest) return part("evidence").replaceChildren(tiles);
  part("evidence").replaceChildren(tiles,
    el("p", "demo-caption", `Latest record: block ${latest.attackBlock}, ${latest.variant}, ${latest.token === "0xdAC17F958D2ee523a2206206994597C13D831ec7" ? "USDT" : "USDC"}. The victim had paid the impersonated address; then a ${latest.variant} transfer planted the lookalike.`),
    AddressXray(latest.impersonated, latest.lookalike, "Impersonated address"), AddressXray(latest.lookalike, latest.impersonated, "Lookalike · suspected"),
    el("p", "demo-links", link("Suspected attack transaction on Etherscan ↗", `https://etherscan.io/tx/${latest.attackTx}`), link("Earlier real payment ↗", `https://etherscan.io/tx/${latest.referenceTx}`)));
}

async function chain() {
  if (!guard || !rpc || !isAddress(guard, { strict: false })) {
    ["safe", "verdicts", "receipts"].forEach(n => fail(n, "This build has no Sepolia RPC or Guard address configured."));
    return;
  }
  const client = createPublicClient({ chain: sepolia, transport: http(rpc, { retryCount: 1, timeout: 20_000 }) });
  const [version, slot, payees] = await Promise.all([
    client.readContract({ address: SAFE, abi: safeAbi, functionName: "VERSION" }),
    client.getStorageAt({ address: SAFE, slot: GUARD_SLOT }),
    client.readContract({ address: getAddress(guard), abi: hexFenceGuardAbi, functionName: "payees", args: [SAFE] }) as Promise<readonly Address[]>,
  ]);
  const active = slot ? getAddress(`0x${slot.slice(-40)}`) : undefined;
  const isOurs = active?.toLowerCase() === guard.toLowerCase();
  part("safe").replaceChildren(el("div", "demo-tiles", StatTile("Safe version", version), StatTile("Active guard", active ? short(active) : "none"), StatTile("Approved payees", String(payees.length))),
    el("p", "demo-caption", isOurs ? "The Safe's guard slot holds HexFenceGuard, so every Safe transaction passes through it (module transactions do not)." : "The Safe's guard slot does not hold the configured HexFenceGuard right now."),
    ...payees.map(p => AddressXray(p, undefined, `Approved payee${nameOf(p) ? ` ${nameOf(p)}` : ""}`)),
    el("p", "demo-links", link("Safe on Etherscan ↗", `https://sepolia.etherscan.io/address/${SAFE}`), link("Guard source on Etherscan ↗", `https://sepolia.etherscan.io/address/${guard}#code`)));

  const list = [...payees];
  part("verdicts").replaceChildren(verdictRow("L", L, list), verdictRow("B", B, list), verdictRow("P", P, list));
  const form = part("check") as HTMLFormElement; const input = form.querySelector("input")!; const status = form.querySelector(".status")!;
  form.onsubmit = event => {
    event.preventDefault(); const value = input.value.trim();
    form.querySelector(".demo-verdict")?.remove();
    if (!isAddress(value, { strict: false })) { status.textContent = "That is not a 0x address with 40 hex characters."; return; }
    status.textContent = ""; form.append(verdictRow("Your address", getAddress(value), list));
  };

  const rows = await Promise.all(PAYMENTS.map(async p => {
    const [receipt, tx] = await Promise.all([client.getTransactionReceipt({ hash: p.hash }), client.getTransaction({ hash: p.hash })]);
    let recipient = "not decoded";
    try {
      const decodedCall = decodeFunctionData({ abi: safeAbi, data: tx.input });
      if (decodedCall.functionName !== "execTransaction") throw new Error("not execTransaction");
      const [to, value, data, operation] = decodedCall.args;
      const call = { to, value, data, operation: operation === 1 ? 1 : 0 } as const;
      const decoded = decodeSafeCall(call, { safe: SAFE, guard: getAddress(guard) });
      if ("recipient" in decoded) recipient = `${nameOf(decoded.recipient) ?? "?"} · ${short(decoded.recipient)}`;
    } catch { /* not an execTransaction call: show the receipt only */ }
    const ok = receipt.status === "success";
    // Replay a reverted payment one block earlier to read its real revert reason. Old state may be pruned
    // on some RPCs; then we show only that it reverted.
    let reason = "";
    if (!ok && tx.to) {
      try {
        await client.call({ account: tx.from, to: tx.to, data: tx.input, value: tx.value, gas: tx.gas, blockNumber: receipt.blockNumber - 1n });
      } catch (err) {
        const data = revertData(err);
        try { if (data) { const d = decodeErrorResult({ abi: hexFenceGuardAbi, data }); reason = `${d.errorName}(${(d.args ?? []).map(a => nameOf(String(a)) ?? String(a)).join(", ")})`; } } catch { /* not a Guard error */ }
      }
    }
    return el("div", `demo-receipt ${ok ? "ok" : "refused"}`, el("strong", undefined, p.label),
      el("span", undefined, `Recipient ${recipient} · block ${receipt.blockNumber}`),
      el("span", "demo-status", ok ? "Succeeded" : reason ? `Reverted: ${reason}` : "Reverted"),
      link(ok ? "Receipt on Etherscan ↗" : "Decoded revert on Blockscout ↗", ok ? `https://sepolia.etherscan.io/tx/${p.hash}` : `https://eth-sepolia.blockscout.com/tx/${p.hash}`));
  }));
  part("receipts").replaceChildren(...rows, el("p", "demo-caption", "Both payments to L reverted, including the one sent without HexFence Pay: the rule is in the account, not in our website."));
}

void evidence().catch(() => fail("evidence", "Arkiv could not be read just now (its public endpoint is rate-limited). Reload in a minute, or open the explorer."));
void chain().catch(() => ["safe", "verdicts", "receipts"].forEach(n => fail(n, "Sepolia could not be read just now. Reload to try again.")));
