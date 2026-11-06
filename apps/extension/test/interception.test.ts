import { describe, expect, it, vi } from 'vitest';
import { encodeFunctionData, parseAbi } from 'viem';
import { gateRequest, matchRequest } from '../src/interception';
import { mayContinue } from '../src/policy';
import type { Review } from '../src/check';

const safe = '0x1111111111111111111111111111111111111111';
const recipient = '0x2222222222222222222222222222222222222222';
const typed = { primaryType: 'SafeTx', domain: { verifyingContract: safe, chainId: 11155111 },
  message: { to: recipient, value: '1', data: '0x', operation: 0 } };
describe('interception matching uses the shared decoders', () => {
  it.each([typed, JSON.stringify(typed)])('captures SafeTx JSON or object', payload => {
    expect(matchRequest({ method: 'eth_signTypedData_v4', params: [recipient, payload] })).toEqual({
      kind: 'SafeTx', safe, chainId: '11155111', call: { to: recipient, value: 1n, data: '0x', operation: 0 },
    });
  });
  it('matches broken SafeTx so it receives cannot verify', () => {
    expect(matchRequest({ method: 'eth_signTypedData_v4', params: [recipient, { ...typed, message: { data: 'broken' } }] })?.call).toBeNull();
  });
  it('captures execTransaction, including input alias', () => {
    const abi = parseAbi(['function execTransaction(address,uint256,bytes,uint8,uint256,uint256,uint256,address,address,bytes) payable returns (bool)']);
    const data = encodeFunctionData({ abi, functionName: 'execTransaction',
      args: [recipient, 1n, '0x', 0, 0n, 0n, 0n, safe, safe, '0x'] });
    for (const field of ['data', 'input']) {
      expect(matchRequest({ method: 'eth_sendTransaction', params: [{ to: safe, [field]: data }] })).toEqual({
        kind: 'execTransaction', safe, call: { to: recipient, value: 1n, data: '0x', operation: 0 },
      });
    }
  });
  it('matches a selector even if the remaining calldata is broken', () => {
    expect(matchRequest({ method: 'eth_sendTransaction', params: [{ to: safe, data: '0x6A761202' }] })?.call).toBeNull();
  });
  it.each([
    { method: 'eth_chainId' },
    { method: 'personal_sign', params: [JSON.stringify(typed)] },
    { method: 'eth_signTypedData_v4', params: [safe, '{'] },
    { method: 'eth_signTypedData_v4', params: [safe, { primaryType: 'Permit' }] },
    { method: 'eth_sendTransaction', params: [{ to: safe, data: '0xa9059cbb' }] },
    { method: 'eth_sendTransaction', params: [null] },
    { method: 'eth_sendTransaction', params: {} },
  ])('leaves other requests alone: $method', request => expect(matchRequest(request)).toBeNull());
});
describe('EIP-1193 rejection', () => {
  it('returns 4001 and never calls the wallet on Reject', async () => {
    const wallet = vi.fn();
    await expect(gateRequest(async () => false, wallet)).rejects.toMatchObject({ code: 4001, message: 'User rejected the request.' });
    expect(wallet).not.toHaveBeenCalled();
  });
  it('returns 4001 if the review bridge fails or closes', async () => {
    const wallet = vi.fn();
    await expect(gateRequest(async () => { throw new Error('closed'); }, wallet)).rejects.toMatchObject({ code: 4001 });
    expect(wallet).not.toHaveBeenCalled();
  });
  it('forwards once only on approval and preserves wallet errors', async () => {
    const wallet = vi.fn(async () => 'signature');
    await expect(gateRequest(async () => true, wallet)).resolves.toBe('signature');
    expect(wallet).toHaveBeenCalledTimes(1);
    const error = Object.assign(new Error('wallet'), { code: 4900 });
    await expect(gateRequest(async () => true, async () => { throw error; })).rejects.toBe(error);
  });
});
describe('RED friction', () => {
  const red: Review = { level: 'RED', sentences: [], recipient, ready: true };
  it.each(['', '22222', '2222222', '000000'])('rejects incomplete or incorrect suffix %s', text => expect(mayContinue(red, text)).toBe(false));
  it('accepts exactly six characters, with Pay trim/case semantics', () => {
    expect(mayContinue({ ...red, recipient: `${recipient.slice(0, -6)}aBcDef` }, ' ABCDEF ')).toBe(true);
  });
  it('does not allow a loading review or missing RED recipient', () => {
    expect(mayContinue({ ...red, ready: false }, '222222')).toBe(false);
    expect(mayContinue({ ...red, recipient: undefined }, '222222')).toBe(false);
  });
});
