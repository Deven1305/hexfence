// Publishes a Pages build's hashes as a `hexfence.release.v1` Arkiv record.
// Usage: tsx src/publishRelease.ts <SHA256SUMS path> <commit sha>
import { readFileSync } from "node:fs";
import { writeRelease } from "@hexfence/arkiv";
import type { Hex } from "viem";

const [sumsPath, commit] = process.argv.slice(2);
const privateKey = process.env.ARKIV_PRIVATE_KEY as Hex | undefined;
if (!sumsPath || !commit) throw new Error("usage: publishRelease <SHA256SUMS path> <commit sha>");
if (!privateKey) throw new Error("set ARKIV_PRIVATE_KEY (a testnet-only key)");
const accessKey = process.env.ARKIV_ACCESS_KEY;

const { entityKey, created } = await writeRelease(accessKey ? { privateKey, accessKey } : { privateKey }, commit, readFileSync(sumsPath, "utf8"));
console.log(`release ${commit} ${created ? "published" : "already on Arkiv"}: ${entityKey}`);
