const path = require('node:path');
const base = require('../hardhat.config');
module.exports = {
  ...base,
  paths: { root: path.resolve(__dirname, '..') },
  networks: { ...base.networks, hardhat: { ...base.networks.hardhat, chainId: 11155111, throwOnTransactionFailures: false } },
};
