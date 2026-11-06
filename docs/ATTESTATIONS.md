# Client build provenance

The Pages workflow uses GitHub actions/attest@v4 with a checksum list of the published files. It attests only main builds; pull requests do not publish. The B7 follow-up also verifies Pay index provenance before deployment using the expected repository, workflow, main ref, exact source commit and hosted-runner policy. This is provenance, not an audit or proof that a maintainer is trustworthy. No browser automatically runs this check.

## Actual verification

On 6 Nov, the downloaded public pay/index.html matched SHA256SUMS from [main run 42196792847](https://github.com/Deven1305/hexfence/actions/runs/42196792847), source 59201da820548e20460801212a295df25b42aa18. gh 2.101.0 returned exit zero with this policy:

```sh
gh attestation verify pay-index.html --repo Deven1305/hexfence \
  --signer-workflow Deven1305/hexfence/.github/workflows/pages.yml \
  --source-ref refs/heads/main \
  --source-digest 59201da820548e20460801212a295df25b42aa18 \
  --deny-self-hosted-runners --format json
```

The unedited [actual verification JSON](research/pay-provenance-59201da.json) includes the signed subject digest, certificate and verified timestamps. The Pay index digest is `5c79f1bed34eda9d8e5ca48fc23a8e3e2ba8f2f94cda7e465542c7608773c24c`. This is a historical observation, not a claim that the current hosted page still has that digest. Pin the expected source commit for any new download. Verifying one HTML file does not check every chunk, the browser cache, extension, RPC, wallet, or what code a user actually executed.

The first local attempt failed because the default Sigstore cache under LOCALAPPDATA was outside the writable sandbox. Retrying with LOCALAPPDATA temporarily pointing at a writable task cache succeeded with normal trust roots. No custom trust root, skipped transparency check or relaxed signer policy was used. [Official GitHub CLI verification documentation](https://cli.github.com/manual/gh_attestation_verify).

## Arkiv release record

`hexfence.release.v1` stores the full checksum text as unindexed bytes, with indexed commit and SHA-256 digest, expiring after 90 days. The old str representation failed beyond 128 UTF-8 bytes. The fixed encoder uses a conservative 64 KiB manifest cap, verifies the supplied digest, rejects malformed/duplicate/traversing paths before network access, and refuses a different hash already registered for the same commit. Tests reproduce the old SDK rejection, exercise encoding without truncation, and cover idempotence/conflicts with stubbed network clients.

A checksum list is not itself a signature; an Arkiv publisher's wallet attribution is not GitHub provenance. Use the GitHub attestation independently. This schema has no user-facing reader. Old same-tag str rows, if any exist, are incompatible with the bytes schema; no migration or live record is claimed.

**Live publication remains a gap.** The inspected release job explicitly skipped because ARKIV_PRIVATE_KEY was missing. No tGLM write was authorized for this agent, and no secret was added. A human who elects to spend the existing publisher balance can configure the existing testnet key as the ARKIV_PRIVATE_KEY repository secret, optionally ARKIV_ACCESS_KEY, and dispatch the Pages workflow on main. Inspect the actual publish receipt and then rerun the same commit/manifest to confirm zero duplicate creates. Do not request a faucet, transfer funds, expose a key in a VITE variable or call a skipped CI job a publication.

For a human-run Node publication from apps/detector (existing ignored environment only):

```sh
corepack pnpm@10.34.9 exec tsx src/publishRelease.ts /absolute/path/SHA256SUMS.txt <full-source-commit>
```

The command spends testnet tGLM if it creates a record. It does not load or print credentials for you. Ensure the manifest is from the chosen successful main build and set the existing testnet environment personally before executing. The agent did not run this command.

Negative verification check: adding one space to the downloaded HTML changed its digest; the same strict gh policy exited 1 because no attestation existed for that digest. The original file exited 0. This tests changed bytes, not compromised-maintainer resistance.
