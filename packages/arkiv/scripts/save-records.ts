import { writeFile } from "node:fs/promises";
import { isAddress, type Address } from "viem";
import { arkivReadClient, fetchPublishedRecords, parseSavedRecords } from "../src/index.js";

// No signer or private key. Never print SDK errors: their RPC URL can contain the access key.
const [publisher, output] = process.argv.slice(2);
const accessKey = process.env.ARKIV_ACCESS_KEY?.trim() || undefined;
try {
  if (!publisher || !isAddress(publisher, { strict: false }) || !output) throw new Error("Invalid arguments");
  const read = await fetchPublishedRecords(arkivReadClient({ accessKey }), publisher as Address);
  // Schema outputs contain JSON numbers/strings, including decimal strings for uint256 amounts.
  // Validate after serialization too, so a future non-JSON schema change cannot publish a broken copy.
  const json = JSON.stringify({ publisher, ...read }, (_, value: unknown) => typeof value === "bigint" ? value.toString() : value);
  if (!parseSavedRecords(JSON.parse(json), publisher as Address)) throw new Error("Invalid saved records");
  await writeFile(output, json + "\n", "utf8");
  console.log(`Saved ${read.evidence.length} suspected evidence records and ${read.losses.length} suspected loss records.`);
} catch (error) {
  // Classify without logging request URLs, credentials, or arbitrary RPC error bodies.
  const message = error instanceof Error ? error.message : "";
  const reason = /429|ANON_COST_LIMITED|budget|rate.limit/i.test(message) ? "public read limit reached" :
    /timeout|timed out/i.test(message) ? "read timed out" :
    /Invalid arguments/.test(message) ? "expected publisher address and output path" :
    /Invalid saved records/.test(message) ? "records failed saved-copy validation" : "read or file write failed";
  console.log(`No saved copy written: ${reason}.`);
  process.exitCode = 0;
}
