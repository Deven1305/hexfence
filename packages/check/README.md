# @hexfence/check

Offline SDK for HexFence resemblance checks and address-poisoning evidence bloom filter. Runs locally with zero network calls.

A filter hit means "possibly listed": Bloom filters can return false positives (about 1% at the default size), so confirm a hit against the full evidence set. A miss means the address is not in the set the filter was built from.

## Usage

```ts
import { checkRecipientOffline, EvidenceBloomFilter } from "@hexfence/check";
const filter = EvidenceBloomFilter.fromAddresses(evidenceAddresses);
const { verdict, possiblyListed } = checkRecipientOffline(recipient, approvedPayees, filter);
```
