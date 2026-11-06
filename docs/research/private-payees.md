# Research: salted commitments for private payee lists

Design note only. Nothing here is built or deployed.

## Problem & Motivation
`HexFenceGuard` stores approved payees, and `HexFenceGuardV2` stores approved or learned recipients, as plaintext addresses on-chain. Anyone can read them, so an observer can list a Safe's approved counterparties before it has paid them.

## Salted-Commitment Design
Instead of mapping `safe => fingerprint => address`, store a cryptographic commitment:

1. **Commitment Construction:**
   - Client generates a 256-bit random secret `salt`.
   - `commitment = keccak256(abi.encodePacked(safe, payee, salt))`.
   - On-chain storage: `mapping(address => mapping(bytes4 => bytes32)) public commitmentOf;`

2. **Approval Path:**
   - Safe calls `commitPayee(bytes4 fp, bytes32 commitment)`.
   - The plaintext payee address never touches public contract state during approval.

3. **Execution & Opening:**
   - At payment time, the Guard needs `(payee, salt)`. Its `checkTransaction` receives only the Safe transaction's fields, so the opening has to travel in one of them (for example appended to `signatures`) or in a separate earlier call. That channel is untested and would need its own test against a real Safe.
   - The Guard verifies:
     `keccak256(abi.encodePacked(safe, payee, salt)) == commitmentOf[safe][fingerprint(payee)]`.
   - If candidate recipient `r != payee` but shares `fingerprint(payee)`, payment reverts with `LookalikeOfKnownRecipient`.

## Honest Limitations & Privacy Leaks

While commitments hide the raw payee string prior to first payment, the design has fundamental leakage inherent to on-chain accounts:

1. **The 32-bit Fingerprint Leak:**
   - The index key `bytes4 fp` (first 4 and last 4 hex characters) remains public on-chain so the Guard can find the commitment without scanning.
   - 32 bits provides only 2^32 (about 4.3 billion) values. Anyone holding a list of known addresses can filter it down to those matching `fp`. That narrows the candidates; it does not name the payee.

2. **Past Payments Permanently Leak Identity:**
   - When a payment executes, the chain reveals the destination:
     - ETH `to` target is visible in the transaction envelope.
     - ERC-20 payments emit `Transfer(from, to, amount)`.
   - The moment any counterparty is paid once, their address is public. Anyone reading the Safe's history learns it, whatever the contract stores. The opening above would also reveal it at payment time.

3. **Attacker Asymmetry:**
   - Address poisoners generate lookalikes from transactions they observe. Hiding payees not yet paid removes that source for those payees, but does nothing once a payee has been paid, and poisoning usually follows a real payment.

4. **Client Secret Management Risk:**
   - A Safe can have several independent signers. Sharing and backing up off-chain salts across signers adds significant synchronization friction; losing a salt prevents verification unless an owner-level `removeCommitment` recovery path exists.

## Conclusion
Salted commitments hide a payee only until its first payment, at the cost of salt coordination, extra gas and a new way to pass the opening to the Guard. Hiding payees after that would need something other than hash commitments, such as stealth addresses (ERC-5564). That is an untested pointer, not a design.
