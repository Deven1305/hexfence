require("@nomicfoundation/hardhat-ethers");
require("@nomicfoundation/hardhat-verify");
require("./scripts/etherscan-v2");
// Secrets live in the repo-root .env (git-ignored); see ../.env.example for the names.
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });

// Testnet only. Never put a key that holds real funds here.
const { SEPOLIA_RPC_URL, DEPLOYER_PRIVATE_KEY, ETHERSCAN_API_KEY } = process.env;

module.exports = {
  solidity: { version: "0.8.26", settings: { optimizer: { enabled: true, runs: 200 } } },
  etherscan: {
    apiKey: { sepolia: ETHERSCAN_API_KEY || "" },
    // 2.0.13 supports Hardhat 2.22.17 (^2.0.4); override its retired V1 URL.
    customChains: [{ network: "sepolia", chainId: 11155111, urls: {
      apiURL: "https://api.etherscan.io/v2/api?chainid=11155111",
      browserURL: "https://sepolia.etherscan.io",
    } }],
  },
  networks: {
    // Safe 1.4.1 compiled with 0.8.x is larger than 24 KB; only the in-process test network needs this.
    hardhat: { allowUnlimitedContractSize: true },
    ...(SEPOLIA_RPC_URL
      ? { sepolia: { url: SEPOLIA_RPC_URL, accounts: DEPLOYER_PRIVATE_KEY ? [DEPLOYER_PRIVATE_KEY] : [] } }
      : {}),
  },
};
