const { ethers } = require("hardhat");
const { expect } = require("chai");
const Z = ethers.ZeroAddress;
const A = (h) => ethers.getAddress(h.toLowerCase());
// Synthetic test addresses (not real users)
const P  = A("0x2ef9a83c5e1b77d04c3f9a2b6d81e0c452d18bf7"); // approved payee, fp 0x2ef98bf7
const L  = A("0x2ef970bc13aa94e2f05c7d6b8e3a21f991f38bf7"); // lookalike of P, same fp
const B  = A("0x7c41d2e09b3f5a6c8e1d4f2a0b9c3e5d7f6a1b20"); // genuinely new payee
const Q  = A("0x1234567890abcdef1234567890abcdef12345678"); // 2nd approved payee, fp 0x12345678
const Q2 = A("0x1234ffffffffffffffffffffffffffffffff5678"); // lookalike of Q
const GUARD_SLOT = "0x4a204f620c8c5ccdca3fd54d003badd85ba500436a431f0cbda4f558c93c34c8";

function revertData(e) {
  return e?.data || e?.error?.data || e?.info?.error?.data || e?.error?.error?.data;
}
async function expectCustomError(p, iface, name, args) {
  let threw = false;
  try { await p; } catch (e) {
    threw = true;
    const data = revertData(e);
    let parsed = null;
    try { parsed = iface.parseError(data); } catch (_) {}
    if (!parsed) throw new Error(`expected ${name}, got: ${e.shortMessage || e.message}`);
    expect(parsed.name).to.equal(name);
    if (args) expect(parsed.args.map(String)).to.deep.equal(args.map(String));
  }
  expect(threw, `expected revert ${name}`).to.equal(true);
}
async function expectRevertString(p, str) {
  let threw = false;
  try { await p; } catch (e) { threw = true; expect(e.message).to.include(str); }
  expect(threw, `expected revert ${str}`).to.equal(true);
}

describe("HexFenceGuard on a real Safe 1.4.1", function () {
  let owner, other, safe, guard, token, target, singleton, factory;

  async function exec(to, value, data, operation = 0) {
    const nonce = await safe.nonce();
    const hash = await safe.getTransactionHash(to, value, data, operation, 0, 0, 0, Z, Z, nonce);
    const sig = owner.signingKey.sign(hash).serialized; // r || s || v (27/28): plain ECDSA over safeTxHash
    return safe.execTransaction(to, value, data, operation, 0, 0, 0, Z, Z, sig);
  }
  const gi = () => guard.interface;

  beforeEach(async () => {
    [, other] = await ethers.getSigners();
    owner = ethers.Wallet.createRandom().connect(ethers.provider);
    await other.sendTransaction({ to: owner.address, value: ethers.parseEther("10") });
    singleton = await (await ethers.getContractFactory("Safe")).deploy();
    factory = await (await ethers.getContractFactory("SafeProxyFactory")).deploy();
    const init = singleton.interface.encodeFunctionData("setup", [[owner.address], 1, Z, "0x", Z, Z, 0, Z]);
    const tx = await factory.createProxyWithNonce(await singleton.getAddress(), init, 1);
    const rc = await tx.wait();
    const ev = rc.logs.map((l) => { try { return factory.interface.parseLog(l); } catch { return null; } }).find((x) => x && x.name === "ProxyCreation");
    safe = await ethers.getContractAt("Safe", ev.args.proxy);
    guard = await (await ethers.getContractFactory("HexFenceGuard")).deploy();
    token = await (await ethers.getContractFactory("MockToken")).deploy();
    target = await (await ethers.getContractFactory("DelegateTarget")).deploy();
    await other.sendTransaction({ to: await safe.getAddress(), value: ethers.parseEther("5") });
    await token.mint(await safe.getAddress(), 1000n);
    // enable guard + approve P, through real Safe transactions
    await (await exec(await safe.getAddress(), 0, safe.interface.encodeFunctionData("setGuard", [await guard.getAddress()]))).wait();
    await (await exec(await guard.getAddress(), 0, gi().encodeFunctionData("approvePayee", [P]))).wait();
  });

  it("supports the Safe Guard interface (0xe6d7a83a) and is installed", async () => {
    expect(await guard.supportsInterface("0xe6d7a83a")).to.equal(true);
    const slot = await ethers.provider.getStorage(await safe.getAddress(), GUARD_SLOT);
    expect(ethers.getAddress("0x" + slot.slice(26))).to.equal(await guard.getAddress());
  });

  it("fingerprint = first 4 hex || last 4 hex (shared test vectors)", async () => {
    expect(await guard.fingerprint(A("0xdAC17F958D2ee523a2206206994597C13D831ec7"))).to.equal("0xdac11ec7");
    expect(await guard.fingerprint(A("0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"))).to.equal("0xa0b8eb48");
    expect(await guard.fingerprint(Z)).to.equal("0x00000000");
    expect(await guard.fingerprint(P)).to.equal("0x2ef98bf7");
    expect(await guard.fingerprint(L)).to.equal("0x2ef98bf7");
  });

  it("allows ETH to the approved payee", async () => {
    await (await exec(P, 1n, "0x")).wait();
    expect(await ethers.provider.getBalance(P)).to.equal(1n);
  });

  it("refuses ETH to a lookalike of the approved payee", async () => {
    await expectCustomError(exec(L, 1n, "0x"), gi(), "LookalikeOfApprovedPayee", [L, P]);
  });

  it("allows a genuinely new recipient (not an allowlist)", async () => {
    await (await exec(B, 1n, "0x")).wait();
    expect(await ethers.provider.getBalance(B)).to.equal(1n);
  });

  it("refuses ERC-20 transfer and transferFrom to a lookalike, allows the payee", async () => {
    const t = await token.getAddress();
    await expectCustomError(exec(t, 0, token.interface.encodeFunctionData("transfer", [L, 1])), gi(), "LookalikeOfApprovedPayee", [L, P]);
    await expectCustomError(exec(t, 0, token.interface.encodeFunctionData("transferFrom", [other.address, L, 1])), gi(), "LookalikeOfApprovedPayee", [L, P]);
    await (await exec(t, 0, token.interface.encodeFunctionData("transfer", [P, 1]))).wait();
    expect(await token.balanceOf(P)).to.equal(1n);
  });

  it("fails closed on delegatecall", async () => {
    await expectCustomError(exec(await target.getAddress(), 0, target.interface.encodeFunctionData("poke"), 1), gi(), "DelegateCallNotAllowed", [await target.getAddress()]);
  });

  it("rejects approving a second payee with the same fingerprint", async () => {
    // Through the Safe: inner call reverts -> execTransaction reverts with GS013 (safeTxGas = 0, gasPrice = 0)
    await expectRevertString(exec(await guard.getAddress(), 0, gi().encodeFunctionData("approvePayee", [L])), "GS013");
    // Directly (an EOA's own namespace) to see the custom error
    await (await guard.connect(other).approvePayee(P)).wait();
    await expectCustomError(guard.connect(other).approvePayee(L), gi(), "FingerprintAlreadyApproved", ["0x2ef98bf7", P]);
  });

  it("removing one payee does not weaken another payee's protection", async () => {
    await (await exec(await guard.getAddress(), 0, gi().encodeFunctionData("approvePayee", [Q]))).wait();
    await (await exec(await guard.getAddress(), 0, gi().encodeFunctionData("removePayee", [P]))).wait();
    expect(await guard.payees(await safe.getAddress())).to.deep.equal([Q]);
    expect(await guard.payeeByFingerprint(await safe.getAddress(), "0x2ef98bf7")).to.equal(Z);
    await expectCustomError(exec(Q2, 1n, "0x"), gi(), "LookalikeOfApprovedPayee", [Q2, Q]);
    // P's fingerprint is free again, so L is now just a new recipient (owners removed P on purpose)
    await (await exec(L, 1n, "0x")).wait();
  });

  it("keeps each caller's configuration separate", async () => {
    await (await guard.connect(other).approvePayee(B)).wait();
    expect(await guard.isApprovedPayee(await safe.getAddress(), B)).to.equal(false);
    expect(await guard.isApprovedPayee(other.address, B)).to.equal(true);
  });

  it("never reverts on the administration path or on malformed calldata", async () => {
    const s = other.address; // acts as a Safe namespace for direct calls
    const blobs = ["0x", "0x00", "0xa9059cbb", "0xa9059cbb" + "00".repeat(40), "0x23b872dd" + "11".repeat(50), ethers.hexlify(ethers.randomBytes(7)), ethers.hexlify(ethers.randomBytes(300))];
    for (const d of blobs) {
      await guard.connect(other).checkTransaction(s, 0, d, 0, 0, 0, 0, Z, Z, "0x", Z);              // admin path (to == caller)
      await guard.connect(other).checkTransaction(await token.getAddress(), 0, d, 0, 0, 0, 0, Z, Z, "0x", Z); // short/odd calldata
    }
    // A real self-call with junk data still executes through the Safe
    await (await exec(await safe.getAddress(), 0, "0xdeadbeef")).wait();
  });

  it("removal drill: setGuard(0) through a real Safe transaction works while the guard is active", async () => {
    await (await exec(await safe.getAddress(), 0, safe.interface.encodeFunctionData("setGuard", [Z]))).wait();
    const slot = await ethers.provider.getStorage(await safe.getAddress(), GUARD_SLOT);
    expect(BigInt(slot)).to.equal(0n);
    await (await exec(L, 1n, "0x")).wait(); // guard gone: lookalike no longer blocked
    // re-enable and the protection is back
    await (await exec(await safe.getAddress(), 0, safe.interface.encodeFunctionData("setGuard", [await guard.getAddress()]))).wait();
    await expectCustomError(exec(L, 1n, "0x"), gi(), "LookalikeOfApprovedPayee", [L, P]);
  });

  it("reports gas for a guarded payment", async () => {
    const rc = await (await exec(P, 1n, "0x")).wait();
    console.log("      gas used by a guarded ETH payment (execTransaction):", rc.gasUsed.toString());
  });
});
