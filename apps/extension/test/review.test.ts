import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { verdictFor } from '@hexfence/shared';
import { verdictText } from '../src/verdictCopy';
import { renderReview } from '../src/review';
import { mayContinue } from '../src/policy';
import type { Review } from '../src/check';

// Real lookalike pair from DEMO.md and spec section 3.5
const P = '0x4E185e251Ac7fB83E9DE10723EAda46cadE74120';
const L = '0x4E185a3FC4B530244aB9ed0dE38167b403344120';

interface StyleMap {
  backgroundColor?: string;
  [key: string]: string | undefined;
}

class FakeElement {
  tagName: string;
  className = '';
  attributes: Record<string, string> = {};
  children: FakeElement[] = [];
  dataset: Record<string, string> = {};
  style: StyleMap = {};
  private _textContent = '';

  constructor(tagName: string) {
    this.tagName = tagName.toUpperCase();
  }

  get textContent(): string {
    if (this.children.length === 0) return this._textContent;
    return this.children.map(c => c.textContent).join('');
  }

  set textContent(value: string) {
    this._textContent = value;
    this.children = [];
  }

  setAttribute(name: string, value: string): void {
    this.attributes[name] = value;
  }

  getAttribute(name: string): string | null {
    return this.attributes[name] ?? null;
  }

  append(...nodes: (FakeElement | string)[]): void {
    for (const node of nodes) {
      if (typeof node === 'string') {
        const textNode = new FakeElement('#text');
        textNode.textContent = node;
        this.children.push(textNode);
      } else {
        this.children.push(node);
      }
    }
  }

  replaceChildren(...nodes: (FakeElement | string)[]): void {
    this.children = [];
    this._textContent = '';
    this.append(...nodes);
  }

  querySelector(selector: string): FakeElement | null {
    return this.querySelectorAll(selector)[0] ?? null;
  }

  querySelectorAll(selector: string): FakeElement[] {
    if (selector.includes(' ')) {
      const parts = selector.split(/\s+/).filter(Boolean);
      let current: FakeElement[] = [this];
      for (const part of parts) {
        current = current.flatMap(el => el.querySelectorAll(part));
      }
      return current;
    }
    const results: FakeElement[] = [];
    const matches = (el: FakeElement): boolean => {
      if (selector.startsWith('.')) {
        const classes = selector.slice(1).split('.');
        const elClasses = el.className.split(/\s+/).filter(Boolean);
        return classes.every(c => elClasses.includes(c));
      }
      if (selector.includes('[') && selector.endsWith(']')) {
        const bracket = selector.indexOf('[');
        const tag = selector.slice(0, bracket);
        const attrExpr = selector.slice(bracket + 1, -1);
        if (tag && el.tagName.toLowerCase() !== tag.toLowerCase()) return false;
        if (attrExpr.includes('=')) {
          const [attr, val] = attrExpr.split('=');
          const cleanVal = val!.replace(/^["']|["']$/g, '');
          return el.getAttribute(attr!) === cleanVal;
        }
        return el.getAttribute(attrExpr) !== null;
      }
      return el.tagName.toLowerCase() === selector.toLowerCase();
    };

    const walk = (parent: FakeElement) => {
      for (const child of parent.children) {
        if (matches(child)) results.push(child);
        walk(child);
      }
    };
    walk(this);
    return results;
  }
}

class FakeDocument {
  createElement(tag: string): FakeElement {
    return new FakeElement(tag);
  }
}

describe('extension review window', () => {
  let prevDoc: unknown;

  beforeEach(() => {
    prevDoc = (globalThis as unknown as { document?: unknown }).document;
    (globalThis as unknown as { document: FakeDocument }).document = new FakeDocument();
  });

  afterEach(() => {
    (globalThis as unknown as { document: unknown }).document = prevDoc;
  });

  it('renders verdict card and AddressXray for real lookalike pair P and L', () => {
    // 1. Calculate verdict using shared logic
    const verdict = verdictFor({ kind: 'eth', recipient: L, amount: 1000000000000000000n }, [P]);
    expect(verdict).toEqual({
      level: 'RED',
      reason: 'resembles',
      recipient: L,
      payee: P,
    });
    if (verdict.level !== 'RED' || verdict.reason !== 'resembles') throw new Error('Expected resembles');

    const text = verdictText(verdict, { guardActive: true });
    const review: Review = {
      ...text,
      recipient: verdict.recipient,
      payee: verdict.payee,
      reason: verdict.reason,
      safe: '0x3BCc3969713778F3Ed26AE1490529eeBAD43FbD5',
      guard: '0xA061fB511D69e5c92E50E3BE5c789472d6f19748',
      ready: true,
    };

    // 2. Render inside the review window container (#review)
    const out = (globalThis as unknown as { document: FakeDocument }).document.createElement('div') as unknown as HTMLElement;
    const card = renderReview(out, review);

    // 3. Verify verdict card
    const fakeCard = card as unknown as FakeElement;
    expect(fakeCard.className).toBe('verdict RED');
    expect(fakeCard.getAttribute('role')).toBe('status');
    expect(out.dataset.level).toBe('RED');

    const heading = fakeCard.querySelector('strong');
    expect(heading?.textContent).toBe('RED');

    // 4. Verify pre-signing sentences
    const allText = fakeCard.textContent;
    expect(allText).toContain('Possible address poisoning.');
    expect(allText).toContain(`This recipient resembles your approved payee ${P}`);
    expect(allText).toContain('(same first 4 and last 4 characters) but is a different address.');
    expect(allText).toContain('Your protected Safe will refuse this payment.');

    // 5. Verify AddressXray instances for both Approved payee and Recipient
    const xrays = fakeCard.querySelectorAll('.hf-xray');
    expect(xrays).toHaveLength(2);

    // First X-Ray: Approved payee P
    const payeeXray = xrays[0]!;
    expect(payeeXray.querySelector('.hf-xray-label')?.textContent).toBe('Approved payee');
    const payeeCode = payeeXray.querySelector('code');
    expect(payeeCode?.getAttribute('aria-label')).toBe(`Approved payee: ${P}`);
    const payeeMatches = payeeXray.querySelectorAll('.hf-match');
    expect(payeeMatches.length).toBeGreaterThanOrEqual(2);
    expect(payeeMatches[0]?.textContent).toBe('4E18');
    expect(payeeMatches[payeeMatches.length - 1]?.textContent).toBe('4120');
    expect(payeeXray.querySelectorAll('.hf-diff').length).toBeGreaterThan(0);
    expect(payeeXray.querySelector('.hf-difference-count')?.textContent).toContain('characters differ');
    expect(payeeXray.querySelectorAll('.hf-colors i')).toHaveLength(8);

    // Second X-Ray: Recipient L
    const recipientXray = xrays[1]!;
    expect(recipientXray.querySelector('.hf-xray-label')?.textContent).toBe('Recipient');
    const recipientCode = recipientXray.querySelector('code');
    expect(recipientCode?.getAttribute('aria-label')).toBe(`Recipient: ${L}`);
    const recipientMatches = recipientXray.querySelectorAll('.hf-match');
    expect(recipientMatches.length).toBeGreaterThanOrEqual(2);
    expect(recipientMatches[0]?.textContent).toBe('4E18');
    expect(recipientMatches[recipientMatches.length - 1]?.textContent).toBe('4120');
    expect(recipientXray.querySelectorAll('.hf-diff').length).toBeGreaterThan(0);
    expect(recipientXray.querySelector('.hf-difference-count')?.textContent).toContain('characters differ');
    expect(recipientXray.querySelectorAll('.hf-colors i')).toHaveLength(8);

    // 6. Verify friction policy on the lookalike recipient
    expect(mayContinue(review, '344120')).toBe(true); // last 6 of L
    expect(mayContinue(review, 'E74120')).toBe(false); // last 6 of P cannot unlock L
    expect(mayContinue(review, '123456')).toBe(false);

    // 7. Verify UI text rules: no forbidden words
    expect(allText).not.toMatch(/\b(verified|scam|malicious)\b/i);
    expect(allText).not.toMatch(/\bsafe\s+(payment|transaction|recipient|transfer|payee)\b/i);
  });

  it('renders single AddressXray for approved payee on GREEN', () => {
    const verdict = verdictFor({ kind: 'eth', recipient: P, amount: 1n }, [P]);
    expect(verdict.level).toBe('GREEN');
    if (verdict.level !== 'GREEN') throw new Error('Expected approved');

    const text = verdictText(verdict, { guardActive: true });
    const review: Review = {
      ...text,
      recipient: verdict.recipient,
      ready: true,
    };

    const out = (globalThis as unknown as { document: FakeDocument }).document.createElement('div') as unknown as HTMLElement;
    const card = renderReview(out, review) as unknown as FakeElement;

    expect(card.className).toBe('verdict GREEN');
    expect(card.querySelector('strong')?.textContent).toBe('GREEN');
    const xrays = card.querySelectorAll('.hf-xray');
    expect(xrays).toHaveLength(1);
    expect(xrays[0]?.querySelector('.hf-xray-label')?.textContent).toBe('Recipient');
    expect(xrays[0]?.querySelector('code')?.getAttribute('aria-label')).toBe(`Recipient: ${P}`);
  });

  it('renders CANNOT VERIFY header on GREY without X-Ray', () => {
    const review: Review = {
      level: 'GREY',
      sentences: ['Cannot verify this transaction type. HexFence checks only ETH and ERC-20 transfers.'],
      ready: true,
    };

    const out = (globalThis as unknown as { document: FakeDocument }).document.createElement('div') as unknown as HTMLElement;
    const card = renderReview(out, review) as unknown as FakeElement;

    expect(card.className).toBe('verdict GREY');
    expect(card.querySelector('strong')?.textContent).toBe('CANNOT VERIFY');
    expect(card.querySelectorAll('.hf-xray')).toHaveLength(0);
  });
});
