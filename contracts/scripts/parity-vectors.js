// Records what the REAL HexFenceGuard does for many transactions, so packages/shared can check that
// its decoder + verdict agree with the contract case by case (packages/shared/test/parity.test.ts).
//   cd contracts && npx hardhat run scripts/parity-vectors.js
// Writes packages/shared/test/fixtures/guard-parity.json. Deterministic: same seed, same file.
const fs = require("fs");
const path = require("path");
const { ethers } = require("hardhat");

// Small deterministic PRNG (mulberry32), so the fixture is reproducible.
let seed = 0x4e184120;
const rand = () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const pick = (xs) => xs[Math.floor(rand() * xs.length)];
const randHex = (bytes) => "0x" + Array.from({ length: bytes }, () => Math.floor(rand() * 256).toString(16).padStart(2, "0")).join("");
const A = (h) => ethers.getAddress(h.toLowerCase());

// Synthetic addresses (not real users). P/L is the ready-made demo pair; Q/Q2 a second pair.
const P = A("0x4E185e251Ac7fB83E9DE10723EAda46cadE74120");
const L = A("0x4E185a3FC4B530244aB9ed0dE38167b403344120");
const Q = A("0x1234567890abcdef1234567890abcdef12345678");
const Q2 = A("0x1234ffffffffffffffffffffffffffffffff5678");
const B = A("0x7c41d2e09b3f5a6c8e1d4f2a0b9c3e5d7f6a1b20");
const TOKEN = A("0xdAC17F958D2ee523a2206206994597C13D831ec7");

async function main() {
  const [safeSigner] = await ethers.getSigners(); // acts as the Safe: the Guard keys config by msg.sender
  const guard = await (await ethers.getContractFactory("HexFenceGuard")).deploy();
  await (await guard.approvePayee(P)).wait();
  await (await guard.approvePayee(Q)).wait();
  const SAFE = safeSigner.address;
  const GUARD = await guard.getAddress();
  const erc20 = new ethers.Interface([
    "function transfer(address,uint256)",
    "function transferFrom(address,address,uint256)",
    "function approve(address,uint256)",
  ]);

  const recipients = [P, L, Q, Q2, B, ethers.Wallet.createRandom().address];
  const targets = [...recipients, TOKEN, SAFE, GUARD];
  const dataShapes = {
    empty: () => "0x",
    transfer: () => erc20.encodeFunctionData("transfer", [pick(recipients), BigInt(Math.floor(rand() * 1e9))]),
    transferFrom: () => erc20.encodeFunctionData("transferFrom", [pick(recipients), pick(recipients), 1n]),
    approve: () => erc20.encodeFunctionData("approve", [pick(recipients), 1n]),
    // A transfer/transferFrom to L cut at a random length: the Guard inspects it only if it is long enough.
    truncated: () => {
      const d = rand() < 0.5 ? erc20.encodeFunctionData("transfer", [L, 1n]) : erc20.encodeFunctionData("transferFrom", [B, L, 1n]);
      return d.slice(0, 2 + 2 * Math.floor(rand() * ((d.length - 2) / 2)));
    },
    trailing: () => erc20.encodeFunctionData("transfer", [pick(recipients), 1n]) + randHex(1 + Math.floor(rand() * 40)).slice(2),
    dirty: () => "0xa9059cbb" + randHex(12).slice(2) + pick(recipients).slice(2).toLowerCase() + "00".repeat(31) + "01",
    random: () => randHex(Math.floor(rand() * 120)),
  };

  // Hand-picked cases first (the demo and the Guard tests), then random ones.
  const cases = [
    { to: P, value: "1", data: "0x", operation: 0 },
    { to: L, value: "1", data: "0x", operation: 0 },
    { to: B, value: "1", data: "0x", operation: 0 },
    { to: Q2, value: "1", data: "0x", operation: 0 },
    { to: TOKEN, value: "0", data: erc20.encodeFunctionData("transfer", [L, 1n]), operation: 0 },
    { to: TOKEN, value: "0", data: erc20.encodeFunctionData("transferFrom", [B, L, 1n]), operation: 0 },
    { to: TOKEN, value: "0", data: erc20.encodeFunctionData("transfer", [P, 1n]), operation: 0 },
    { to: B, value: "0", data: "0x", operation: 1 },
    { to: SAFE, value: "0", data: erc20.encodeFunctionData("transfer", [L, 1n]), operation: 0 },
    { to: GUARD, value: "0", data: "0xdeadbeef", operation: 0 },
    { to: SAFE, value: "0", data: "0x", operation: 1 },
  ];
  for (let i = 0; i < 400; i++) {
    const shape = pick(Object.keys(dataShapes));
    cases.push({ to: pick(targets), value: String(Math.floor(rand() * 3)), data: dataShapes[shape](), operation: rand() < 0.1 ? 1 : 0 });
  }

  const out = [];
  for (const c of cases) {
    let outcome = { reverted: false };
    try {
      await guard.checkTransaction(c.to, c.value, c.data, c.operation, 0, 0, 0, ethers.ZeroAddress, ethers.ZeroAddress, "0x", ethers.ZeroAddress);
    } catch (e) {
      const data = e?.data || e?.info?.error?.data;
      const parsed = guard.interface.parseError(data);
      if (!parsed) throw e; // anything but a Guard custom error is a bug worth seeing
      outcome = { reverted: true, error: parsed.name, args: parsed.args.map(String) };
    }
    out.push({ ...c, ...outcome });
  }

  // Fingerprint parity: the Solidity function on random addresses.
  const fingerprints = [];
  for (let i = 0; i < 300; i++) {
    const a = A(randHex(20));
    fingerprints.push({ address: a, fingerprint: await guard.fingerprint(a) });
  }

  const file = path.join(__dirname, "..", "..", "packages", "shared", "test", "fixtures", "guard-parity.json");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const fixture = { note: "Generated by contracts/scripts/parity-vectors.js from the real HexFenceGuard. Do not edit.", safe: SAFE, guard: GUARD, payees: [P, Q], cases: out, fingerprints };
  fs.writeFileSync(file, JSON.stringify(fixture, null, 2) + "\n");
  const reverts = out.filter((c) => c.reverted).length;
  console.log(`${out.length} cases (${reverts} reverted), ${fingerprints.length} fingerprints -> ${path.relative(process.cwd(), file)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
