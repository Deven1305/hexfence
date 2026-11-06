// Emit a real, zero-value Sepolia USDC demonstration event. No tokens are moved.
// node scripts/sentinel-event.js SAFE LOOKALIKE (load existing testnet env first)
const { ethers } = require("hardhat");
const fs = require("node:fs");
const path = require("node:path");
async function main() {
  if ((await ethers.provider.getNetwork()).chainId !== 11155111n) throw Error("Sepolia only");
  const [safe, lookalike] = process.argv.slice(2);
  if (!ethers.isAddress(safe) || !ethers.isAddress(lookalike)) throw Error("SAFE and LOOKALIKE arguments required");
  const guard = await ethers.getContractAt("HexFenceGuard", process.env.SENTINEL_GUARD_ADDRESS);
  const payees = await guard.payees(safe);
  const fp = x => x.slice(0, 6).toLowerCase() + x.slice(-4).toLowerCase();
  const resembles = payees.find(p => p.toLowerCase() !== lookalike.toLowerCase() && fp(p) === fp(lookalike));
  if (!resembles) throw Error("Demonstration lookalike must resemble an existing approved payee");
  // Circle's documented Sepolia USDC address (checked 06 Nov 2026).
  const token = new ethers.Contract("0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238", [
    "function transferFrom(address,address,uint256) returns (bool)",
    "event Transfer(address indexed from,address indexed to,uint256 value)",
  ], (await ethers.getSigners())[0]);
  const receipt = await (await token.transferFrom(safe, lookalike, 0n)).wait();
  const eventIndex = receipt.logs.findIndex(log => {
    if (log.address.toLowerCase() !== token.target.toLowerCase()) return false;
    try { const event = token.interface.parseLog(log); return event.name === "Transfer" && event.args.from.toLowerCase() === safe.toLowerCase() && event.args.to.toLowerCase() === lookalike.toLowerCase() && event.args.value === 0n; } catch { return false; }
  });
  if (eventIndex < 0) throw Error("Transaction emitted no matching zero-value event");
  const result = { chainId: 11155111, syntheticDemonstration: true, safe, lookalike, resembles,
    token: token.target, amount: "0", transactionHash: receipt.hash, blockNumber: receipt.blockNumber, eventIndex };
  fs.writeFileSync(path.join(__dirname, "../../sentinel/deployments/trigger-sepolia.json"), JSON.stringify(result, null, 2) + "\n");
  console.log(JSON.stringify(result, null, 2));
}
main().catch(() => { console.error("Demonstration event failed; check Sepolia config, approved payees and existing balance. Provider details withheld."); process.exitCode = 1; });
