import type { Address, Hex } from "viem";
import { interpretRevert, type RevertInfo } from "./revert";
import type { ReadClient } from "./rpc";

/** Measured cost of a Guard-refused execTransaction is ~68k; this leaves headroom. */
export const FORCED_GAS_LIMIT = 200_000;

export type Simulation = { ok: true } | { ok: false; info: RevertInfo };

/** `eth_call` of the signed `execTransaction`. Safe checks signatures before the Guard, so this must run after signing. */
export async function simulateExec(reads: ReadClient, from: Address, safe: Address, data: Hex): Promise<Simulation> {
  try {
    await reads.call({ account: from, to: safe, data });
    return { ok: true };
  } catch (err) {
    return { ok: false, info: interpretRevert(err) };
  }
}

export type Plan = { send: false; info: RevertInfo } | { send: true; gasLimit?: number };

/**
 * Protocol Kit estimates gas unless `gasLimit` is set, and estimation reverts when the Guard refuses.
 * So a Guard refusal of a lookalike is sent with an explicit gas limit (it then reverts on-chain and leaves a hash);
 * any other revert is shown and not sent.
 */
export function planFromSimulation(sim: Simulation): Plan {
  if (sim.ok) return { send: true };
  if (sim.info.kind === "lookalike") return { send: true, gasLimit: FORCED_GAS_LIMIT };
  return { send: false, info: sim.info };
}
