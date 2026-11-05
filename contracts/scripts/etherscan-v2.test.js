const { expect } = require('chai');
const { createRequire } = require('node:module');
const req = createRequire(require.resolve('@nomicfoundation/hardhat-verify'));
const { MockAgent, getGlobalDispatcher, setGlobalDispatcher } = req('undici');
const { Etherscan } = require('@nomicfoundation/hardhat-verify/etherscan');

describe('pinned verifier V2 requests (scripted HTTP test, no live API)', function () {
  it('keeps Sepolia chainid on source check, submission and status requests', async function () {
    const original = getGlobalDispatcher();
    const agent = new MockAgent(); agent.disableNetConnect();
    setGlobalDispatcher(agent);
    const paths = [];
    try {
      const pool = agent.get('https://api.etherscan.io');
      for (const [method, body] of [
        ['GET', { status: '1', message: 'OK', result: [{ SourceCode: '' }] }],
        ['POST', { status: '1', message: 'OK', result: 'test-submission-id' }],
        ['GET', { status: '1', message: 'OK', result: 'Pass - Verified' }],
      ]) {
        pool.intercept({ method, path: (p) => { paths.push(p); return new URL(p, 'https://api.etherscan.io').searchParams.get('chainid') === '11155111'; } }).reply(200, body);
      }
      const api = new Etherscan('test-only-api-key', 'https://api.etherscan.io/v2/api?chainid=11155111', 'https://sepolia.etherscan.io');
      expect(await api.isVerified('0x0000000000000000000000000000000000000001')).to.equal(false);
      await api.verify('0x0000000000000000000000000000000000000001', '{}', 'contracts/HexFenceGuard.sol:HexFenceGuard', 'v0.8.26+commit.8a97fa7a', '');
      expect((await api.getVerificationStatus('test-submission-id')).isSuccess()).to.equal(true);
      expect(paths.length).to.be.at.least(3);
      agent.assertNoPendingInterceptors();
    } finally { setGlobalDispatcher(original); await agent.close(); }
  });
});
