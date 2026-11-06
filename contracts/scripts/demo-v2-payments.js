// HUMAN-RUN ONLY: sends funds. Never run under the agent's no-fund-transfer boundary.
// After a human funds the isolated Safe: node scripts/demo-v2-payments.js PAYEE LOOKALIKE
process.env.HARDHAT_NETWORK ??= "sepolia";
const { ethers, artifacts } = require("hardhat");
const fs = require("node:fs");
const path = require("node:path");
async function main() {
  if ((await ethers.provider.getNetwork()).chainId !== 11155111n) throw Error("Sepolia only");
  const [payee, lookalike] = process.argv.slice(2);
  if (!ethers.isAddress(payee) || !ethers.isAddress(lookalike) || payee.toLowerCase() === lookalike.toLowerCase()) throw Error("Distinct PAYEE and LOOKALIKE required");
  const record = JSON.parse(fs.readFileSync(path.join(__dirname, "../deployments/v2-safe-sepolia.json"), "utf8"));
  const [owner] = await ethers.getSigners();
  const safe = await ethers.getContractAt("Safe", record.safe);
  const guard = await ethers.getContractAt("HexFenceGuardV2", record.guard);
  if (await safe.VERSION() !== "1.4.1" || await safe.getThreshold() !== 1n || (await safe.getOwners()).length !== 1 || !(await safe.isOwner(owner.address))) throw Error("Isolated owner check failed");
  if (await ethers.provider.getCode(guard.target) !== (await artifacts.readArtifact("HexFenceGuardV2")).deployedBytecode) throw Error("Guard runtime differs");
  const active = "0x" + (await ethers.provider.getStorage(safe.target, "0x4a204f620c8c5ccdca3fd54d003badd85ba500436a431f0cbda4f558c93c34c8")).slice(-40);
  if (active.toLowerCase() !== guard.target.toLowerCase() || !await guard.autoLearn(safe.target)) throw Error("Expected active V2 with learning enabled");
  if (await guard.fingerprint(payee) !== await guard.fingerprint(lookalike)) throw Error("Addresses do not resemble each other");
  if ((await guard.knownRecipients(safe.target)).length !== 0) throw Error("Expected a fresh empty recipient list; refusing to repeat payment demo");
  if (await ethers.provider.getBalance(safe.target) < 2n) throw Error("Human must fund the isolated Safe with at least two Sepolia wei first");
  const signature = ethers.solidityPacked(["uint256", "uint256", "uint8"], [BigInt(owner.address), 0, 1]);
  const args = to => [to, 1n, "0x", 0, 0, 0, 0, ethers.ZeroAddress, ethers.ZeroAddress, signature];
  const paid = await (await safe.execTransaction(...args(payee))).wait();
  if ((await guard.holderOf(safe.target, await guard.fingerprint(payee))).toLowerCase() !== payee.toLowerCase()) throw Error("Payee was not learned");
  let preflight;
  try { await safe.execTransaction.staticCall(...args(lookalike)); }
  catch (e) { preflight = guard.interface.parseError(e.data || e.info?.error?.data); }
  if (preflight?.name !== "LookalikeOfKnownRecipient") throw Error("Expected learned-lookalike preflight refusal");
  const tx = await safe.execTransaction(...args(lookalike), { gasLimit: 350000 });
  let refused;
  try { refused = await tx.wait(); } catch (e) { refused = e.receipt; }
  if (refused?.status !== 0) throw Error("Expected a mined reverted lookalike transaction");
  const result = { safe: safe.target, guard: guard.target, payee, lookalike, payeeAmountWei: "1", payeeTransaction: paid.hash,
    lookalikeTransaction: tx.hash, lookalikeReceiptStatus: refused.status, preflightError: preflight.name };
  fs.writeFileSync(path.join(__dirname, "../deployments/v2-payment-demo-sepolia.json"), JSON.stringify(result, null, 2) + "\n");
  console.log(JSON.stringify(result, null, 2));
}
main().catch(() => { console.error("V2 payment demo stopped; check the isolated Safe, existing balance and parameters. Provider details withheld."); process.exitCode = 1; });
