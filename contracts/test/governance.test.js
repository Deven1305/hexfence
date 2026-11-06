const { ethers } = require("hardhat");
const { expect } = require("chai");
const { setupV2, rejects, Z, P, L, B } = require("./helpers/governance");
const sentinel = "0x0000000000000000000000000000000000000001";
const guardSlot = "0x4a204f620c8c5ccdca3fd54d003badd85ba500436a431f0cbda4f558c93c34c8";
function resembles(address) {
  const a = address.toLowerCase();
  return ethers.getAddress(a.slice(0, 10) + (a[10] === "0" ? "1" : "0") + a.slice(11));
}
describe("HexFenceGovernanceGuardV2 governance on real Safe 1.4.1", function () {
  let f;
  beforeEach(async () => { f = await setupV2(); });
  function payload(fn, candidate) {
    const args = fn === "addOwnerWithThreshold" ? [candidate, 1] : fn === "swapOwner" ? [sentinel, f.owner.address, candidate] : [candidate];
    return f.safe.interface.encodeFunctionData(fn, args);
  }
  for (const [fn, selector] of [["addOwnerWithThreshold", "0x0d582f13"], ["swapOwner", "0xe318b52b"], ["enableModule", "0x610b5925"]]) {
    it(`refuses ${fn} resembling an existing owner`, async () => {
      const candidate = resembles(f.owner.address);
      const call = payload(fn, candidate);
      expect(call.slice(0, 10)).to.equal(selector);
      const error = await rejects(f.exec(f.safe.target, 0, call), f.guard.interface, "LookalikeOfExistingOwner");
      expect(error.args.candidate).to.equal(candidate);
      expect(error.args.existingOwner).to.equal(f.owner.address);
      expect(await f.safe.getOwners()).to.deep.equal([f.owner.address]);
      expect(await f.safe.isModuleEnabled(candidate)).to.equal(false);
    });
    it(`refuses ${fn} resembling a learned recipient`, async () => {
      await f.admin("setAutoLearn", [true]); await f.exec(P, 1, "0x");
      const error = await rejects(f.exec(f.safe.target, 0, payload(fn, L)), f.guard.interface, "LookalikeOfKnownRecipient");
      expect(error.args.recipient).to.equal(L);
      expect(error.args.knownHolder).to.equal(P);
    });
  }
  it("allows an owner-signed exact known add-owner without learning administration", async () => {
    await f.admin("approve", [P]); await f.admin("setAutoLearn", [true]);
    const data = payload("addOwnerWithThreshold", P);
    const nonce = await f.safe.nonce();
    const hash = await f.safe.getTransactionHash(f.safe.target, 0, data, 0, 0, 0, 0, Z, Z, nonce);
    const signed = ethers.Signature.from(await ethers.provider.send("eth_sign", [f.owner.address, hash]));
    const signature = ethers.concat([signed.r, signed.s, ethers.toBeHex(signed.v + 4, 1)]);
    const rc = await (await f.safe.execTransaction(f.safe.target, 0, data, 0, 0, 0, 0, Z, Z, signature)).wait();
    expect(rc.logs.some(l => { try { return f.safe.interface.parseLog(l)?.name === "ExecutionSuccess"; } catch { return false; } })).to.equal(true);
    expect(await f.safe.isOwner(P)).to.equal(true);
    expect(await f.safe.getThreshold()).to.equal(1n);
    expect(await f.guard.knownRecipients(f.safe.target)).to.deep.equal([P]);
    expect(await f.guard.firstPaidAt(f.safe.target, P)).to.equal(0n);
  });
  it("allows non-lookalike swapOwner and exact known module enablement", async () => {
    await f.admin("approve", [P]);
    await f.exec(f.safe.target, 0, payload("enableModule", P));
    expect(await f.safe.isModuleEnabled(P)).to.equal(true);
    await f.exec(f.safe.target, 0, payload("addOwnerWithThreshold", f.other.address));
    // other is now the linked-list head. The NEW owner is the third argument.
    await f.exec(f.safe.target, 0, f.safe.interface.encodeFunctionData("swapOwner", [sentinel, f.other.address, B]));
    expect(await f.safe.isOwner(B)).to.equal(true);
    expect(await f.safe.isOwner(f.other.address)).to.equal(false);
  });
  it("checks every current owner, including an owner behind the linked-list head", async () => {
    await f.exec(f.safe.target, 0, payload("addOwnerWithThreshold", f.other.address));
    expect((await f.safe.getOwners())[0]).to.equal(f.other.address);
    await rejects(f.exec(f.safe.target, 0, payload("enableModule", resembles(f.owner.address))), f.guard.interface, "LookalikeOfExistingOwner");
  });
  it("permits an exact existing-owner address as a module", async () => {
    await f.exec(f.safe.target, 0, payload("enableModule", f.owner.address));
    expect(await f.safe.isModuleEnabled(f.owner.address)).to.equal(true);
  });
  it("checks approved holders too and permits correction with forget", async () => {
    await f.admin("approve", [P]);
    await rejects(f.exec(f.safe.target, 0, payload("enableModule", L)), f.guard.interface, "LookalikeOfKnownRecipient");
    await f.admin("forget", [P]);
    await f.exec(f.safe.target, 0, payload("enableModule", L));
    expect(await f.safe.isModuleEnabled(L)).to.equal(true);
    expect(await f.guard.knownRecipients(f.safe.target)).to.deep.equal([]);
  });
  it("never reads owners or checks the setGuard argument, and removes/restores on a real Safe", async () => {
    // An EOA cannot answer getOwners. A collision in setGuard must still pass the hook.
    await f.guard.approve(P);
    await f.guard.checkTransaction(f.owner.address, 0, f.safe.interface.encodeFunctionData("setGuard", [L]), 0, 0, 0, 0, Z, Z, "0x", f.owner.address);
    await f.admin("approve", [P]);
    await f.exec(f.safe.target, 0, f.safe.interface.encodeFunctionData("setGuard", [Z]));
    expect(await ethers.provider.getStorage(f.safe.target, guardSlot)).to.equal(ethers.ZeroHash);
    await f.exec(f.safe.target, 0, payload("enableModule", L));
    expect(await f.safe.isModuleEnabled(L)).to.equal(true);
    await f.exec(f.safe.target, 0, f.safe.interface.encodeFunctionData("setGuard", [f.guard.target]));
    await rejects(f.exec(f.safe.target, 0, payload("addOwnerWithThreshold", L)), f.guard.interface, "LookalikeOfKnownRecipient");
  });
  it("does not interpret administration selectors sent to another target", async () => {
    await f.admin("approve", [P]);
    const rc = await (await f.exec(B, 0, payload("addOwnerWithThreshold", L))).wait();
    expect(rc.status).to.equal(1);
    expect(await f.safe.getOwners()).to.deep.equal([f.owner.address]);
  });
  it("leaves malformed self calldata to the Safe and retains later learning state", async () => {
    await f.admin("setAutoLearn", [true]);
    const rc = await (await f.exec(f.safe.target, 0, "0xe318b52b", 0, 150000)).wait();
    expect(rc.logs.some(l => { try { return f.safe.interface.parseLog(l)?.name === "ExecutionFailure"; } catch { return false; } })).to.equal(true);
    await f.exec(P, 1, "0x");
    expect(await f.guard.knownRecipients(f.safe.target)).to.deep.equal([P]);
  });
});
