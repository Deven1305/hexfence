// Optional preload for the existing v1-only Pay test harness. Preserve its
// network settings and v1 compiler while compiling the new sources with Cancun.
const path = require("node:path");
process.env.HARDHAT_CONFIG = path.resolve(__dirname, "../../apps/pay/e2e/hardhat.cjs");
const { config } = require("hardhat");
const settings = config.solidity.compilers.find(c => c.version === "0.8.26")?.settings;
if (!settings) throw Error("Expected the v1 compiler configuration");
for (const source of ["contracts/HexFenceGuardV2.sol", "contracts/HexFenceGovernanceGuardV2.sol", "contracts/test/V2Targets.sol"])
  config.solidity.overrides[source] = {
    version: "0.8.28", settings: { ...settings, evmVersion: "cancun", optimizer: { enabled: true, runs: 200 } },
  };
