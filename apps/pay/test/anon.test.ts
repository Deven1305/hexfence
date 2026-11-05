import { describe, expect, it } from "vitest";
import { connectAnon, ROUTES, routeStatusText, type WorkerFactory, type WorkerLike } from "../src/anon";

const PASSTHROUGH = "0x4fd77be300f31c5fe6ab266d35d27750a3478d27";
const jsonFetch = (chainHex: string): typeof fetch =>
  (async () => new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result: chainHex }), { headers: { "content-type": "application/json" } })) as typeof fetch;

const workerOf = (over: Partial<WorkerLike>): WorkerLike => ({ ready: Promise.resolve(), fetch: jsonFetch("0xaa36a7"), close: () => undefined, ...over });
const base = { sepoliaRpcUrl: "https://sepolia.example", timeoutMs: 500 };

describe("T11 anonymous read routes", () => {
  it("never lists the passthrough specifier", () => {
    expect(ROUTES.map((r) => r.specifier.toLowerCase())).not.toContain(PASSTHROUGH);
    expect(ROUTES.map((r) => r.id)).toEqual(["nox"]);
  });

  it("uses the first route whose worker starts and answers a Sepolia chain-id read", async () => {
    const seen: string[] = [];
    const make: WorkerFactory = (init) => (seen.push(init.address), workerOf({}));
    const o = await connectAnon({ ...base, makeWorker: make });
    expect(o.active?.id).toBe("nox");
    expect(seen).toEqual(["0x35133267A8F7EC35046a83DCA0f4Ca8A6e1b7A9A"]);
    expect(o.fetchFn).toBeTypeOf("function");
    expect(routeStatusText(o).join(" ")).toMatch(/Reads go through Nox.*Start-up order: Nox.*then direct reads.*do not silently switch/);
  });

  it("rejects a wrong-chain answer, closes Nox and labels direct fallback", async () => {
    const closed: string[] = [];
    const make: WorkerFactory = () => workerOf({ fetch: jsonFetch("0x1"), close: () => closed.push("nox") });
    const o = await connectAnon({ ...base, makeWorker: make });
    expect(o.active).toBeNull();
    expect(o.attempts.map((a) => [a.id, a.ok])).toEqual([["nox", false]]);
    expect(o.attempts[0]?.reason).toMatch(/chain 1, expected 11155111/);
    expect(closed).toEqual(["nox"]);
    expect(routeStatusText(o).join(' ')).toMatch(/not anonymous/);
  });

  it("when nothing works, reads are direct and the page does not call them anonymous", async () => {
    const o = await connectAnon({ ...base, makeWorker: () => workerOf({ ready: Promise.reject(new Error("boom")) }) });
    expect(o.active).toBeNull();
    expect(o.fetchFn).toBeUndefined();
    const t = routeStatusText(o).join("\n");
    expect(t).toMatch(/directly from your browser.*not anonymous/);
    expect(t).toMatch(/Nox.*boom/);
  });

  it("a hung worker times out and leaves reads direct", async () => {
    const o = await connectAnon({ ...base, timeoutMs: 50, makeWorker: () => workerOf({ ready: new Promise(() => undefined) }) });
    expect(o.attempts[0]?.reason).toMatch(/timed out/);
    expect(o.attempts).toHaveLength(1);
    expect(o.active).toBeNull();
  });

  it("skip aborts remaining attempts", async () => {
    const ac = new AbortController();
    const p = connectAnon({ ...base, signal: ac.signal, makeWorker: () => workerOf({ ready: new Promise(() => undefined) }) });
    ac.abort();
    const o = await p;
    expect(o.active).toBeNull();
    expect(o.attempts.every((a) => /skipped by the user/.test(a.reason ?? ""))).toBe(true);
  });

  it("later anonymous read failures remain errors and never fetch directly", async () => {
    let calls = 0;
    const o = await connectAnon({ ...base, makeWorker: () => workerOf({ fetch: (async (...args) => {
      if (++calls === 1) return jsonFetch('0xaa36a7')(...args);
      throw new Error('mixnet disconnected');
    }) as typeof fetch }) });
    await expect(o.fetchFn!('https://sepolia.example')).rejects.toThrow('mixnet disconnected');
    expect(o.active?.id).toBe('nox');
  });
});
