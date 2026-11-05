# Real-chain Pay browser test

From a worktree outside the Windows user home, install dependencies once:

```
corepack pnpm@10.34.9 install --frozen-lockfile
cd contracts
npm install --legacy-peer-deps
cd ..
corepack pnpm@10.34.9 --filter @hexfence/pay exec playwright install chromium
```

Run everything (local chain, deployments, production build, Chromium test, cleanup) with:

```
corepack pnpm@10.34.9 --filter @hexfence/pay test:e2e
```

Uses ports 18545 and 14173. No `.env` or public-chain funds required. The chain ID is
11155111. The harness deploys actual Safe 1.4.1 release artifacts and installs their
runtime at the addresses returned by safe-deployments; Safe proxies are created by
the real factory. HexFenceGuard is compiled unchanged. This is a **scripted wallet**:
a randomly generated, local-only owner signs typed data and real transactions in
the Node harness. Its key is never written or logged.

The browser clicks **Skip: read directly (not anonymous)**. Only the bootstrap HTTP
request is delayed until that click; RPC responses are not mocked. All subsequent
contract reads go to the local JSON-RPC endpoint. The audit counts one `payees(safe)`
call across P, B and L, and zero `isApprovedPayee`/`payeeByFingerprint` calls. A second
Safe load is checked afterward for the inactive-Guard state.

P and B have successful receipts and balance increases. L refuses `E74120`, accepts
`344120`, is sent with Pay's explicit 200000 gas limit and has a mined status-0
receipt. Its UI decodes `LookalikeOfApprovedPayee(L, P)`.

Pay has no arbitrary-calldata input. For the unsupported case only, the test build
adds an event ingress into the actual decoder/verdict/renderer in `main.ts`; it does
not replace their implementations. This hook is absent from ordinary builds.

Screenshot: `e2e/results/reverted-L.png` (generated, ignored). It shows the direct
read label, Safe 1.4.1 with an active Guard, the RED resemblance warning, `344120`,
the real reverted transaction hash and decoded Guard error. The explorer link is
the product's Sepolia link; this test hash exists on the local chain only.

Official API references consulted: [Safe deployment](https://docs.safe.global/sdk/protocol-kit/guides/safe-deployment),
[Safe execution](https://docs.safe.global/sdk/protocol-kit/guides/execute-transactions),
[safe-deployments](https://github.com/safe-global/safe-deployments),
[Playwright](https://playwright.dev/docs/test-webserver).
