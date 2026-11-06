const { ethers } = require("hardhat");
const Z = ethers.ZeroAddress;
const P = ethers.getAddress("0x4e185e251ac7fb83e9de10723eada46cade74120");
const L = ethers.getAddress("0x4e185a3fc4b530244ab9ed0de38167b403344120");
const B = ethers.getAddress("0x7c42d2e09b3f5a6c8e1d4f2a0b9c3e5d7f6a1b20");
async function setupV2() {
  const [owner, other] = await ethers.getSigners();
  const singleton = await (await ethers.getContractFactory("Safe")).deploy();
  const factory = await (await ethers.getContractFactory("SafeProxyFactory")).deploy();
  const init = singleton.interface.encodeFunctionData("setup", [[owner.address], 1, Z, "0x", Z, Z, 0, Z]);
  const rc = await (await factory.createProxyWithNonce(await singleton.getAddress(), init, 2)).wait();
  const event = rc.logs.map(l => { try { return factory.interface.parseLog(l); } catch { return null; } }).find(e => e?.name === "ProxyCreation");
  const safe = await ethers.getContractAt("Safe", event.args.proxy);
  const guard = await (await ethers.getContractFactory("HexFenceGovernanceGuardV2")).deploy();
  const signature = ethers.solidityPacked(["uint256", "uint256", "uint8"], [BigInt(owner.address), 0, 1]);
  const exec = (to, value, data, op = 0, safeTxGas = 0) => safe.execTransaction(to, value, data, op, safeTxGas, 0, 0, Z, Z, signature);
  const admin = (fn, args) => exec(guard.target, 0, guard.interface.encodeFunctionData(fn, args));
  await owner.sendTransaction({ to: safe.target, value: ethers.parseEther("1") });
  await exec(safe.target, 0, safe.interface.encodeFunctionData("setGuard", [guard.target]));
  return { owner, other, safe, guard, exec, admin };
}
async function rejects(promise, iface, name) {
  try { await promise; } catch (e) {
    const parsed = iface.parseError(e.data || e.info?.error?.data);
    if (parsed?.name !== name) throw e;
    return parsed;
  }
  throw Error(`expected ${name}`);
}
module.exports = { setupV2, rejects, Z, P, L, B };
