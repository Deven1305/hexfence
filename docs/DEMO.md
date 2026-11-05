# HexFence demo script

**Video: 2:30–3:00, at least 720p** (ETHGlobal allows 2–4 minutes, EF CROPS at most 3). The spec's rough part lengths add up to 4 minutes, so the video needs the shorter timings below. In person, you can use the longer versions.

## Before recording
- [ ] Run `node contracts/scripts/check-t8.js` with every address/hash argument in [RUNBOOK_T8.md](RUNBOOK_T8.md), require exit 0, and keep its public rows. Also check the second Safe{Wallet} L hash. Explorer evidence and the H6 wallet flow still need their separate checks.
- [ ] Explorer open on the real publisher, with counts showing (needs `VITE_ARKIV_PUBLISHER`, `VITE_MAINNET_RPC_URL`)
- [ ] One record chosen and already verified once: ✓ appears, and both Etherscan links open
- [ ] HexFence Pay open, wallet on Sepolia, demo Safe loaded, status shows the Guard is active
- [ ] Demo Safe holds test ETH, has the Guard set, and P approved (`payees(safe)` shows P)
- [ ] Guard verified on Sepolia Etherscan, otherwise Etherscan may not name the revert reason (not tested yet; check it)
- [ ] Safe{Wallet} open in a second tab for step 5
- [ ] Addresses ready to paste, with B a fresh test address:
  - P `0x4E185e251Ac7fB83E9DE10723EAda46cadE74120`
  - L `0x4E185a3FC4B530244aB9ed0dE38167b403344120`
- [ ] Removal drill hashes open (`setGuard(0)`, then re-enable)
- [ ] Do one full rehearsal. Each L payment costs Sepolia gas, even when it reverts

## Part 1: real evidence (about 35 seconds)
Label on screen: **Ethereum mainnet evidence · status: suspected**

1. Open the explorer. *"This page has no backend. It reads Arkiv directly."*
2. Point at the counts. *"Our detector found these suspected poisonings in Ethereum mainnet USDT and USDC transfers."*
   - **Say only what is true of the number on screen.** One real run found 43,227 pairs in about 24 hours, but the count on screen is what was published to Arkiv. If only part was published, say: *"One 24-hour run found 43,227; here is the part we published."*
3. Open a record: victim, impersonated address, lookalike. *"Same start, same end, different address."* Open a transaction on Etherscan.
4. Click **Verify on Ethereum** → ✓. *"You don't have to trust us. This re-checks the receipts on Ethereum, from your browser."*

## Part 2: synthetic re-enactment on Sepolia (about 1 minute 45)
Say: ***"This is a synthetic test pair, not a real attack."***

1. *"This demo Safe has the HexFence Guard, and P is its approved payee."*
2. **Pay L** in HexFence Pay → RED: resembles P → type the last 6 characters (`344120`) to continue → sign and execute → **reverts with `LookalikeOfApprovedPayee(L, P)`** on Sepolia Etherscan. *"The warning can be overridden. The Safe's refusal can't."*
3. **Pay B**, a new supplier → AMBER → **succeeds**. *"Not an allowlist: new suppliers still work."*
4. **Pay P** → GREEN → **succeeds**.
5. **Client off:** close HexFence Pay and pay L again **from Safe{Wallet}, not from Pay** → **still reverts**. *"Enforcement doesn't need our software."*
   - Safe{Wallet} warns that the transaction will fail. **Choose to execute anyway and set a manual gas limit in the wallet** (200,000 is well above the measured cost of about 68,000), so the revert is actually mined and you get a hash.
6. Show the removal drill hashes: `setGuard(0)`, then re-enabled. *"Removal is tested through real Safe transactions."*

## Part 3: why it's new (about 30 seconds)
*"Wallets warn, but a warning is UI you can click through. Allowlists block new suppliers. Blocklists need someone to have reported the attacker first. HexFence denies by resemblance, at the account level: it stops a lookalike nobody has ever reported, and new suppliers still work."*

Then state the limits: *"Modules bypass guards, MultiSend is refused, and a 4+4 fingerprint doesn't catch weaker lookalikes."*

**Never say:** "the first recipient guard for Safe", "verified" or "evidence" about the synthetic L, or "scammer" or "malicious" about any address.

## If something fails during the live demo
| Failure | What to do |
|---|---|
| Wallet refuses to send the L payment | Show the decoded refusal in Pay, then the L reverted hash already recorded in the README |
| Arkiv is slow or rate limited | Set `VITE_ARKIV_ACCESS_KEY`. Failing that, use the recorded video |
| Verify shows "could not verify" because of the RPC | Use another `VITE_MAINNET_RPC_URL` and try again. Don't describe it as a failed record |
| Etherscan doesn't name the error | Show the revert in Pay's decoded result and say the Guard isn't verified on Etherscan yet |

## Recording checklist
- [ ] 2:30–3:00, at least 720p, audio clear
- [ ] Part 2 opens with the "synthetic test pair" sentence
- [ ] Label "status: suspected" visible in Part 1
- [ ] All four non-negotiables shown: lookalike rejected, legitimate recipients allowed (P and B), removal tested, real evidence from Arkiv
- [ ] No keys, seed phrases or `.env` on screen
