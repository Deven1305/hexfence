const { ethers } = require("hardhat");
const { expect } = require("chai");
const { rejects, Z, P, L, B } = require("./helpers/v2");
const safeArtifact = require("@safe-global/safe-smart-account/build/artifacts/contracts/Safe.sol/Safe.json");
const factoryArtifact = require("@safe-global/safe-smart-account/build/artifacts/contracts/proxies/SafeProxyFactory.sol/SafeProxyFactory.json");

// Real Safe 1.5.0 from the official package, with an enabled module calling execTransactionFromModule.
describe("HexFenceModuleGuard on real Safe 1.5.0", function () {
  let owner, module, safe, guard, moduleGuard, token, exec, admin;
  const deploy = async (artifact) => new ethers.ContractFactory(artifact.abi, artifact.bytecode, owner).deploy();
  async function newSafe(nonce) {
    const event = await (await factory.createProxyWithNonce(singleton.target, init, nonce)).wait();
    const created = event.logs.map(l => { try { return factory.interface.parseLog(l); } catch { return null; } }).find(e => e?.name === "ProxyCreation");
    return new ethers.Contract(created.args.proxy, safeArtifact.abi, owner);
  }
  let singleton, factory, init;
  beforeEach(async () => {
    [owner, module] = await ethers.getSigners();
    singleton = await deploy(safeArtifact);
    factory = await deploy(factoryArtifact);
    init = singleton.interface.encodeFunctionData("setup", [[owner.address], 1, Z, "0x", Z, Z, 0, Z]);
    safe = await newSafe(1);
    guard = await (await ethers.getContractFactory("HexFenceGuardV2")).deploy();
    moduleGuard = await (await ethers.getContractFactory("HexFenceModuleGuard")).deploy(guard.target);
    token = await (await ethers.getContractFactory("MockToken")).deploy();
    await token.mint(safe.target, 1000);
    const signature = ethers.solidityPacked(["uint256", "uint256", "uint8"], [BigInt(owner.address), 0, 1]);
    exec = (to, value, data, target = safe) => target.execTransaction(to, value, data, 0, 0, 0, 0, Z, Z, signature);
    admin = (fn, args) => exec(safe.target, 0, safe.interface.encodeFunctionData(fn, args));
    await owner.sendTransaction({ to: safe.target, value: ethers.parseEther("1") });
    await admin("enableModule", [module.address]);
    await admin("setGuard", [guard.target]);
    await exec(guard.target, 0, guard.interface.encodeFunctionData("approve", [P]));
  });
  const viaModule = (to, value, data, op = 0, target = safe) => target.connect(module).execTransactionFromModule(to, value, data, op);
  const data = (fn, args) => token.interface.encodeFunctionData(fn, args);

  it("runs on Safe 1.5.0 and reports the module guard interface from the official source", async () => {
    expect(await safe.VERSION()).to.equal("1.5.0");
    expect(await moduleGuard.supportsInterface("0x58401ed8")).to.equal(true);
    expect(await moduleGuard.supportsInterface("0x01ffc9a7")).to.equal(true);
    expect(await moduleGuard.supportsInterface("0xe6d7a83a")).to.equal(false);
    await admin("setModuleGuard", [moduleGuard.target]);
  });

  it("without the module guard a module pays a lookalike; with it the same call reverts", async () => {
    const before = await ethers.provider.getBalance(L);
    await viaModule(L, 1, "0x");
    expect(await ethers.provider.getBalance(L)).to.equal(before + 1n);
    await admin("setModuleGuard", [moduleGuard.target]);
    const e = await rejects(viaModule(L, 1, "0x"), moduleGuard.interface, "LookalikeOfKnownRecipient");
    expect(e.args.map(String)).to.deep.equal([L, P]);
    expect(await ethers.provider.getBalance(L)).to.equal(before + 1n);
  });

  it("refuses lookalikes in ETH with calldata, transfer and transferFrom", async () => {
    await admin("setModuleGuard", [moduleGuard.target]);
    await rejects(viaModule(L, 1, "0x1234"), moduleGuard.interface, "LookalikeOfKnownRecipient");
    await rejects(viaModule(token.target, 0, data("transfer", [L, 1])), moduleGuard.interface, "LookalikeOfKnownRecipient");
    await rejects(viaModule(token.target, 0, data("transferFrom", [safe.target, L, 1])), moduleGuard.interface, "LookalikeOfKnownRecipient");
  });

  it("allows the exact holder and new recipients, and does not learn them", async () => {
    await admin("setModuleGuard", [moduleGuard.target]);
    const before = await ethers.provider.getBalance(B);
    await viaModule(P, 1, "0x");
    await viaModule(B, 1, "0x");
    await viaModule(token.target, 0, data("transfer", [P, 1]));
    expect(await ethers.provider.getBalance(B)).to.equal(before + 1n);
    expect(await token.balanceOf(P)).to.equal(1n);
    expect(await guard.knownRecipients(safe.target)).to.deep.equal([P]);
  });

  it("sees a holder learned by V2 from an owner-signed payment", async () => {
    await admin("setModuleGuard", [moduleGuard.target]);
    const lookalikeOfB = ethers.getAddress(B.slice(0, 6) + "ab".repeat(16) + B.slice(-4));
    await exec(guard.target, 0, guard.interface.encodeFunctionData("setAutoLearn", [true]));
    await exec(B, 1, "0x");
    expect(await guard.holderOf(safe.target, await guard.fingerprint(B))).to.equal(B);
    await rejects(viaModule(lookalikeOfB, 1, "0x"), moduleGuard.interface, "LookalikeOfKnownRecipient");
  });

  it("refuses delegatecall and leaves calls to the Safe and V2 unchecked", async () => {
    await admin("setModuleGuard", [moduleGuard.target]);
    await rejects(viaModule(token.target, 0, "0x", 1), moduleGuard.interface, "DelegateCallNotAllowed");
    await viaModule(safe.target, 0, safe.interface.encodeFunctionData("changeThreshold", [1]));
    await viaModule(guard.target, 0, guard.interface.encodeFunctionData("approve", [B]));
    expect(await guard.isApproved(safe.target, B)).to.equal(true);
  });

  it("keeps one Safe's list away from another Safe", async () => {
    await admin("setModuleGuard", [moduleGuard.target]);
    const second = await newSafe(2);
    await owner.sendTransaction({ to: second.target, value: 10 });
    await exec(second.target, 0, second.interface.encodeFunctionData("enableModule", [module.address]), second);
    await exec(second.target, 0, second.interface.encodeFunctionData("setModuleGuard", [moduleGuard.target]), second);
    const before = await ethers.provider.getBalance(L);
    await viaModule(L, 1, "0x", 0, second);
    expect(await ethers.provider.getBalance(L)).to.equal(before + 1n);
  });

  it("V2 works as the transaction guard on Safe 1.5.0, and owners can remove both guards", async () => {
    await admin("setModuleGuard", [moduleGuard.target]);
    await rejects(exec(L, 1, "0x"), guard.interface, "LookalikeOfKnownRecipient");
    await exec(P, 1, "0x");
    await admin("setModuleGuard", [Z]);
    await admin("setGuard", [Z]);
    const before = await ethers.provider.getBalance(L);
    await exec(L, 1, "0x");
    await viaModule(L, 1, "0x");
    expect(await ethers.provider.getBalance(L)).to.equal(before + 2n);
  });
});
