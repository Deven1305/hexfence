import { addr, dec, defineSchema, str } from "@arkiv-network/sdk/schema";
import { SCHEMA_NAME } from "@hexfence/shared";

export const POISONING_SCHEMA_NAME = SCHEMA_NAME; // "hexfence.poisoning.v1"

/**
 * `hexfence.poisoning.v1` on Arkiv: fields and the indexed/plain split as in spec §3.2
 * (documented in arkiv/schema.md). Only indexed columns can be filtered on: the explorer searches
 * by lookalike / impersonated / victim, and the writer looks a record up by evidenceId.
 * A named schema also tags every entity with an indexed `arkiv.schema` attribute.
 */
export const PoisoningSchema = defineSchema(POISONING_SCHEMA_NAME, {
  // indexed
  evidenceId: str().indexed(),
  chainId: dec().indexed(),
  lookalike: addr().indexed(),
  impersonated: addr().indexed(),
  victim: addr().indexed(),
  variant: str().indexed(),
  attackBlock: dec().indexed(),
  detectorVersion: str().indexed(),
  // stored, not indexed
  token: addr(),
  attackTx: str(),
  referenceTx: str(),
  referenceBlock: dec(),
  prefixLen: dec(),
  suffixLen: dec(),
  status: str(),
});
