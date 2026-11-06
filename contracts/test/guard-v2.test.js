const { ethers } = require("hardhat");
const { expect } = require("chai");
const { setupV2, rejects, Z, P, L, B } = require("./helpers/v2");
describe("HexFenceGuardV2 on real Safe 1.4.1", function () {
  let f, token;
  beforeEach(async () => {
    f = await setupV2();
    token = await (await ethers.getContractFactory("MockToken")).deploy();
    await token.mint(f.safe.target, 1000);
  });
  const data = (fn, args) => token.interface.encodeFunctionData(fn, args);
  it("is opt-in and learning-off permits new recipients without recording them", async () => {
    expect(await f.safe.VERSION()).to.equal("1.4.1");
    expect(await f.guard.supportsInterface("0xe6d7a83a")).to.equal(true);
    expect(await f.guard.autoLearn(f.safe.target)).to.equal(false);
    await f.exec(P, 1, "0x");
    expect(await f.guard.knownRecipients(f.safe.target)).to.deep.equal([]);
    await f.admin("approve", [P]);
    await rejects(f.exec(L, 1, "0x"), f.guard.interface, "LookalikeOfKnownRecipient");
  });
  it("learns only after success, allows exact and new recipients, records first-paid time", async () => {
    await f.admin("setAutoLearn", [true]);
    await f.exec(P, 1, "0x");
    const first = await f.guard.firstPaidAt(f.safe.target, P);
    expect(first > 0n).to.equal(true);
    await f.exec(P, 1, "0x"); await f.exec(B, 1, "0x");
    expect(await f.guard.firstPaidAt(f.safe.target, P)).to.equal(first);
    expect(await f.guard.knownRecipients(f.safe.target)).to.deep.equal([P, B]);
    const details = await f.guard.recipientDetails(f.safe.target);
    expect(details[0].recipient).to.equal(P); expect(details[0].approved).to.equal(false);
  });
  it("never learns a failed token payment, even when Safe records ExecutionFailure", async () => {
    await f.admin("setAutoLearn", [true]);
    const rc = await (await f.exec(token.target, 0, data("transfer", [B, 1001]), 0, 150000)).wait();
    expect(rc.logs.some(l => { try { return f.safe.interface.parseLog(l).name === "ExecutionFailure"; } catch { return false; } })).to.equal(true);
    expect(await f.guard.knownRecipients(f.safe.target)).to.deep.equal([]);
    await f.exec(P, 1, "0x");
    expect(await f.guard.knownRecipients(f.safe.target)).to.deep.equal([P]);
  });
  it("incoming token dust and forged after hooks cannot teach another Safe", async () => {
    await f.admin("setAutoLearn", [true]);
    await token.mint(f.other.address, 1); await token.connect(f.other).transfer(f.safe.target, 1);
    await f.guard.connect(f.other).checkAfterExecution(ethers.ZeroHash, true);
    expect(await f.guard.knownRecipients(f.safe.target)).to.deep.equal([]);
  });
  it("refuses learned lookalikes for ETH, transfer and transferFrom", async () => {
    await f.admin("setAutoLearn", [true]); await f.exec(P, 1, "0x");
    for (const [to, value, payload] of [[L, 1, "0x"], [token.target, 0, data("transfer", [L, 1])], [token.target, 0, data("transferFrom", [f.other.address, L, 1])]]) {
      const e = await rejects(f.exec(to, value, payload), f.guard.interface, "LookalikeOfKnownRecipient");
      expect(e.args.map(String)).to.deep.equal([L, P]);
    }
  });
  it("closes the ETH-with-calldata gap, including mixed ETH and token recipients", async () => {
    await f.admin("approve", [P]);
    await rejects(f.exec(L, 1, "0x00"), f.guard.interface, "LookalikeOfKnownRecipient");
    await rejects(f.exec(L, 1, data("transfer", [P, 1])), f.guard.interface, "LookalikeOfKnownRecipient");
  });
  it("learns both recipients of a successful native-plus-token call", async () => {
    const payableToken = await (await ethers.getContractFactory("V2PayableToken")).deploy();
    await f.admin("setAutoLearn", [true]);
    await f.exec(payableToken.target, 1, payableToken.interface.encodeFunctionData("transfer", [P, 1]));
    expect(await f.guard.knownRecipients(f.safe.target)).to.deep.equal([payableToken.target, P]);
  });
  it("shares one fingerprint map across approval and learning; forget then approve replaces it", async () => {
    await f.admin("setAutoLearn", [true]); await f.exec(P, 1, "0x");
    try { await f.admin("approve", [L]); throw Error("expected GS013"); } catch (e) { expect(e.message).to.include("GS013"); }
    await f.admin("approve", [P]);
    expect((await f.guard.recipientDetails(f.safe.target))[0].approved).to.equal(true);
    await f.admin("forget", [P]); await f.admin("approve", [L]);
    expect(await f.guard.holderOf(f.safe.target, "0x4e184120")).to.equal(L);
    expect(await f.guard.firstPaidAt(f.safe.target, P)).to.equal(0n);
    expect(await f.guard.knownRecipients(f.safe.target)).to.deep.equal([L]);
  });
  it("refuses delegatecall and keeps the administration / removal drill available", async () => {
    await f.admin("approve", [P]);
    await rejects(f.exec(B, 0, "0x", 1), f.guard.interface, "DelegateCallNotAllowed");
    await f.exec(f.safe.target, 0, f.safe.interface.encodeFunctionData("setGuard", [Z]));
    await f.exec(L, 1, "0x");
    await f.exec(f.safe.target, 0, f.safe.interface.encodeFunctionData("setGuard", [f.guard.target]));
    await rejects(f.exec(L, 1, "0x"), f.guard.interface, "LookalikeOfKnownRecipient");
  });
  it("keeps namespaces separate and forget's swap-and-pop preserves another holder", async () => {
    await f.admin("approve", [P]); await f.admin("approve", [B]);
    await f.admin("forget", [P]);
    expect(await f.guard.knownRecipients(f.safe.target)).to.deep.equal([B]);
    await f.guard.connect(f.other).approve(L);
    expect(await f.guard.holderOf(f.safe.target, "0x4e184120")).to.equal(Z);
    expect(await f.guard.holderOf(f.other.address, "0x4e184120")).to.equal(L);
  });
  it("reports gas for new and repeat guarded ETH payments", async () => {
    await f.admin("setAutoLearn", [true]);
    const first = await (await f.exec(P, 1, "0x")).wait();
    const repeat = await (await f.exec(P, 1, "0x")).wait();
    console.log(`      v2 ETH execTransaction gas: new=${first.gasUsed}, repeat=${repeat.gasUsed}`);
    expect(first.gasUsed > repeat.gasUsed).to.equal(true);
  });
  async function signedNested(safe, to, value, payload, nonce) {
    const hash = await safe.getTransactionHash(to, value, payload, 0, 0, 0, 0, Z, Z, nonce);
    // Safe's documented eth_sign signature format uses v+4 for the prefix.
    const signed = ethers.Signature.from(await ethers.provider.send("eth_sign", [f.owner.address, hash]));
    const signature = ethers.concat([signed.r, signed.s, ethers.toBeHex(signed.v + 4, 1)]);
    return safe.interface.encodeFunctionData("execTransaction", [to, value, payload, 0, 0, 0, 0, Z, Z, signature]);
  }
  it("nested same-Safe payments preserve both pending frames", async () => {
    const target = await (await ethers.getContractFactory("V2ReentryTarget")).deploy();
    await f.admin("setAutoLearn", [true]);
    const nested = await signedNested(f.safe, B, 1, "0x", await f.safe.nonce() + 1n);
    await f.exec(target.target, 1, target.interface.encodeFunctionData("reenter", [f.safe.target, nested]));
    expect(await f.guard.knownRecipients(f.safe.target)).to.deep.equal([B, target.target]);
  });
  it("a nested admin frame cannot consume the outer recipient", async () => {
    const target = await (await ethers.getContractFactory("V2ReentryTarget")).deploy();
    await f.admin("setAutoLearn", [true]);
    const nested = await signedNested(f.safe, f.guard.target, 0, f.guard.interface.encodeFunctionData("approve", [B]), await f.safe.nonce() + 1n);
    await f.exec(target.target, 1, target.interface.encodeFunctionData("reenter", [f.safe.target, nested]));
    expect(await f.guard.firstPaidAt(f.safe.target, target.target) > 0n).to.equal(true);
    expect(await f.guard.firstPaidAt(f.safe.target, B)).to.equal(0n);
  });
  it("nested different-Safe execution cannot overwrite the outer Safe's pending data", async () => {
    const second = await setupV2();
    await second.exec(second.safe.target, 0, second.safe.interface.encodeFunctionData("setGuard", [f.guard.target]));
    await second.exec(f.guard.target, 0, f.guard.interface.encodeFunctionData("setAutoLearn", [true]));
    await f.admin("setAutoLearn", [true]);
    const target = await (await ethers.getContractFactory("V2ReentryTarget")).deploy();
    const nested = await signedNested(second.safe, B, 1, "0x", await second.safe.nonce());
    await f.exec(target.target, 1, target.interface.encodeFunctionData("reenter", [second.safe.target, nested]));
    expect(await f.guard.knownRecipients(second.safe.target)).to.deep.equal([B]);
    expect(await f.guard.knownRecipients(f.safe.target)).to.deep.equal([target.target]);
  });
});
