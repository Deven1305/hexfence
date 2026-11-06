# Demo video: 3:00 script

Checked against the live pages on 6 Nov 2026 (about 18:00 IST, main 8c3c175). Rules: **2:30–3:00**, at least 720p, normal-speed footage, **a person's own voice** (no text-to-speech or AI voiceover), at most 4 bullets on any slide. Show only real pages, terminals and receipts.

**Wallet legend:** 🟢 = no wallet needed, anyone can record it. 🔑 = needs a person with a wallet (Dhruv's wallet `0x0f7e…2803` owns the demo Safe). Every 🔑 step has a 🟢 fallback that uses the recorded receipts, so the video works without a new payment.

## Before recording (10 min)

1. Open these tabs and let each one finish loading. The public Arkiv endpoint is rate-limited: load the explorer once, then don't reload it.
   - Landing: https://deven1305.github.io/hexfence/
   - Guided demo (after PR #45 merges): https://deven1305.github.io/hexfence/demo.html. Every status on it is read live; a good backup if Pay or Arkiv is slow, and a good closing shot.
   - Explorer: https://deven1305.github.io/hexfence/explorer/ (wait for "Showing 1126 of 1126 publisher records. All records loaded."; it reads 12 pages, so open it before recording)
   - Pay preview: https://deven1305.github.io/hexfence/pay/?safe=0x3BCc3969713778F3Ed26AE1490529eeBAD43FbD5 (wait 25–40 s for "Nox reads active" and "Guard active")
   - L revert on Blockscout (decodes the reason): https://eth-sepolia.blockscout.com/tx/0xa43b0eeef7253281a741deca144e5ddf0c465da9cc6f48d54673a9aa9c0f6d8f
   - Direct-script L revert: https://sepolia.etherscan.io/tx/0xe77e6a7a8ba5b6f9742ec953826bc47c69ffffdced3a4d40b8fe3a220e1bb46f
   - B success: https://sepolia.etherscan.io/tx/0x2455ca8f1ce612149f15e80325f372202bffeb0258f808bd84acfb1f904de5ca and P success: https://sepolia.etherscan.io/tx/0xea209e9e3c5a9eed080e95dd0ca752b79686400da820ea67b87f98552d2992df
   - Guard source on Etherscan: https://sepolia.etherscan.io/address/0xA061fB511D69e5c92E50E3BE5c789472d6f19748#code
2. Copy these three addresses into a note:
   - P (approved) `0x4E185e251Ac7fB83E9DE10723EAda46cadE74120`
   - L (synthetic lookalike) `0x4E185a3FC4B530244aB9ed0dE38167b403344120`
   - B (new supplier) `0xcB0a33f755826307CcaC3f4b4833e7e19d38cEb6`
3. Optional terminal for 2:20: from the repo root, after `corepack pnpm@10.34.9 install`, have the MCP call ready (command at the end of this file).

## Script

| Time | Screen and action | Say (in your own words) |
|---|---|---|
| 0:00–0:15 🟢 | Landing hero and the X-Ray of P against L | "Address poisoning puts a lookalike in your history. These two addresses share the first 4 and last 4 characters. 31 of 40 differ. HexFence makes your Safe refuse the lookalike." |
| 0:15–0:40 🟢 | Explorer, Evidence tab: "Showing 1126 of 1126", the "suspected" badge. Open one row's **X-Ray**, then **Verify on Ethereum** | "This is real Ethereum mainnet data, read from Arkiv in my browser. Our detector found 58,739 suspected pairs in one day of USDT and USDC transfers; we published a sample of 1,126 across two scans. Each one is suspected, and anyone can re-check both transactions on Ethereum." |
| 0:40–0:55 🟢 | **Losses** tab: the one suspected follow-up payment, 303.635007 USDT. Then **Campaigns**: records grouped by attack transaction | "Losses shows a suspected payment that followed a planting, as a lead with a downloadable pack, not a confirmed loss. Campaigns groups records by attack transaction: one transaction here mentions dozens of victims." |
| 0:55–1:00 | Cut to Pay | (no narration) |
| 1:00–1:35 🟢 | Pay preview: point at "Nox reads active" and "v1.4.1 · 1/2 · Guard active". Paste **L**, amount 0.0001, **Check payment** → RED "Possible address poisoning". Then **B** → AMBER "New recipient". Then **P** → GREEN "Approved payee" | "Pay reads the Safe's approved payees once, through the Nox mixnet, and compares in the browser. L is a synthetic Sepolia address we made; it resembles our approved payee, so it's red. A new supplier is amber and still allowed. The approved payee is green." |
| 1:35–2:00 🔑 | Connect Dhruv's wallet. Pay L: typing `E74120` is refused, `344120` is accepted. Sign and send. Show the reverted transaction | "I can still force it by typing the last six characters. The Safe executes, and the Guard reverts it on-chain." |
| 1:35–2:00 🟢 fallback | Instead: the recorded L revert on Blockscout, showing `LookalikeOfApprovedPayee`, then the B and P success receipts | "This is the recorded payment to L: reverted by the Guard with LookalikeOfApprovedPayee. The new supplier and the approved payee went through. These were sent from a script wallet." |
| 2:00–2:20 🟢 | Direct-script L revert on Etherscan, then the Guard source on Etherscan | "Here Pay isn't involved at all: a script paid L straight from the Safe, and the Guard still refused. The rule lives in the account, with no owner and no upgrade path." |
| 2:20–2:40 🟢 | Terminal: the MCP call returns `"level":"RED","reason":"resembles"`. Then Pay's **Explain another call (ERC-7730)** panel, opened | "AI agents that pay can ask the same question through our MCP tool. And for calls HexFence can't check, Pay can explain an ERC-7730 descriptor without changing the verdict." |
| 2:40–3:00 🟢 | README CROPS section | "Security is our lead CROPS property. It's open source under MIT, comparisons stay in your browser, and reads go through Nox. Everything runs on testnet, and the limits are in the README." |

Total: 3:00. If you are over, cut 2:20–2:40 first.

### Only if real CRE output exists

Only replace 2:20–2:40 if a person has run `cre login` and `sentinel/SIMULATION.md` holds the real output of `cre workflow simulate`. Then show that terminal output, the consumer transaction, and Pay's Radar banner for the demo Safe. Say "CRE simulation", not "deployed". Until then, Pay shows "Sentinel simulation: no alerts returned for this Safe": don't present Sentinel as working.

### Things not to show as working

- Pay inside Safe{Wallet} (B8): not tested by a person.
- The Chrome extension on app.safe.global (T14): not tested.
- The V2 learning Guard: its only live payments are one scripted P-then-L run, not a wallet test.
- The module and governance guards: scripted Sepolia drills on new isolated Safes only (receipts in `contracts/README.md` and `contracts/README_GOVERNANCE.md`). No person has run them from a wallet.
- A second Arkiv publisher: none exists; the live explorer reads one.
- Hindi: you can show the हिन्दी button, but say it hasn't been checked by a native speaker yet.

## MCP command for 2:20

PowerShell, from the repo root:

```powershell
'{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"demo","version":"0"}}}',
'{"jsonrpc":"2.0","method":"notifications/initialized"}',
'{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"hexfence_check","arguments":{"recipient":"0x4E185a3FC4B530244aB9ed0dE38167b403344120","approvedPayees":["0x4E185e251Ac7fB83E9DE10723EAda46cadE74120"]}}}' |
  corepack pnpm@10.34.9 --silent --filter @hexfence/mcp start
```

Real output on 6 Nov: `{"level":"RED","reason":"resembles","recipient":"0x4E185a3FC4B530244aB9ed0dE38167b403344120","payee":"0x4E185e251Ac7fB83E9DE10723EAda46cadE74120"}`.

## If something fails while recording

| Problem | Do this |
|---|---|
| Explorer stuck at "reading Arkiv…" | The public endpoint is rate-limited. Wait a minute and reload once. |
| Pay stuck on "Nox connecting · choose read route" | Wait up to 40 s, or click **Skip: read directly (not anonymous)** and say so. |
| Pay stuck at "Checking…" | Reload the preview link; the evidence read goes to the same rate-limited Arkiv endpoint. |
| The live L send doesn't revert | Stop. Use the 🟢 fallback receipts. |

## Hard judge questions

| Question | Answer |
|---|---|
| Isn't this an allowlist? | No. A new address passes. Only a different address with an approved payee's fingerprint is refused. |
| What about 5+5 or 3+3 matches? | A 5+5 match also shares the 4+4 fingerprint, so it's refused. A 3+3-only match is outside the rule. |
| What if the first payment is wrong? | v1 trusts the payees the owners approve. V2 learns on first use, so a wrong first payment can be learned; owners can `forget` it. |
| Wallets already warn. What's new? | A warning can be clicked through; the Guard can't. We don't claim wallets lack warnings. |
| Why Arkiv, not Postgres? | Static pages share wallet-attributed records with built-in expiry and no API of our own. A database would make us the operator. |
| What if Arkiv or Chainlink goes down? | The Guard reads neither. Pay says when evidence is unavailable. |
| False positives? | Two random addresses share a 4+4 fingerprint with chance 1 in 2^32. A collision is resemblance, not intent; owners can approve the second address after removing the first. |
| Is your precision 100%? | No human-checked precision yet. The 30 sample labels were assigned by AI. |
| Gas? | Measured on a local Safe 1.4.1: 182,927 gas for a new V2 recipient, 72,839 for a repeat; whole Safe calls, not a universal quote. |
| Modules, MultiSend, governance? | Module transactions bypass transaction guards; our module guard for Safe 1.5.0 has one scripted Sepolia drill on an isolated Safe: a recorded-recipient payment succeeded and a lookalike payment reverted, both native ETH. MultiSend is a delegatecall and is refused. A separate governance guard checks new owner/module resemblance only for Safes that install it; a scripted drill on one isolated Safe refused a lookalike owner and added a non-lookalike one. No pre-existing Safe was switched. Pay still points to original V2. Owners can remove the Guard. |
| Who uses it? | DAO treasuries and payment teams are the intended users. No pilots or paying users yet. |
| Has a person checked it? | The Guard review in the repo is by AI. Human sign-off, a person-run wallet test and the Hindi check are still open, and we say so. |
| Does the Campaigns hourly chart show attack rate? | No. It shows published records, which we selected: 125 of the 1,126 come from one block, and the rest were picked by block slice and largest attack transaction. The chart title says published. |
