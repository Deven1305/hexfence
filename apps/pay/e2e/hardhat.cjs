const path = require('node:path');
const { createRequire } = require('node:module');
const contracts = path.resolve(__dirname, '../../..', 'contracts');
const req = createRequire(path.join(contracts, 'package.json'));
req('@nomicfoundation/hardhat-ethers');
module.exports = {
  solidity: { version: '0.8.26', settings: { optimizer: { enabled: true, runs: 200 } } },
  paths: { root: contracts, sources: path.join(contracts, 'contracts') },
  networks: { hardhat: { chainId: 11155111, allowUnlimitedContractSize: true, throwOnTransactionFailures: false } },
};

