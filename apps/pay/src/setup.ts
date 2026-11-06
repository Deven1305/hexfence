import { encodeFunctionData, getAddress, isAddressEqual, parseAbi, zeroAddress, type Address } from "viem";
import { fingerprint, hexFenceGuardAbi } from "@hexfence/shared";
import type { buildPaymentCall } from "./payment";
import type { SafeInfo } from "./safe";

/** Same shape as a payment call, so the setup transactions go through the same simulate -> sign -> send path. */
export type SetupCall = ReturnType<typeof buildPaymentCall>;

const safeAdminAbi = parseAbi(["function setGuard(address guard)"]);

/** Safe.setGuard(guard), sent by the Safe to itself. HexFenceGuard always allows a Call to the Safe itself. */
export function buildEnableGuardCall(safe: Address, guard: Address): SetupCall {
  return { to: safe, value: 0n, data: encodeFunctionData({ abi: safeAdminAbi, functionName: "setGuard", args: [guard] }), operation: 0 };
}

/** Safe.setGuard(0x0): the recovery path. Allowed by the Guard whatever else it is blocking. */
export function buildDisableGuardCall(safe: Address): SetupCall {
  return buildEnableGuardCall(safe, zeroAddress);
}

/** Guard.approvePayee(payee), sent by the Safe to the Guard (msg.sender at the Guard is the Safe). */
export function buildApprovePayeeCall(guard: Address, payee: Address): SetupCall {
  return { to: guard, value: 0n, data: encodeFunctionData({ abi: hexFenceGuardAbi, functionName: "approvePayee", args: [payee] }), operation: 0 };
}

/** Guard.removePayee(payee), sent by the Safe to the Guard. */
export function buildRemovePayeeCall(guard: Address, payee: Address): SetupCall {
  return { to: guard, value: 0n, data: encodeFunctionData({ abi: hexFenceGuardAbi, functionName: "removePayee", args: [payee] }), operation: 0 };
}

/** Whether the connected account can use the setup panel at all. Same limits as Pay's payment flow. */
export function setupBlocker(info: SafeInfo, account: Address): string | undefined {
  if (!info.owners.some((o) => isAddressEqual(o, account))) return "The connected account is not an owner of this Safe, so it cannot change its setup.";
  if (info.threshold > 1) return "Pay signs and sends in one step, so setup supports Safes with threshold 1 only.";
  if (info.guard.active === false && info.guard.reason === "unsupported") return "This Safe version does not support guards.";
  return undefined;
}

/**
 * What the Guard contract actually does once it is the Safe's guard (HexFenceGuard.checkTransaction):
 * - DelegateCall is always refused, so Safe batch transactions (MultiSend) and any other delegatecall fail.
 * - ETH, transfer and transferFrom to an address that has the same fingerprint as an approved payee, but is not that payee, are refused.
 * - Everything else is allowed, including a call from the Safe to itself or to the Guard.
 */
export function enableWarnings(info: SafeInfo): string[] {
  const lines = [
    "While the Guard is on, this Safe cannot send delegatecall transactions. That includes batched transactions (MultiSend), which will fail.",
    "ETH and ERC-20 transfers to an address that looks like one of your approved payees (same first 4 and last 4 characters) but is a different address will be refused.",
    "Nothing else is blocked. The Safe can still call itself and the Guard, so you can turn the Guard off again with setGuard(0x0) from this page.",
  ];
  if (info.guard.active === false && info.guard.reason === "different") {
    lines.unshift(`This replaces the guard that is set now (${info.guard.current}). That guard's rules stop applying.`);
  }
  if (info.payees.length === 0) {
    lines.push("No payees are approved yet, so no lookalike can be refused until you approve at least one.");
  }
  return lines;
}

export const DISABLE_WARNING =
  "After this, nothing on-chain refuses a lookalike payment from this Safe. Approved payees stay stored in the Guard but are not enforced.";

export type ApproveCheck = { ok: true; warning: string } | { ok: false; reason: string };

/**
 * Local pre-check of approvePayee against the payee list already read once from the Guard
 * (no per-recipient lookup). Mirrors the contract: zero address and duplicate fingerprint revert, an exact repeat is a no-op.
 */
export function checkApprove(raw: Address, payees: Address[]): ApproveCheck {
  const payee = getAddress(raw);
  if (isAddressEqual(payee, zeroAddress)) return { ok: false, reason: "The zero address cannot be an approved payee." };
  if (payees.some((p) => isAddressEqual(p, payee))) return { ok: false, reason: "That address is already an approved payee." };
  const fp = fingerprint(payee);
  const clash = payees.find((p) => fingerprint(p) === fp);
  if (clash) {
    return {
      ok: false,
      reason: `The Guard allows one payee per first-4/last-4 fingerprint, and ${clash} already has the same one. Remove ${clash} first if you want to approve this address instead.`,
    };
  }
  return {
    ok: true,
    warning: `Once approved, the Guard refuses ETH and ERC-20 transfers from this Safe to any other address that begins and ends like ${payee}. Check the full address with the recipient first.`,
  };
}

export function removeWarning(payee: Address): string {
  return `After removal, ${payee} is a new recipient: payments to it are no longer marked as approved, and lookalikes of it are no longer refused.`;
}
