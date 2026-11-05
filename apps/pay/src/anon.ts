import { AnonRpcWorker } from "@anon-rpc/browser-harness";
import { createPublicClient, http } from "viem";
import { mainnet, sepolia } from "viem/chains";
import { createReadClient } from "./rpc";
import { SEPOLIA_CHAIN_ID } from "./config";

/**
 * Anonymous reads (T11). The reference "passthrough" specifier (0x4fd77be3...) is deliberately NOT in this list:
 * it fulfils calls with a plain fetch and anonymizes nothing. Order is the order we try them in.
 * Source of the addresses: ethereum/anon-rpc adopters.json5.
 */
export interface Route {
  id: "nox" | "tor-js" | "nym";
  label: string;
  specifier: string;
  /** Chain the specifier contract lives on = the chain the one bootstrap read must use. */
  bootstrapChainId: 1 | 11155111;
  config?: (env: AnonEnv) => unknown;
}

export interface AnonEnv {
  /** Comma-separated Tor gateways (`host:port:key`). Falls back to the published demo gateway. */
  torGateways?: string;
}

/** The demo gateway published in adopters.json5: "limited capacity, and it may disappear at any time". */
export const DEMO_TOR_GATEWAY = "152.236.3.22:12298:uEiCH0VdbhryzJcMtCfB0vLA4sOvHdQ4hq5w7CopcwU59bQ";

export const ROUTES: readonly Route[] = [
  { id: "nox", label: "Nox (Sphinx mixnet)", specifier: "0x35133267A8F7EC35046a83DCA0f4Ca8A6e1b7A9A", bootstrapChainId: SEPOLIA_CHAIN_ID },
  {
    id: "tor-js",
    label: "tor-js (Tor in the browser)",
    specifier: "0x700dA3193D35fA54Cd3fBf29B66f2a2A0385659e",
    bootstrapChainId: 1,
    config: (env) => ({ gateways: env.torGateways ? env.torGateways.split(",").map((s) => s.trim()).filter(Boolean) : [DEMO_TOR_GATEWAY] }),
  },
  { id: "nym", label: "Nym (mixnet)", specifier: "0x3aCD9742C68F6d993066Ae25533e09b9e1f60eD0", bootstrapChainId: 1 },
];

export interface Attempt {
  id: Route["id"];
  label: string;
  ok: boolean;
  /** Why it was skipped or failed. */
  reason?: string;
}

export interface AnonOutcome {
  /** The route that is carrying reads, or null when reads go directly to the RPC provider. */
  active: Pick<Route, "id" | "label"> | null;
  attempts: Attempt[];
  /** The anonymized fetch to hand to `createReadClient`; undefined when direct. */
  fetchFn?: typeof fetch;
  close(): void;
}

/** Minimal worker surface we use, so tests can supply a stand-in. */
export interface WorkerLike {
  ready: Promise<void>;
  fetch: typeof fetch;
  close(): void;
}
export type WorkerFactory = (init: ConstructorParameters<typeof AnonRpcWorker>[0]) => WorkerLike;

export interface ConnectOptions {
  sepoliaRpcUrl: string;
  mainnetRpcUrl?: string;
  env?: AnonEnv;
  timeoutMs?: number;
  signal?: AbortSignal;
  routes?: readonly Route[];
  makeWorker?: WorkerFactory;
  /** Called as each route starts, for the UI. */
  onTry?: (route: Route) => void;
}

const defaultFactory: WorkerFactory = (init) => new AnonRpcWorker(init) as unknown as WorkerLike;

function errText(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function timeout<T>(p: Promise<T>, ms: number, what: string, signal?: AbortSignal): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${what} timed out after ${Math.round(ms / 1000)}s`)), ms);
    const onAbort = () => reject(new Error("skipped by the user"));
    signal?.addEventListener("abort", onAbort, { once: true });
    p.then(resolve, reject).finally(() => {
      clearTimeout(t);
      signal?.removeEventListener("abort", onAbort);
    });
  });
}

/** An EIP-1193-style provider for the single bootstrap read of the specifier contract (this read is NOT anonymized). */
function bootstrapProvider(route: Route, opts: ConnectOptions): { request(a: { method: string; params?: unknown[] }): Promise<unknown> } | string {
  const url = route.bootstrapChainId === SEPOLIA_CHAIN_ID ? opts.sepoliaRpcUrl : opts.mainnetRpcUrl;
  if (!url) return "needs VITE_MAINNET_RPC_URL for its one bootstrap read (the specifier is on Ethereum mainnet)";
  const client = createPublicClient({ chain: route.bootstrapChainId === SEPOLIA_CHAIN_ID ? sepolia : mainnet, transport: http(url) });
  return { request: ({ method, params }) => (client.request as (a: unknown) => Promise<unknown>)({ method, params }) };
}

/**
 * Tries each route in order. A route counts as active only after a real Sepolia `eth_chainId` read has gone
 * through its worker and come back as 11155111. If none works, reads stay direct and `active` is null.
 */
export async function connectAnon(opts: ConnectOptions): Promise<AnonOutcome> {
  const make = opts.makeWorker ?? defaultFactory;
  const ms = opts.timeoutMs ?? 60_000;
  const attempts: Attempt[] = [];
  for (const route of opts.routes ?? ROUTES) {
    if (opts.signal?.aborted) {
      attempts.push({ id: route.id, label: route.label, ok: false, reason: "skipped by the user" });
      continue;
    }
    opts.onTry?.(route);
    const provider = bootstrapProvider(route, opts);
    if (typeof provider === "string") {
      attempts.push({ id: route.id, label: route.label, ok: false, reason: provider });
      continue;
    }
    let worker: WorkerLike | undefined;
    try {
      worker = make({
        address: route.specifier,
        config: route.config?.(opts.env ?? {}) as never,
        preExisting: { rpcProvider: provider as never },
      });
      await timeout(worker.ready, ms, `${route.label} start-up`, opts.signal);
      const chain = await timeout(createReadClient(opts.sepoliaRpcUrl, worker.fetch).getChainId(), ms, `${route.label} test read`, opts.signal);
      if (chain !== SEPOLIA_CHAIN_ID) throw new Error(`test read returned chain ${chain}, expected ${SEPOLIA_CHAIN_ID}`);
      attempts.push({ id: route.id, label: route.label, ok: true });
      const w = worker;
      return { active: { id: route.id, label: route.label }, attempts, fetchFn: w.fetch, close: () => w.close() };
    } catch (e) {
      worker?.close();
      attempts.push({ id: route.id, label: route.label, ok: false, reason: errText(e) });
    }
  }
  return { active: null, attempts, close: () => undefined };
}

/** Plain-language status for the page. Never calls the direct path anonymous. */
export function routeStatusText(o: AnonOutcome): string[] {
  const lines: string[] = [];
  if (o.active) {
    const rest = o.attempts.filter((a) => !a.ok).map((a) => a.label);
    lines.push(`Reads go through ${o.active.label}.`);
    lines.push(
      `Start-up order: ${ROUTES.map((r) => r.label).join(", then ")}, then direct reads. If this route fails later, reads fail with an error; they do not silently switch to direct.`,
    );
    if (rest.length > 0) lines.push(`Tried first and failed: ${rest.join("; ")}.`);
  } else {
    lines.push("Reads go directly from your browser to the RPC provider. They are not anonymous.");
    for (const a of o.attempts) lines.push(`${a.label}: ${a.reason ?? "failed"}.`);
  }
  lines.push(
    "Not covered: the one start-up read of the routing contract is direct, the bulk evidence read from Arkiv is direct, and your wallet still signs and sends transactions itself.",
  );
  return lines;
}
