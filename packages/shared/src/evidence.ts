import { encodeAbiParameters, getAddress, isAddress, keccak256, type Address, type Hex } from "viem";
import { z } from "zod";
import { fingerprint } from "./fingerprint.js";

/** Arkiv schema name (spec §2). Bump the version only with a new schema. */
export const SCHEMA_NAME = "hexfence.poisoning.v1";
/** Records expire on Arkiv after 30 days (spec §2). */
export const EXPIRY_DAYS = 30;
/** The only status a record ever has. Never "malicious" or "scammer". */
export const STATUS = "suspected";

/** The two canonical mainnet tokens the detector watches (both 6 decimals). */
export const MAINNET_USDT: Address = "0xdAC17F958D2ee523a2206206994597C13D831ec7";
export const MAINNET_USDC: Address = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";

export const VARIANTS = ["zero-value", "dust"] as const;
export type Variant = (typeof VARIANTS)[number];

/** One suspected address-poisoning attack on Ethereum mainnet, as in `evidence.jsonl` and on Arkiv. */
export interface PoisoningEvidence {
  evidenceId: Hex;
  chainId: 1;
  lookalike: Address;
  impersonated: Address;
  victim: Address;
  variant: Variant;
  token: Address;
  attackTx: Hex;
  attackBlock: number;
  referenceTx: Hex;
  referenceBlock: number;
  prefixLen: number;
  suffixLen: number;
  detectorVersion: string;
  status: "suspected";
}

const address = z
  .string()
  .refine((s) => isAddress(s, { strict: false }), "not an address")
  .transform((s) => getAddress(s));
const hash32 = z
  .string()
  .regex(/^0x[0-9a-fA-F]{64}$/, "not a 32-byte hash")
  .transform((s) => s.toLowerCase() as Hex);
const block = z.number().int().nonnegative();

/**
 * Validates a record (fields and indexed/plain split as in spec §3.2; see arkiv/schema.md) and
 * normalises it: checksummed addresses, lower-case hashes. There is deliberately no "confidence".
 * Anyone can write to Arkiv, so readers parse every record through this before showing it.
 */
export const PoisoningEvidenceSchema: z.ZodType<PoisoningEvidence> = z
  .object({
    evidenceId: hash32,
    chainId: z.literal(1),
    lookalike: address,
    impersonated: address,
    victim: address,
    variant: z.enum(VARIANTS),
    token: address,
    attackTx: hash32,
    attackBlock: block,
    referenceTx: hash32,
    referenceBlock: block,
    prefixLen: z.number().int().min(4).max(40),
    suffixLen: z.number().int().min(4).max(40),
    detectorVersion: z.string().min(1),
    status: z.literal(STATUS),
  })
  .strict()
  .superRefine((e, ctx) => {
    if (e.token !== MAINNET_USDT && e.token !== MAINNET_USDC)
      ctx.addIssue({ code: "custom", message: "token is not mainnet USDT or USDC" });
    // The record must describe a real resemblance: same fingerprint, different address.
    if (e.lookalike === e.impersonated) ctx.addIssue({ code: "custom", message: "lookalike equals impersonated" });
    if (fingerprint(e.lookalike) !== fingerprint(e.impersonated))
      ctx.addIssue({ code: "custom", message: "lookalike and impersonated have different fingerprints" });
    // The reference payment comes first (block order; same-block log order is checked by the detector).
    if (e.referenceBlock > e.attackBlock) ctx.addIssue({ code: "custom", message: "reference is after the attack" });
    if (e.evidenceId !== evidenceId(e.chainId, e.lookalike, e.impersonated, e.detectorVersion))
      ctx.addIssue({ code: "custom", message: "evidenceId does not match its fields" });
  });

/**
 * Idempotency key: keccak256(encodeAbiParameters([uint256,address,address,string],
 * [chainId, lookalike, impersonated, detectorVersion])). The same lookalike of the same address is
 * one record per detector version, however many victims or attack transactions it has.
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
