Tests the built Pay app against unchanged HexFenceGuard and real Safe 1.4.1 release artifacts on local chain 11155111. Canonical Safe addresses contain the deployed runtime. A scripted EIP-1193 wallet uses a random throwaway key in memory; no product mocks or keys are committed.

Run after the prerequisites in apps/pay/e2e/README.md:
`corepack pnpm@10.34.9 --filter @hexfence/pay test:e2e`

Passed: P/GREEN and B/AMBER have successful receipts and balance increases; L/RED refuses E74120, accepts 344120, sends with explicit gas 200000, has a real status-0 receipt, and displays LookalikeOfApprovedPayee(L,P). Inactive Guard and unsupported/cannot-verify are covered. Unsupported calldata uses a disclosed test-build-only ingress into the actual decoder and renderer because Pay has no arbitrary-call input. Ordinary builds have no ingress.

Reads: test clicks Skip: read directly (not anonymous), with the bootstrap request held until the click. Audit proves one payees(safe) read across P/B/L and zero per-recipient isApprovedPayee/payeeByFingerprint calls. No anonymous-route success is claimed.

Screenshot generated and visually inspected: apps/pay/e2e/results/reverted-L.png. Full-page image shows the direct-read label, active Guard, Safe VERSION 1.4.1, RED resemblance warning, typed 344120, real reverted hash, and decoded LookalikeOfApprovedPayee with both addresses. The screenshot is generated/ignored; rerun the command to reproduce. The product Etherscan link points to Sepolia, while this hash exists only locally.

Validation run: E2E 1 passed; contracts 14 passed; workspace 87 passed, 3 integration tests skipped; recursive build passed (existing browser externalization/chunk-size warnings). No product bugs found. Not tested: Sepolia wallet execution, anonymous routes, live Arkiv evidence (publisher deliberately unset).



Follow-up (item 2): E2E build and preview now use ignored apps/pay/e2e/.build/, never apps/pay/dist. Ran a normal Pay build, recorded all 9 dist files using SHA256 over sorted relative filenames and bytes, ran test:e2e (1 passed), then repeated the digest/string checks. Before and after SHA256: 7e731a74bac53fa58f32a023fd45d393e5d76185a64f921d23b0cdf027268bb6. Dist was unchanged and neither e2e:call nor 127.0.0.1:18545 appeared in any file. Sepolia wallet flow: not run (this test is local chain only).
