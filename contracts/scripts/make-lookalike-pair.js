// Synthetic Sepolia test pair: find two random keys whose addresses share the HexFence fingerprint
// (first 4 + last 4 hex chars). Birthday bound: ~77k keys on average, ~199k for 99%.
// Measured with ethers v6 in Node: ~1,700 keys/s -> usually 1-2 minutes.
// Usage: node scripts/make-lookalike-pair.js   (writes keys to .pair.local.json, which is git-ignored)
const fs = require("fs");
const { ethers } = require("ethers");
const fp = (a) => a.slice(2, 6).toLowerCase() + a.slice(-4).toLowerCase();
const seen = new Map();
let n = 0;
const t0 = Date.now();
for (;;) {
  const pk = ethers.hexlify(ethers.randomBytes(32));
  const addr = ethers.computeAddress(pk);
  n++;
  const f = fp(addr);
  const prev = seen.get(f);
  if (prev && prev.addr !== addr) {
    const out = { fingerprint: "0x" + f, P: prev, L: { addr, pk }, keysTried: n, seconds: (Date.now() - t0) / 1000,
      note: "SYNTHETIC test pair for Sepolia only. P = approved payee, L = its lookalike. Never fund on mainnet." };
    fs.writeFileSync(".pair.local.json", JSON.stringify(out, null, 2));
    console.log(`fingerprint 0x${f}\nP (approve this): ${prev.addr}\nL (lookalike):    ${addr}\n${n} keys, ${out.seconds}s. Keys saved to .pair.local.json (git-ignored).`);
    break;
  }
  seen.set(f, { addr, pk });
  if (n % 50000 === 0) console.error(`tried ${n} keys (${((Date.now() - t0) / 1000).toFixed(0)}s)...`);
}
