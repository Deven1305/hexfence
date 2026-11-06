import { decodeFunctionData, getAddress, isAddress, parseAbiItem, toFunctionSelector, type Address } from "viem";
import type { SafeCall } from "./decoder.js";
import { fingerprint, sameAddress } from "./fingerprint.js";

/**
 * Explain layer (ERC-7730 clear signing descriptors, https://eips.ethereum.org/EIPS/eip-7730).
 * A descriptor describes calls to one contract. This module only EXPLAINS: it never produces a verdict,
 * so it can never lower a risk level. A call that no descriptor describes stays "cannot verify".
 */

export interface ExplainedField {
  label: string;
  format: string;
  value: string;
}

export interface Explanation {
  contractName?: string;
  intent: string;
  /** `interpolatedIntent` with its {placeholders} filled, or the intent when there is none (or it cannot be filled). */
  text: string;
  fields: ExplainedField[];
  /** Fields with format `addressName`: every address the call names, so the resemblance check can run on them. */
  addresses: { label: string; address: Address }[];
}

interface Format {
  intent?: unknown;
  interpolatedIntent?: unknown;
  fields?: unknown;
}

/**
 * The explanation for `call` if one of `descriptors` binds to `call.to` on `chainId` (context.contract.deployments)
 * and describes the called function (display.formats key, matched by its 4-byte selector). Otherwise null.
 * Malformed descriptors and calldata give null; this never throws.
 */
export function explainCall(call: SafeCall, chainId: number, descriptors: unknown[]): Explanation | null {
  if (call.operation !== 0) return null;
  for (const d of descriptors) {
    try {
      const found = explainWith(d, call, chainId);
      if (found) return found;
    } catch {
      /* A bad descriptor or calldata explains nothing. */
    }
  }
  return null;
}

function explainWith(descriptor: unknown, call: SafeCall, chainId: number): Explanation | null {
  const d = rec(descriptor);
  const deployments = rec(rec(rec(d?.context)?.contract))?.deployments;
  if (!Array.isArray(deployments)) return null;
  const bound = deployments.some((x) => {
    const r = rec(x);
    return r?.chainId === chainId && typeof r.address === "string" && isAddress(r.address, { strict: false }) && sameAddress(getAddress(r.address), call.to);
  });
  if (!bound) return null;

  const formats = rec(rec(d?.display)?.formats);
  if (!formats) return null;
  const selector = call.data.slice(0, 10).toLowerCase();
  const seen = new Set<string>();
  let hit: { abi: ReturnType<typeof parseAbiItem> & { type: "function" }; format: Format } | undefined;
  for (const [key, format] of Object.entries(formats)) {
    const abi = parseAbiItem(`function ${key}`);
    if (abi.type !== "function") continue;
    const sel = toFunctionSelector(abi);
    if (seen.has(sel)) return null; // two keys with one type-only signature: invalid descriptor (spec)
    seen.add(sel);
    if (sel === selector) hit = { abi, format: format as Format };
  }
  if (!hit) return null;

  const { args } = decodeFunctionData({ abi: [hit.abi], data: call.data });
  const byName = new Map<string, unknown>();
  hit.abi.inputs.forEach((input, i) => input.name && byName.set(input.name, (args as readonly unknown[])[i]));

  const fields: ExplainedField[] = [];
  const addresses: Explanation["addresses"] = [];
  const shown = new Map<string, string>();
  for (const f of Array.isArray(hit.format.fields) ? hit.format.fields : []) {
    const field = rec(f);
    if (!field || typeof field.path !== "string") continue;
    const raw = resolvePath(byName, field.path);
    if (raw === undefined) continue; // e.g. "@.value" (the transaction container) is not calldata
    const value = typeof raw === "string" && isAddress(raw, { strict: false }) ? getAddress(raw) : String(raw);
    const format = typeof field.format === "string" ? field.format : "raw";
    const label = typeof field.label === "string" ? field.label : field.path;
    fields.push({ label, format, value });
    shown.set(field.path, value);
    if (format === "addressName" && isAddress(value, { strict: false })) addresses.push({ label, address: getAddress(value) });
  }

  const intent = intentText(hit.format.intent);
  const template = typeof hit.format.interpolatedIntent === "string" ? hit.format.interpolatedIntent : undefined;
  const filled = template === undefined ? undefined : fill(template, shown);
  const name = rec(d?.metadata)?.contractName;
  return { contractName: typeof name === "string" ? name : undefined, intent, text: filled ?? intent, fields, addresses };
}

/** Described addresses that resemble an approved payee (same first and last 4 hex characters) but are a different address. */
export function resemblingPayees(e: Explanation, payees: Address[]): { address: Address; payee: Address; label: string }[] {
  const out: { address: Address; payee: Address; label: string }[] = [];
  for (const a of e.addresses) {
    const payee = payees.find((p) => fingerprint(p) === fingerprint(a.address) && !sameAddress(p, a.address));
    if (payee) out.push({ address: a.address, payee, label: a.label });
  }
  return out;
}

function intentText(intent: unknown): string {
  if (typeof intent === "string") return intent;
  const r = rec(intent);
  return r ? Object.values(r).filter((v) => typeof v === "string").join(" ") : "";
}

function fill(template: string, values: Map<string, string>): string | undefined {
  let ok = true;
  const text = template.replace(/\{([^{}]+)\}/g, (_, path: string) => {
    const v = values.get(path);
    if (v === undefined) ok = false;
    return v ?? "";
  });
  return ok ? text : undefined;
}

/** `to`, `order.price`, `recipients[0]` against the decoded arguments. */
function resolvePath(args: Map<string, unknown>, path: string): unknown {
  const parts = path.split(".");
  let cur: unknown;
  for (let i = 0; i < parts.length; i++) {
    const m = /^([A-Za-z_]\w*)((?:\[\d+\])*)$/.exec(parts[i]!);
    if (!m) return undefined;
    cur = i === 0 ? args.get(m[1]!) : (cur as Record<string, unknown> | undefined)?.[m[1]!];
    for (const idx of m[2]!.matchAll(/\[(\d+)\]/g)) cur = (cur as unknown[] | undefined)?.[Number(idx[1])];
    if (cur === undefined) return undefined;
  }
  return typeof cur === "object" ? undefined : cur;
}

function rec(v: unknown): Record<string, unknown> | undefined {
  return typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : undefined;
}
