// Generate actual V2 decisions after learning through a real Safe 1.4.1.
// npx hardhat run scripts/parity-vectors-v2.js
const fs = require("node:fs");
const path = require("node:path");
const { ethers } = require("hardhat");
const { setupV2, P, L, B, Z } = require("../test/helpers/v2");
async function main() {
  const f = await setupV2();
  await f.admin("setAutoLearn", [true]); await f.exec(P, 1, "0x");
  const Q = ethers.getAddress("0x1234567890abcdef1234567890abcdef12345678");
  await f.admin("approve", [Q]);
  const original = JSON.parse(fs.readFileSync(path.join(__dirname, "../../packages/shared/test/fixtures/guard-parity.json"), "utf8"));
  const token = new ethers.Interface(["function transfer(address,uint256)", "function transferFrom(address,address,uint256)"]);
  const cases = original.cases.map(({ to, value, data, operation }) => ({ to: to === original.safe ? f.safe.target : to === original.guard ? f.guard.target : to, value, data, operation }));
  cases.push({ to: L, value: "1", data: "0x00", operation: 0 },
    { to: L, value: "1", data: token.encodeFunctionData("transfer", [P, 1]), operation: 0 },
    { to: B, value: "1", data: token.encodeFunctionData("transferFrom", [P, L, 1]), operation: 0 });
  const direct = f.guard.connect(ethers.provider);
  const out = [];
  for (const c of cases) {
    let result = { reverted: false };
    try {
      await direct.checkTransaction.staticCall(c.to, c.value, c.data, c.operation, 0, 0, 0, Z, Z, "0x", Z, { from: f.safe.target });
    } catch (e) {
      const parsed = f.guard.interface.parseError(e.data || e.info?.error?.data);
      if (!parsed) throw e;
      result = { reverted: true, error: parsed.name, args: parsed.args.map(String) };
    }
    out.push({ ...c, ...result });
  }
  const known = (await f.guard.recipientDetails(f.safe.target)).map(k => ({ recipient: k.recipient, approved: k.approved, firstPaidAt: String(k.firstPaidAt) }));
  const fixture = { note: "Generated from actual HexFenceGuardV2 after a real Safe 1.4.1 execution. Not live evidence. Do not hand-edit.", safe: f.safe.target, guard: f.guard.target, known, cases: out };
  fs.writeFileSync(path.join(__dirname, "../../packages/shared/test/fixtures/guard-v2-parity.json"), JSON.stringify(fixture, null, 2) + "\n");
  console.log(`${out.length} V2 decisions recorded; ${out.filter(c => c.reverted).length} reverts`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
