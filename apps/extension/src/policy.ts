import type { Review } from './check';
export function mayContinue(review: Review, typed: unknown): boolean {
  if (!review.ready) return false;
  if (review.level !== 'RED') return true;
  if (!review.recipient || typeof typed !== 'string') return false;
  const text = typed.trim().toLowerCase();
  return text.length === 6 && text === review.recipient.slice(-6).toLowerCase();
}
