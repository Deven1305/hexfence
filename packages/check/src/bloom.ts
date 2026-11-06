import { keccak256, stringToBytes } from "viem";

export interface BloomFilterJSON {
  m: number;
  k: number;
  bits: string; // base64 encoded
}

/**
 * Offline, zero-network Bloom filter for address-poisoning evidence addresses.
 * Uses keccak256 with Kirsch-Mitzenmacher double hashing to compute k independent probe indices.
 */
export class EvidenceBloomFilter {
  readonly m: number; // Number of bits in the filter
  readonly k: number; // Number of hash functions
  readonly bits: Uint8Array;

  constructor(bits: Uint8Array, m: number, k: number) {
    if (m <= 0) throw new Error("Filter size m must be positive");
    if (k <= 0) throw new Error("Hash count k must be positive");
    const requiredBytes = Math.ceil(m / 8);
    if (bits.length < requiredBytes) {
      throw new Error(`Bits buffer too small: expected at least ${requiredBytes} bytes, got ${bits.length}`);
    }
    this.bits = bits;
    this.m = m;
    this.k = k;
  }

  /**
   * Build an offline Bloom filter from an iterable of addresses.
   *
   * @param addresses Iterable of Ethereum addresses (case-insensitive)
   * @param falsePositiveRate Target false positive rate (default: 0.01 = 1%)
   */
  static fromAddresses(
    addresses: Iterable<string>,
    falsePositiveRate: number = 0.01,
  ): EvidenceBloomFilter {
    const list = Array.isArray(addresses) ? addresses : Array.from(addresses);
    const n = Math.max(1, list.length);
    const p = Math.max(0.000001, Math.min(0.5, falsePositiveRate));

    // Optimal k depends on false positive rate: k = ceil(-log2(p))
    const k = Math.max(1, Math.min(30, Math.round(-Math.log(p) / Math.LN2)));

    // m = ceil(- (n * ln(p)) / (ln(2)^2)), with minimum 256 bits (32 bytes) to avoid saturation for small n
    const theoreticalM = Math.ceil((-n * Math.log(p)) / (Math.LN2 * Math.LN2));
    const m = Math.max(256, theoreticalM);

    const byteLen = Math.ceil(m / 8);
    const bits = new Uint8Array(byteLen);
    const filter = new EvidenceBloomFilter(bits, m, k);

    for (const addr of list) {
      filter.add(addr);
    }

    return filter;
  }

  /**
   * Add an address to the Bloom filter.
   */
  add(address: string): void {
    const indices = this.getHashIndices(address);
    for (const idx of indices) {
      const byteIdx = Math.floor(idx / 8);
      const bitIdx = idx % 8;
      this.bits[byteIdx]! |= 1 << bitIdx;
    }
  }

  /**
   * Check if an address may be in the set. True can be a false positive.
   * Runs completely offline with no network calls.
   * Zero false negatives: if address was added, always returns true.
   */
  has(address: string): boolean {
    const indices = this.getHashIndices(address);
    for (const idx of indices) {
      const byteIdx = Math.floor(idx / 8);
      const bitIdx = idx % 8;
      if ((this.bits[byteIdx]! & (1 << bitIdx)) === 0) {
        return false;
      }
    }
    return true;
  }

  /** Alias for has() */
  check(address: string): boolean {
    return this.has(address);
  }

  /**
   * Compute k bit positions using double hashing:
   * g_i(x) = (h1 + i * h2) mod m
   */
  private getHashIndices(address: string): number[] {
    const normalized = address.trim().toLowerCase();
    const hashHex = keccak256(stringToBytes(normalized)); // 32 bytes hex: "0x..."

    // First 8 bytes as h1, next 8 bytes as h2
    const h1 = BigInt(`0x${hashHex.slice(2, 18)}`);
    let h2 = BigInt(`0x${hashHex.slice(18, 34)}`);
    if (h2 === 0n) h2 = 1n;

    const mBig = BigInt(this.m);
    const indices: number[] = new Array(this.k);

    for (let i = 0; i < this.k; i++) {
      const combined = (h1 + BigInt(i) * h2) % mBig;
      indices[i] = Number(combined);
    }

    return indices;
  }

  /**
   * Serialize filter to JSON.
   */
  toJSON(): BloomFilterJSON {
    const base64 = Buffer.from(this.bits).toString("base64");
    return {
      m: this.m,
      k: this.k,
      bits: base64,
    };
  }

  /**
   * Deserialize filter from JSON.
   */
  static fromJSON(json: BloomFilterJSON): EvidenceBloomFilter {
    const buf = Buffer.from(json.bits, "base64");
    const bits = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
    return new EvidenceBloomFilter(bits, json.m, json.k);
  }

  /**
   * Serialize to a single compact base64 string.
   */
  toBase64(): string {
    return Buffer.from(JSON.stringify(this.toJSON())).toString("base64");
  }

  /**
   * Deserialize from base64 string.
   */
  static fromBase64(base64: string): EvidenceBloomFilter {
    const raw = Buffer.from(base64, "base64").toString("utf-8");
    const json = JSON.parse(raw) as BloomFilterJSON;
    return EvidenceBloomFilter.fromJSON(json);
  }
}

/**
 * Functional constructor for EvidenceBloomFilter.
 */
export function createEvidenceBloomFilter(
  addresses: Iterable<string>,
  falsePositiveRate?: number,
): EvidenceBloomFilter {
  return EvidenceBloomFilter.fromAddresses(addresses, falsePositiveRate);
}
