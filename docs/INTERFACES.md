# HexFence: frozen interfaces (only Lane A changes this file, and only on request)

These signatures are a contract. Lane A implements them exactly. Lanes B and C import them and may code against them before A has pushed. Addresses use viem's `Address` type; hex values use `Hex`.

## `@hexfence/shared` (`packages/shared`, Lane A, task T2)
```ts
import type { Address, Hex } from "viem";

/** '0x' + first 4 hex + last 4 hex of the address, lowercase. Must match HexFenceGuard.fingerprint(). */
export function fingerprint(address: Address): Hex;                 // USDT -> 0xdac11ec7, USDC -> 0xa0b8eb48
export function sameFingerprint(a: Address, b: Address): boolean;   // true for the demo pair P/L (0x4e184120)

/** One Safe transaction (what execTransaction / SafeTx carry). operation: 0 = Call, 1 = DelegateCall. */
export interface SafeCall { to: Address; value: bigint; data: Hex; operation: 0 | 1 }

export function safeCallFromTypedData(typedData: unknown): SafeCall | null;           // eth_signTypedData_v4 payload, primaryType "SafeTx"; else null
export function safeCallFromExecTransaction(calldata: Hex): SafeCall | null;          // execTransaction calldata (0x6a761202); else null

export type DecodedPayment =
  | { kind: "eth"; recipient: Address; amount: bigint }
  | { kind: "erc20-transfer"; token: Address; recipient: Address; amount: bigint }          // 0xa9059cbb
  | { kind: "erc20-transferFrom"; token: Address; from: Address; recipient: Address; amount: bigint } // 0x23b872dd
  | { kind: "admin" }                                                                       // to == safe or to == guard (Call)
  | { kind: "delegatecall"; target: Address }
  | { kind: "unsupported"; to: Address; selector: Hex | null };

/** Same decoding rules and order as HexFenceGuard.checkTransaction. Never throws on bad calldata. */
export function decodeSafeCall(call: SafeCall, ctx: { safe: Address; guard: Address }): DecodedPayment;

export type Verdict =
  | { level: "GREEN"; reason: "approved"; recipient: Address }
  | { level: "RED"; reason: "listed"; recipient: Address; evidenceIds: Hex[] }   // P1 (T10): exact match only
  | { level: "RED"; reason: "resembles"; recipient: Address; payee: Address }
  | { level: "AMBER"; reason: "new"; recipient: Address }
  | { level: "GREY"; reason: "delegatecall" | "unsupported" | "admin" };

/**
 * Order: delegatecall/unsupported/admin -> GREY; recipient in payees -> GREEN;
 * listed (exact, case-insensitive) -> RED listed; same fingerprint as a payee -> RED resembles; else AMBER.
 * `listed` maps lowercase address -> evidenceIds. Pure function, no network.
 */
export function verdictFor(p: DecodedPayment, payees: Address[], listed?: Map<string, Hex[]>): Verdict;

/** Minimal viem ABI for the deployed guard: payees(address) -> address[], isApprovedPayee(address,address) -> bool,
 *  fingerprint(address) -> bytes4, approvePayee(address), removePayee(address), and the 5 custom errors. */
export const hexFenceGuardAbi: readonly unknown[];

export interface PoisoningEvidence {
  evidenceId: Hex; chainId: 1; lookalike: Address; impersonated: Address; victim: Address;
  variant: "zero-value" | "dust"; token: Address; attackTx: Hex; attackBlock: number;
  referenceTx: Hex; referenceBlock: number; prefixLen: number; suffixLen: number;
  detectorVersion: string; status: "suspected";
}
export const PoisoningEvidenceSchema: import("zod").ZodType<PoisoningEvidence>;
/** keccak256(encodeAbiParameters([uint256,address,address,string], [chainId, lookalike, impersonated, detectorVersion])) */
export function evidenceId(chainId: number, lookalike: Address, impersonated: Address, detectorVersion: string): Hex;

export const MAINNET_USDT: Address; // 0xdAC17F958D2ee523a2206206994597C13D831ec7
export const MAINNET_USDC: Address; // 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48
```

## `@hexfence/arkiv` (`packages/arkiv`, Lane A, task T4a; the writer in T4b)
```ts
import type { Address, Hex } from "viem";
import type { PoisoningEvidence } from "@hexfence/shared";

export const POISONING_SCHEMA_NAME = "hexfence.poisoning.v1";
export const PoisoningSchema: unknown;              // defineSchema(...), fields as in spec §3.2

/** Read-only client for the Rabdi testnet. accessKey is optional (the public RPC is rate-limited). */
export function arkivReadClient(opts?: { accessKey?: string }): unknown;

/** Bulk read of every record by one publisher (all pages). Used by the explorer and by Pay (T10). */
export function fetchAllEvidence(client: unknown, publisher: Address): Promise<PoisoningEvidence[]>;

/** Explorer search only (never used by Pay): records whose lookalike, impersonated or victim equals `address`. */
export function findEvidenceByAddress(client: unknown, publisher: Address, address: Address): Promise<PoisoningEvidence[]>;

/** Detector only (Node). Idempotent by evidenceId: returns created=false if it already exists. */
export function writeEvidence(walletClientOpts: { privateKey: Hex; accessKey?: string }, e: PoisoningEvidence):
  Promise<{ entityKey: Hex; created: boolean }>;
```
Use the SDK the way the installed version documents it (see the Decisions log: filter on `$creator` with `eq`, page by key, pages ≤100 rows). The signatures above stay the same.

## Environment variable names (values go in `.env`, never in git)
- **Lane A:** `MAINNET_RPC_URL`, `ARKIV_ACCESS_KEY`, `ARKIV_PRIVATE_KEY`, `SEPOLIA_RPC_URL`, `DEPLOYER_PRIVATE_KEY`
- **Browser (B, C):** `VITE_ARKIV_PUBLISHER`, `VITE_GUARD_ADDRESS`, `VITE_SEPOLIA_RPC_URL`, `VITE_ARKIV_ACCESS_KEY` (optional), `VITE_MAINNET_RPC_URL` (explorer receipt checks, T9)
