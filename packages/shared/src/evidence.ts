import { encodeAbiParameters, getAddress, isAddress, keccak256, type Address, type Hex } from "viem";
import { z } from "zod";
import { fingerprint } from "./fingerprint.js";

/** Arkiv schema name (spec §2). Bump the version only with a new schema. */
export const SCHEMA_NAME = "hexfence.poisoning.v1";
/** Records expire on Arkiv after 30 days (spec §2). */
export const EXPIRY_DAYS = 30;
/** The only status a record ever has. Never "malicious" or "scammer". */
export const STATUS = "suspected";

export const VARIANTS = ["zero-value", "dust"] as const;
export type Variant = (typeof VARIANTS)[number];

const address = z
  .string()
  .refine((s) => isAddress(s, { strict: false }), "not an address")
  .transform((s) => getAddress(s));
const txHash = z
  .string()
  .regex(/^0x[0-9a-fA-F]{64}$/, "not a tx hash")
  .transform((s) => s.toLowerCase() as Hex);
const block = z.number().int().nonnegative();

/**
 * One suspected address-poisoning attack, as written to `evidence.jsonl` and to Arkiv.
 * Field names and the indexed/plain split follow spec §3.2; see arkiv/schema.md.
 * There is deliberately no "confidence" score.
 */
export const PoisoningEvidence = z
  .object({
    // indexed on Arkiv
    evidenceId: z.string().regex(/^0x[0-9a-f]{64}$/),
    chainId: z.number().int().positive(),
    lookalike: address,
    impersonated: address,
    victim: address,
    variant: z.enum(VARIANTS),
    attackBlock: block,
    detectorVersion: z.string().min(1),
    // stored, not indexed
    token: address,
    attackTx: txHash,
    referenceTx: txHash,
    referenceBlock: block,
    prefixLen: z.number().int().min(4).max(40),
    suffixLen: z.number().int().min(4).max(40),
    status: z.literal(STATUS),
  })
  .strict()
  .superRefine((e, ctx) => {
    // The record must describe a real resemblance: same fingerprint, different address.
    if (e.lookalike === e.impersonated) ctx.addIssue({ code: "custom", message: "lookalike equals impersonated" });
    if (fingerprint(e.lookalike) !== fingerprint(e.impersonated))
      ctx.addIssue({ code: "custom", message: "lookalike and impersonated have different fingerprints" });
    // The reference payment comes first (block order; same-block order is checked by the detector).
    if (e.referenceBlock > e.attackBlock) ctx.addIssue({ code: "custom", message: "reference is after the attack" });
    if (e.evidenceId !== evidenceId(e.chainId, e.lookalike, e.impersonated, e.detectorVersion))
      ctx.addIssue({ code: "custom", message: "evidenceId does not match its fields" });
  });

export type PoisoningEvidence = z.output<typeof PoisoningEvidence>;

/**
 * Idempotency key: keccak256(abi.encode(uint256 chainId, address lookalike, address impersonated,
 * string detectorVersion)). The same lookalike of the same address is one record per detector
 * version, however many victims or attack transactions it has.
 */
export function evidenceId(chainId: number, lookalike: Address, impersonated: Address, detectorVersion: string): Hex {
  return keccak256(
    encodeAbiParameters(
      [{ type: "uint256" }, { type: "address" }, { type: "address" }, { type: "string" }],
      [BigInt(chainId), getAddress(lookalike), getAddress(impersonated), detectorVersion],
    ),
  );
}

/** How many leading and trailing hex characters two addresses share (case-insensitive). */
export function matchLengths(a: string, b: string): { prefixLen: number; suffixLen: number } {
  const x = a.toLowerCase().slice(2);
  const y = b.toLowerCase().slice(2);
  let prefixLen = 0;
  while (prefixLen < 40 && x[prefixLen] === y[prefixLen]) prefixLen++;
  let suffixLen = 0;
  while (suffixLen < 40 && x[39 - suffixLen] === y[39 - suffixLen]) suffixLen++;
  return { prefixLen, suffixLen };
}
