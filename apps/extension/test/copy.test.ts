import { expect, it } from 'vitest';
import type { Verdict } from '@hexfence/shared';
import { verdictText } from '../src/verdictCopy';
import paySource from '../../pay/src/verdictCopy.ts?raw';
import extensionSource from '../src/verdictCopy.ts?raw';
const recipient = '0x1111111111111111111111111111111111111111';
const payee = '0x2222222222222222222222222222222222222222';
it('keeps fixed English verdict strings identical to Pay', () => {
  // Compare the complete English switch, including interpolation and inactive-Guard copy.
  const english = (source: string) => source.slice(source.indexOf('  const t = ')).trim();
  expect(english(extensionSource)).toBe(english(paySource));
  const inactive = 'HexFence Guard is not active on this Safe, so nothing on-chain will stop this payment.';
  expect(paySource).toContain(inactive);
  expect(extensionSource).toContain(inactive);
  const verdicts: Verdict[] = [
    { level: 'GREEN', reason: 'approved', recipient },
    { level: 'AMBER', reason: 'new', recipient },
    { level: 'RED', reason: 'resembles', recipient, payee },
    { level: 'RED', reason: 'listed', recipient, evidenceIds: [] },
    ...(['admin', 'unsupported', 'delegatecall'] as const).map(reason => ({ level: 'GREY' as const, reason })),
  ];
  for (const verdict of verdicts) for (const guardActive of [true, false]) {
    const context = { guardActive, publisher: payee };
    const text = verdictText(verdict, context);
    expect(text.sentences.join(' ')).not.toMatch(/\b(verified|scam|malicious)\b/i);
  }
});
