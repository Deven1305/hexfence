import type { Verdict } from "@hexfence/shared";

export const FRICTION_CHARS = 6;

/** The last 6 hex characters of the recipient, as shown to the user. */
export function frictionSuffix(recipient: string): string {
  return recipient.slice(-FRICTION_CHARS);
}

/** RED (both reasons) asks the user to type the last 6 hex characters of the recipient. */
export function requiresFriction(v: Verdict): boolean {
  return v.level === "RED";
}

/** Case-insensitive match of what the user typed against the recipient's last 6 hex characters. */
export function frictionSatisfied(recipient: string, typed: string): boolean {
  const t = typed.trim().toLowerCase();
  return t.length === FRICTION_CHARS && t === frictionSuffix(recipient).toLowerCase();
}
