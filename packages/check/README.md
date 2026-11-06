# @hexfence/check

Offline SDK for HexFence resemblance checks and address-poisoning evidence bloom filter. Runs locally with zero network calls.

## Usage

```ts
import { isLookalike, EvidenceBloomFilter } from "@hexfence/check";
const filter = EvidenceBloomFilter.fromAddresses(["0x000000000000000000000000000000000000dEaD"]);
const isSuspected = filter.has("0x000000000000000000000000000000000000dead"); // true
```
