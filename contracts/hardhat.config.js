require("@nomicfoundation/hardhat-ethers");

// Testnet only. Never put a key that holds real funds here.
const { SEPOLIA_RPC_URL, DEPLOYER_PRIVATE_KEY } = process.env;

module.exports = {
  solidity: { version: "0.8.26", settings: { optimizer: { enabled: true, runs: 200 } } },
  networks: {
    // Safe 1.4.1 compiled with 0.8.x is larger than 24 KB; only the in-process test network needs this.
    hardhat: { allowUnlimitedContractSize: true },
    ...(SEPOLIA_RPC_URL && DEPLOYER_PRIVATE_KEY
      ? { sepolia: { url: SEPOLIA_RPC_URL, accounts: [DEPLOYER_PRIVATE_KEY] } }
      : {}),
  },
};
