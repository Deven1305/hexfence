// Resumable live operator steps; public state stays outside git, keys only in root .env.
// From contracts/: node scripts/live-gate.js deploy|setup|check
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { ethers } = require('ethers');
const root = path.resolve(__dirname, '../..');
const output = path.resolve(root, '../live-artifacts');
const envFile = path.join(root, '.env');
const env = require('dotenv').parse(fs.readFileSync(envFile));
fs.mkdirSync(output, { recursive: true });
const stateFile = path.join(output, 'live-chain.json');
let state = fs.existsSync(stateFile) ? JSON.parse(fs.readFileSync(stateFile)) : { rows: {} };
const save = () => fs.writeFileSync(stateFile, JSON.stringify(state, null, 2) + '\n');
function setPublic(name, value) {
  if (!['VITE_GUARD_ADDRESS', 'DEMO_SAFE_ADDRESS'].includes(name) || !ethers.isAddress(value)) throw new Error('Invalid public env update');
  let text = fs.readFileSync(envFile, 'utf8');
  const pattern = new RegExp('^' + name + '=.*$', 'm');
  text = pattern.test(text) ? text.replace(pattern, name + '=' + value) : text + '\n' + name + '=' + value + '\n';
  fs.writeFileSync(envFile, text, { mode: 0o600 }); env[name] = value;
}
async function main() {
  const mode = process.argv[2];
  if (mode === 'check') {
    const pay = JSON.parse(fs.readFileSync(path.join(output, 'pay-live.json')));
    const args = { guard: pay.guard, safe: pay.safe, p: pay.P, l: pay.L, b: pay.B,
      setguard: state.rows['setGuard tx'], approve: state.rows['approvePayee(P) tx'],
      remove: state.rows['Removal drill setGuard(0) tx'], reenable: state.rows['Removal drill re-enable tx'],
      bpay: pay.payments.bpay?.hash, ppay: pay.payments.ppay?.hash };
    for (const [label, hash] of [['scripted UI L', pay.payments.lpay?.hash], ['direct script, not Safe{Wallet}', pay.directL?.hash]]) {
      const argv = Object.entries({ ...args, lpay: hash }).flatMap(([name, value]) => ['--' + name, value ?? '']);
      const result = spawnSync(process.execPath, [path.join(__dirname, 'check-t8.js'), ...argv], {
        cwd: root, encoding: 'utf8', env: { ...process.env, SEPOLIA_RPC_URL: env.SEPOLIA_RPC_URL, DEPLOYER_PRIVATE_KEY: '', ARKIV_PRIVATE_KEY: '' },
      });
      fs.writeFileSync(path.join(output, label.startsWith('scripted') ? 'check-ui-L.txt' : 'check-direct-L.txt'), result.stdout + result.stderr);
      console.log(label + ': checker exit ' + result.status); process.stdout.write(result.stdout); process.stderr.write(result.stderr);
      state.checks ??= {}; state.checks[label] = { exit: result.status, hash }; save();
      if (result.status !== 0) process.exitCode = 1;
    }
    return;
  }
  if (!['deploy', 'setup'].includes(mode)) throw new Error('Use deploy, setup or check');
  const provider = new ethers.JsonRpcProvider(env.SEPOLIA_RPC_URL, undefined, { cacheTimeout: -1, pollingInterval: 2000 });
  try {
    if ((await provider.getNetwork()).chainId !== 11155111n) throw new Error('Wrong chain');
    const wallet = new ethers.Wallet(env.DEPLOYER_PRIVATE_KEY, provider);
    if ((await provider.getBalance(wallet.address)) === 0n) { console.error('Deployer has zero Sepolia ETH; waiting for funding.'); process.exitCode = 1; return; }
    const hre = require('hardhat'); await hre.run('compile');
    if (mode === 'deploy') {
      if (state.guard || env.VITE_GUARD_ADDRESS) {
        const address = state.guard ?? env.VITE_GUARD_ADDRESS;
        if ((await provider.getCode(address)) === '0x') throw new Error('Stored Guard is pending or missing; will not redeploy');
        setPublic('VITE_GUARD_ADDRESS', address); console.log('Reusing Guard:', address); return;
      }
      const artifact = await hre.artifacts.readArtifact('HexFenceGuard');
      const guard = await new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet).deploy();
      state.guard = await guard.getAddress(); state.deploymentHash = guard.deploymentTransaction().hash; save();
      console.log('Guard deployment tx:', state.deploymentHash);
      await guard.waitForDeployment();
      if (!(await guard.supportsInterface('0xe6d7a83a'))) throw new Error('Guard interface check failed');
      setPublic('VITE_GUARD_ADDRESS', state.guard);
      console.log('HexFenceGuard:', state.guard);
    } else {
      // Execute the original CLI entry point, preserving its diagnostics and actual output.
      const result = spawnSync(process.execPath, [path.join(__dirname, 'setup-demo.js')], {
        cwd: path.join(root, 'contracts'), encoding: 'utf8', env: { ...process.env },
      });
      const text = (result.stdout ?? '') + (result.stderr ?? '');
      if ([env.DEPLOYER_PRIVATE_KEY, env.ARKIV_PRIVATE_KEY].filter(Boolean).some(key => text.includes(key))) throw new Error('Refusing to record private material');
      fs.writeFileSync(path.join(output, 'setup-demo.txt'), text);
      for (const line of (result.stdout ?? '').split(/\r?\n/)) {
        const match = /^\| (.+?) \| (.+?) \|$/.exec(line);
        if (match) {
          state.rows[match[1]] = match[2]; save();
          if (match[1] === 'Demo Safe') setPublic('DEMO_SAFE_ADDRESS', match[2]);
        }
      }
      process.stdout.write(result.stdout ?? ''); process.stderr.write(result.stderr ?? '');
      if (result.status !== 0) process.exitCode = 1;
    }
  } finally { provider.destroy(); }
}
main().catch(() => { console.error('Live operator step failed; raw provider/key details withheld. Inspect saved public state and balances.'); process.exitCode = 1; });
