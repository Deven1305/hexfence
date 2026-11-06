const { ethers } = require("hardhat");
const { expect } = require("chai");
const { setupV2, rejects } = require("./helpers/v2");
const fixture = require("./fixtures/loss-replay.json");

describe("Loss replay against HexFenceGuardV2", function () {
  it("replays one real suspected loss: payee transfer succeeds, lookalike transfer reverts", async () => {
    const f = await setupV2();
    const token = await (await ethers.getContractFactory("MockToken")).deploy();
    const amount = BigInt(fixture.amount);
    const impersonated = ethers.getAddress(fixture.impersonated);
    const lookalike = ethers.getAddress(fixture.lookalike);

    await token.mint(f.safe.target, amount * 2n);

    await f.admin("approve", [impersonated]);
    expect(await f.guard.isApproved(f.safe.target, impersonated)).to.equal(true);

    const transferPayee = token.interface.encodeFunctionData("transfer", [impersonated, amount]);
    await f.exec(token.target, 0, transferPayee);
    expect(await token.balanceOf(impersonated)).to.equal(amount);

    const transferLookalike = token.interface.encodeFunctionData("transfer", [lookalike, amount]);
    const err = await rejects(f.exec(token.target, 0, transferLookalike), f.guard.interface, "LookalikeOfKnownRecipient");
    expect(err.args[0]).to.equal(lookalike);
    expect(err.args[1]).to.equal(impersonated);
  });
});
