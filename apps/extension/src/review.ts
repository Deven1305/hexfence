import './style.css';
import { record } from './interception';
import { mayContinue } from './policy';
import type { Review } from './check';
const id = new URL(location.href).searchParams.get('id');
const out = document.querySelector<HTMLElement>('#review')!;
const status = document.querySelector<HTMLElement>('#status')!;
const suffix = document.querySelector<HTMLInputElement>('#suffix')!;
const go = document.querySelector<HTMLButtonElement>('#continue')!;
const reject = document.querySelector<HTMLButtonElement>('#reject')!;
let review: Review | undefined;
let expired = false;
let finished = false;
function update(): void { go.disabled = finished || expired || !review || !mayContinue(review, suffix.value); }
suffix.oninput = update;
async function refresh(): Promise<void> {
  if (finished) return;
  try {
    const value = await chrome.runtime.sendMessage({ type: 'view', id });
    if (!record(value) || !Array.isArray(value.sentences)) throw new Error();
    review = value as unknown as Review;
    expired = value.expired === true;
    out.dataset.level = review.level;
    out.replaceChildren();
    const lines = [review.level, ...review.sentences,
      ...(review.recipient ? [`Recipient: ${review.recipient}`] : []),
      ...(review.safe ? [`Safe account: ${review.safe}`] : []),
      ...(review.guard ? [`Active Guard: ${review.guard}`] : []),
      ...(review.notice ? [review.notice] : [])];
    for (const line of lines) { const p = document.createElement('p'); p.textContent = line; out.append(p); }
    document.querySelector<HTMLElement>('#friction')!.hidden = review.level !== 'RED';
    go.textContent = review.level === 'RED' ? 'Continue anyway' : 'Continue to wallet';
    if (expired) status.textContent = 'Request ended or expired. Close this window and retry from the page.';
    else status.textContent = '';
    update();
  } catch { expired = true; status.textContent = 'Request unavailable. Close this window and retry.'; update(); }
}
async function decide(approved: boolean): Promise<void> {
  if (finished || (approved && go.disabled)) return;
  finished = true; update(); reject.disabled = true;
  try {
    const result = await chrome.runtime.sendMessage({ type: 'decide', id, approved, typed: suffix.value });
    status.textContent = record(result) && result.done === true ? 'Decision sent. You can close this window.' : 'Request ended. Retry from the page.';
  } catch { status.textContent = 'Request ended. Retry from the page.'; }
}
go.onclick = () => { void decide(true); };
reject.onclick = () => { void decide(false); };
void refresh();
setInterval(() => { void refresh(); }, 1_000);
