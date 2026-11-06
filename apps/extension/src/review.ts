import '@hexfence/ui/style.css';
import './style.css';
import { AddressXray, VerdictCard } from '@hexfence/ui';
import { isAddress, type Address } from 'viem';
import { record } from './interception';
import { mayContinue } from './policy';
import type { Review } from './check';

export function renderReview(out: HTMLElement, review: Review): HTMLElement {
  out.dataset.level = review.level;
  const box = VerdictCard(review.level);
  const heading = document.createElement('strong');
  heading.textContent = review.level === 'GREY' ? 'CANNOT VERIFY' : review.level;
  box.append(heading);

  for (let i = 0; i < review.sentences.length; i++) {
    const sentence = review.sentences[i]!;
    const p = document.createElement('p');
    if (i === 0 && review.level === 'RED') {
      const strong = document.createElement('strong');
      strong.textContent = sentence;
      p.append(strong);
    } else {
      p.textContent = sentence;
    }
    box.append(p);
  }

  if (review.recipient) {
    if (isAddress(review.recipient, { strict: false })) {
      const recipient = review.recipient as Address;
      if (review.payee && isAddress(review.payee, { strict: false })) {
        const payee = review.payee as Address;
        const label = review.reason === 'resembles-known' ? 'Recorded recipient' : 'Approved payee';
        box.append(AddressXray(payee, recipient, label));
        box.append(AddressXray(recipient, payee, 'Recipient'));
      } else {
        box.append(AddressXray(recipient, undefined, 'Recipient'));
      }
    } else {
      const p = document.createElement('p');
      p.textContent = `Recipient: ${review.recipient}`;
      box.append(p);
    }
  }

  const meta = [
    ...(review.safe ? [`Safe account: ${review.safe}`] : []),
    ...(review.guard ? [`Active Guard: ${review.guard}`] : []),
    ...(review.notice ? [review.notice] : []),
  ];
  for (const line of meta) {
    const p = document.createElement('p');
    p.className = 'small';
    p.textContent = line;
    box.append(p);
  }

  out.replaceChildren(box);
  return box;
}

export function initReview(): void {
  const out = document.querySelector<HTMLElement>('#review');
  const status = document.querySelector<HTMLElement>('#status');
  const suffix = document.querySelector<HTMLInputElement>('#suffix');
  const go = document.querySelector<HTMLButtonElement>('#continue');
  const reject = document.querySelector<HTMLButtonElement>('#reject');
  if (!out || !status || !suffix || !go || !reject) return;

  const outEl = out;
  const statusEl = status;
  const suffixEl = suffix;
  const goEl = go;
  const rejectEl = reject;

  const id = new URL(location.href).searchParams.get('id');
  let review: Review | undefined;
  let expired = false;
  let finished = false;

  function update(): void {
    goEl.disabled = finished || expired || !review || !mayContinue(review, suffixEl.value);
  }
  suffixEl.oninput = update;

  async function refresh(): Promise<void> {
    if (finished) return;
    try {
      const value = await chrome.runtime.sendMessage({ type: 'view', id });
      if (!record(value) || !Array.isArray(value.sentences)) throw new Error();
      review = value as unknown as Review;
      expired = value.expired === true;
      renderReview(outEl, review);
      document.querySelector<HTMLElement>('#friction')!.hidden = review.level !== 'RED';
      goEl.textContent = review.level === 'RED' ? 'Continue anyway' : 'Continue to wallet';
      if (expired) statusEl.textContent = 'Request ended or expired. Close this window and retry from the page.';
      else statusEl.textContent = '';
      update();
    } catch {
      expired = true;
      statusEl.textContent = 'Request unavailable. Close this window and retry.';
      update();
    }
  }

  async function decide(approved: boolean): Promise<void> {
    if (finished || (approved && goEl.disabled)) return;
    finished = true;
    update();
    rejectEl.disabled = true;
    try {
      const result = await chrome.runtime.sendMessage({ type: 'decide', id, approved, typed: suffixEl.value });
      statusEl.textContent = record(result) && result.done === true ? 'Decision sent. You can close this window.' : 'Request ended. Retry from the page.';
    } catch {
      statusEl.textContent = 'Request ended. Retry from the page.';
    }
  }

  goEl.onclick = () => { void decide(true); };
  rejectEl.onclick = () => { void decide(false); };
  void refresh();
  setInterval(() => { void refresh(); }, 1_000);
}

if (typeof window !== 'undefined' && typeof chrome !== 'undefined' && typeof chrome.runtime?.sendMessage === 'function') {
  initReview();
}
