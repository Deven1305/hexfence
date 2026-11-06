const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("HexFenceAlerts", function () {
  let alerts, forwarder, stranger, safe, p, l, chain;
  const hash = ethers.id("real report test fixture");
  beforeEach(async () => {
    [forwarder, stranger, safe] = await ethers.getSigners();
    alerts = await (await ethers.getContractFactory("HexFenceAlerts")).deploy(forwarder.address);
    p = "0x4e185e251ac7fb83e9de10723eada46cade74120";
    l = "0x4e185a3fc4b530244ab9ed0de38167b403344120";
    chain = (await ethers.provider.getNetwork()).chainId;
  });
  async function payload(overrides = {}) {
    return ethers.AbiCoder.defaultAbiCoder().encode(
      ["uint256", "address", "address", "tuple(address,address,bytes32,uint8,uint64)"],
      [overrides.chain ?? chain, overrides.receiver ?? await alerts.getAddress(), safe.address,
        [overrides.lookalike ?? l, p, hash, overrides.variant ?? 0, 1]]);
  }
  async function rejects(promise, message) {
    try { await promise; } catch (e) { expect(e.message).to.include(message); return; }
    throw Error("expected rejection");
  }
  it("accepts the forwarder, emits and exposes the report in one bulk read", async () => {
    const receipt = await (await alerts.onReport("0x", await payload())).wait();
    expect(receipt.logs.some(log => { try { return alerts.interface.parseLog(log).name === "PoisoningAttempt"; } catch { return false; } })).to.equal(true);
    const rows = await alerts.alertsOf(safe.address);
    expect(rows.length).to.equal(1); expect(rows[0].lookalike.toLowerCase()).to.equal(l);
    expect(await alerts.supportsInterface(ethers.id("onReport(bytes,bytes)").slice(0, 10))).to.equal(true);
  });
  it("rejects forged senders and wrong workflow identities", async () => {
    await rejects(alerts.connect(stranger).onReport("0x", await payload()), "InvalidSender");
    await alerts.setExpectedWorkflowId(ethers.id("expected"));
    const meta = ethers.solidityPacked(["bytes32", "bytes10", "address", "bytes2"], [ethers.id("other"), "0x00000000000000000000", stranger.address, "0x0000"]);
    await rejects(alerts.onReport(meta, await payload()), "InvalidWorkflowId");
  });
  it("rejects invalid reports and cross-chain / cross-consumer replay", async () => {
    for (const changes of [{ chain: 1 }, { receiver: stranger.address }, { variant: 2 }, { lookalike: p }, { lookalike: stranger.address }])
      await rejects(alerts.onReport("0x", await payload(changes)), "InvalidAlert");
  });
  it("deduplicates per Safe and retains exactly the latest 32 distinct lookalikes", async () => {
    await alerts.onReport("0x", await payload()); await alerts.onReport("0x", await payload());
    expect((await alerts.alertsOf(safe.address)).length).to.equal(1);
    for (let i = 1; i <= 33; i++) {
      const lookalike = "0x4e18" + i.toString(16).padStart(32, "0") + "4120";
      await alerts.onReport("0x", await payload({ lookalike }));
    }
    const rows = await alerts.alertsOf(safe.address);
    expect(rows.length).to.equal(32); expect(await alerts.contains(safe.address, l)).to.equal(false);
    expect(rows[0].lookalike.toLowerCase()).to.equal("0x4e18" + "2".padStart(32, "0") + "4120");
  });
});
