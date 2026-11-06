# Guard review (AI review, 06 Nov 2026)

**Who:** Claude (Opus, Deven's Claude account). This is an **AI review**, not a human review. No team member has signed it off yet.
**What:** `contracts/contracts/HexFenceGuard.sol` as deployed at `0xA061fB511D69e5c92E50E3BE5c789472d6f19748` (Sepolia), and the 14 tests in `contracts/test/guard.test.js`.
**Against:** spec §3.1 (deny by resemblance, not an allowlist; fail closed on delegatecall; admin and recovery path first).

## Checked and correct
| Item | Line | Result |
|---|---|---|
| Fingerprint = first 4 hex ‖ last 4 hex | 33–36 | `x >> 144` keeps the top 16 bits (first 4 hex), `x & 0xFFFF` the last 4 hex. Correct, and matches the shared client test vectors. |
| One payee per fingerprint | 51–53 | A second payee with the same fingerprint is rejected, so `payeeByFingerprint` can never point at the wrong payee. |
| Remove keeps the invariant | 61–75 | Swap-and-pop is correct when the payee is the last entry. It deletes only the removed payee's fingerprint slot (safe, because duplicates are impossible). |
| Per-Safe namespace | 49, 62, 90 | Every write and read is keyed by `msg.sender`. One Safe cannot change another's list. No owner, no upgrade path. |
| Admin and recovery first | 93 | Call to the Safe itself or to the guard returns before decoding, so `setGuard(0)`, owner and threshold changes always work (tested: removal drill). |
| Delegatecall fails closed | 95 | Any delegatecall reverts. |
| Never reverts on malformed calldata | 98–106 | Length checks happen before the selector match. Short or unknown data returns. `_addressAt` masks to 20 bytes, the same truncation old tokens such as USDT apply. |
| No unbounded loop in `checkTransaction` | 108–110 | Two mapping reads. Gas does not grow with the payee list. |
| `view` override of the Safe 1.4.1 `Guard` | 89, 114 | Stricter mutability than the interface, which Solidity allows. `supportsInterface(0xe6d7a83a)` comes from `BaseGuard`. |

## Findings (none change the demo; all are design limits)
1. **ETH sent with non-empty calldata is not inspected (medium).** If `value > 0` and `data` is anything other than empty, `transfer` or `transferFrom` (for example `0x00`), line 105 returns, so ETH can go to a lookalike EOA. The same happens if `to` is a lookalike and `data` is a `transfer` naming an approved payee: the guard checks the payee from the calldata, but the ETH `value` goes to `to`. Wallet UIs send plain ETH with empty data, so the normal copy-paste attack is still stopped, but a crafted transaction is not. **Suggested fix for a v2:** also check `to` whenever `value > 0`, using the same resemblance rule. This needs a new deploy, new tests and new addresses everywhere, so it is not done for the hackathon build.
2. **Only three payment shapes are inspected (known, in README).** `approve`, `permit`, DEX swaps with a recipient field, ERC-721 and ERC-1155 transfers are allowed without a check. The client shows "cannot verify". Matches the README.
3. **Delegatecall ban blocks MultiSend batches.** Safe{Wallet} batches use delegatecall to MultiSend, so they revert while the guard is on. This is intended fail-closed behaviour, but it should be said in the demo.
4. **Recovery means removing the guard.** Owners at threshold can `setGuard(0)` and then pay anyone. The guard protects against a mistaken payment, not against the owners themselves. This is the intended design.
5. **Two real payees can share a fingerprint.** The second one cannot be approved (1 in 2^32 per pair). The error says which payee already holds it.

## Tests
The 14 tests cover the payee, lookalike, new-recipient, ERC-20, delegatecall, duplicate-fingerprint, removal, namespace, malformed-calldata, setGuard(0) and demo-pair cases. **Missing:** a test for finding 1 (ETH with calldata to a lookalike). If a v2 is built, add it first.

## Human sign-off
ETHGlobal's rules require "meaningful contributions" from team members and do not let AI create the entire project. A team member should still read this file and the contract (about 20 minutes) and add a line here:
`Reviewed by <name>, <date>: agree / disagree with findings <n>`.
