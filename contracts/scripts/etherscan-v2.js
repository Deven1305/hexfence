// Pinned hardhat-verify 2.0.13 replaces the URL query on GET requests, losing
// customChains' V2 chainid. Its POST already preserves that query. Limit this
// compatibility bridge to Sepolia's configured official V2 endpoint.
const transport = require('@nomicfoundation/hardhat-verify/internal/undici');
const sendGetRequest = transport.sendGetRequest;
transport.sendGetRequest = (url, ...args) => {
  const target = new URL(url);
  if (target.origin === 'https://api.etherscan.io' && target.pathname === '/v2/api') {
    target.searchParams.set('chainid', '11155111');
  }
  return sendGetRequest(target, ...args);
};
