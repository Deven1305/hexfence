// Read-only: node scripts/check-t8.js --guard ... --safe ... --p ... --l ... --b ...
// This entry point imports ethers, never Hardhat or a signer, and reads only the RPC env name.
const { ethers } = require('ethers');
const { parseArgs } = require('node:util');
const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

// Confirmed in @safe-global/safe-contracts/contracts/base/GuardManager.sol:
// bytes32 internal constant GUARD_STORAGE_SLOT = keccak256("guard_manager.guard.address").
const GUARD_SLOT = '0x4a204f620c8c5ccdca3fd54d003badd85ba500436a431f0cbda4f558c93c34c8';
const safeAbi = require('@safe-global/safe-contracts/build/artifacts/contracts/Safe.sol/Safe.json').abi;
const safeInterface = new ethers.Interface(safeAbi);
const guardInterface = new ethers.Interface([
  'function payees(address) view returns (address[])',
  'event PayeeApproved(address indexed safe,address indexed payee,bytes4 fingerprint)',
  'error LookalikeOfApprovedPayee(address recipient,address approvedPayee)',
]);
const tokenInterface = new ethers.Interface([
  'function transfer(address,uint256)', 'function transferFrom(address,address,uint256)',
]);
const addressNames = ['guard', 'safe', 'p', 'l', 'b'];
const hashNames = ['setguard', 'approve', 'remove', 'reenable', 'lpay', 'bpay', 'ppay'];
const NOT_CHECKED = 'not checked: explorer evidence, H6 wallet flow';
class CheckFailure extends Error {}
function ensure(ok, message) { if (!ok) throw new CheckFailure(message); }
const same = (a, b) => typeof a === 'string' && typeof b === 'string' && a.toLowerCase() === b.toLowerCase();

function parseOptions(argv) {
  let values;
  try { ({ values } = parseArgs({ args: argv, options: Object.fromEntries([...addressNames, ...hashNames].map(n => [n, { type: 'string' }])), allowPositionals: false })); }
  catch { throw new CheckFailure('Use named arguments: ' + [...addressNames, ...hashNames].map(n => '--' + n).join(' ')); }
  for (const name of addressNames) {
    ensure(ethers.isAddress(values[name] ?? ''), `Missing or invalid --${name} address`);
    values[name] = ethers.getAddress(values[name]);
  }
  for (const name of hashNames) ensure(ethers.isHexString(values[name], 32), `Missing or invalid --${name} transaction hash`);
  ensure(new Set(addressNames.map(n => values[n].toLowerCase())).size === 5, 'Guard, Safe, P, L and B must be distinct addresses');
  return values;
}

function events(receipt, address, iface, name) {
  return receipt.logs.filter(log => same(log.address, address)).flatMap(log => {
    try { const event = iface.parseLog(log); return event?.name === name ? [event] : []; } catch { return []; }
  });
}

function innerRecipient(data) {
  try {
    const call = safeInterface.parseTransaction({ data });
    if (call?.name !== 'execTransaction' || call.args.operation !== 0n) return null;
    if (call.args.data === '0x') return call.args.to;
    const token = tokenInterface.parseTransaction({ data: call.args.data });
    if (token?.name === 'transfer') return token.args[0];
    if (token?.name === 'transferFrom') return token.args[1];
  } catch { /* Unsupported/malformed calldata never counts as a checked payment. */ }
  return null;
}

// Read ethers/JSON-RPC error data structurally; never log raw provider errors or URLs.
function decodedLookalike(error, l, p) {
  const queue = [{ value: error, depth: 0 }];
  const seen = new Set();
  while (queue.length) {
    const { value, depth } = queue.shift();
    if (ethers.isHexString(value)) {
      try { const decoded = guardInterface.parseError(value); if (decoded?.name === 'LookalikeOfApprovedPayee' && same(decoded.args[0], l) && same(decoded.args[1], p)) return true; } catch {}
    } else if (value && typeof value === 'object' && depth < 6 && !seen.has(value)) {
      seen.add(value);
      for (const key of ['data', 'error', 'info', 'cause']) if (key in value) queue.push({ value: value[key], depth: depth + 1 });
    }
  }
  return false;
}

async function checkT8(provider, opts, log = console.log) {
  ensure((await provider.getNetwork()).chainId === 11155111n, 'Expected chain 11155111');
  ensure((await provider.getCode(opts.guard)) !== '0x', 'Guard has no code');
  const safe = new ethers.Contract(opts.safe, safeAbi, provider);
  const version = await safe.VERSION();
  log(`Safe VERSION(): ${version}`);
  ensure(version === '1.4.1', 'Expected Safe VERSION() 1.4.1');
  const current = ethers.getAddress('0x' + (await provider.getStorage(opts.safe, GUARD_SLOT)).slice(-40));
  ensure(same(current, opts.guard), 'Current Safe guard does not match --guard');
  const guard = new ethers.Contract(opts.guard, guardInterface, provider);
  const payees = await guard.payees(opts.safe);
  ensure(payees.some(p => same(p, opts.p)), 'payees(safe) does not include P');
  // Same first-4/last-4 fingerprint as the unchanged Guard; compute locally,
  // keeping the one bulk payees(safe) read free of per-recipient RPC lookups.
  const [fpP, fpL, fpB] = [opts.p, opts.l, opts.b].map(a => (a.slice(0, 6) + a.slice(-4)).toLowerCase());
  ensure(fpP === fpL, 'L does not share P fingerprint');
  ensure(fpP !== fpB, 'B shares P fingerprint');

  const receipts = {};
  for (const name of hashNames) {
    const receipt = await provider.getTransactionReceipt(opts[name]);
    ensure(receipt !== null, `${name}: receipt not found`);
    ensure(same(receipt.to, opts.safe), `${name}: tx.to is not the Safe`);
    ensure(receipt.status === (name === 'lpay' ? 0 : 1), `${name}: unexpected receipt status`);
    receipts[name] = receipt;
  }
  for (const [name, expected] of [['setguard', opts.guard], ['remove', ethers.ZeroAddress], ['reenable', opts.guard]]) {
    ensure(events(receipts[name], opts.safe, safeInterface, 'ChangedGuard').some(e => same(e.args.guard, expected)), `${name}: expected ChangedGuard event missing`);
  }
  ensure(events(receipts.approve, opts.guard, guardInterface, 'PayeeApproved').some(e => same(e.args.safe, opts.safe) && same(e.args.payee, opts.p)), 'approve: expected PayeeApproved(safe, P) from Guard missing');
  const removal = receipts.remove, reenable = receipts.reenable;
  ensure(removal.blockNumber < reenable.blockNumber || (removal.blockNumber === reenable.blockNumber && removal.index < reenable.index), 'Removal must be strictly earlier than re-enable');

  for (const [name, recipient] of [['lpay', opts.l], ['bpay', opts.b], ['ppay', opts.p]]) {
    const tx = await provider.getTransaction(opts[name]);
    ensure(tx !== null && same(tx.to, opts.safe), `${name}: tx.to is not the Safe`);
    ensure(same(innerRecipient(tx.data), recipient), `${name}: decoded inner recipient does not match`);
    if (name === 'lpay') {
      ensure(receipts.lpay.gasUsed < tx.gasLimit, 'lpay: gas exhausted; status 0 could be out-of-gas');
      let reason;
      try {
        await provider.send('eth_call', [{ from: tx.from, to: tx.to, data: tx.data,
          value: ethers.toQuantity(tx.value), gas: ethers.toQuantity(tx.gasLimit),
        }, ethers.toQuantity(receipts.lpay.blockNumber - 1)]);
      } catch (error) { reason = error; }
      if (!decodedLookalike(reason, opts.l, opts.p)) {
        log('status 0, reason not decoded');
        throw new CheckFailure('lpay: requires decoded LookalikeOfApprovedPayee(L, P)');
      }
      log('L replay: LookalikeOfApprovedPayee(L, P)');
    } else {
      ensure(events(receipts[name], opts.safe, safeInterface, 'ExecutionFailure').length === 0, `${name}: Safe emitted ExecutionFailure`);
      ensure(events(receipts[name], opts.safe, safeInterface, 'ExecutionSuccess').length > 0, `${name}: Safe ExecutionSuccess missing`);
    }
  }
  const rows = [
    ['HexFenceGuard (Sepolia)', opts.guard], ['Demo Safe', opts.safe], ['VERSION()', version],
    ['P (approved payee)', opts.p], ['L (synthetic lookalike)', opts.l], ['B (new supplier)', opts.b],
    ...hashNames.map(n => [({ setguard: 'setGuard tx', approve: 'approvePayee(P) tx', remove: 'Removal drill setGuard(0) tx', reenable: 'Removal drill re-enable tx', lpay: 'L payment (reverted)', bpay: 'B payment', ppay: 'P payment' })[n], opts[n]]),
  ];
  for (const [label, value] of rows) log(`| ${label} | ${value} |`);
  return rows;
}

async function main(argv = process.argv.slice(2)) {
  let provider;
  try {
    const opts = parseOptions(argv);
    const rpc = process.env.SEPOLIA_RPC_URL;
    ensure(!!rpc, 'Root .env needs SEPOLIA_RPC_URL; no private key is required');
    provider = new ethers.JsonRpcProvider(rpc, undefined, { cacheTimeout: -1 });
    await checkT8(provider, opts);
  } catch (error) {
    console.error(error instanceof CheckFailure ? error.message : 'T8 check failed: RPC/read error (provider details withheld)');
    process.exitCode = 1;
  } finally { provider?.destroy(); console.log(NOT_CHECKED); }
}
module.exports = { checkT8, parseOptions, innerRecipient, GUARD_SLOT, NOT_CHECKED };
if (require.main === module) void main();
