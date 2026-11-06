# HexFence Pay as a Safe App

Pay can run inside Safe{Wallet} through the Safe Apps SDK (`@safe-global/safe-apps-sdk`). Standalone Pay is unchanged.

**Add it (human step):** in Safe{Wallet}, open a Sepolia Safe, go to Apps, choose "Add custom Safe App" and paste the Pay URL: `https://deven1305.github.io/hexfence/pay/`. Safe{Wallet} reads `manifest.json` from that folder (name, description, icon).

**What it does:** inside Safe{Wallet} Pay reads the open Safe from the SDK, loads its Guard status and payees, shows the verdict for a typed payment, and sends the payment to Safe{Wallet} as a proposal (`txs.send`). Signing, confirmation and execution happen in Safe{Wallet}.

**Limits:** Sepolia only. Guard setup (enable, approve, remove payees) is not in the Safe App; use standalone Pay. A payment the Guard refuses is rejected by Safe{Wallet}'s own simulation or on-chain; Pay's forced-send path that records a reverted hash is standalone only. Loading inside the real Safe{Wallet} has not been tested; the SDK protocol was tested against a local stand-in parent page.
