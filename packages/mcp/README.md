# @hexfence/mcp

HexFence MCP (Model Context Protocol) stdio server providing the `hexfence_check` tool for AI agents.

This server exposes `hexfence_check(recipient, approvedPayees[])` so an agent can compare a recipient with its approved payees before it signs. It is an offline comparison: it reads no chain data and does not check the evidence set.

## Tool: `hexfence_check`

- `recipient`: Candidate recipient address
- `approvedPayees`: Array of approved payee addresses

Returns the same verdict as `@hexfence/shared`:
- `GREEN` (approved): recipient is in approved payees.
- `RED` (resembles): recipient shares the 32-bit fingerprint (first 4 and last 4 hex chars) with an approved payee but is a different address (address poisoning lookalike).
- `AMBER` (new): recipient is not approved and does not resemble any approved payee. This does not clear it.
- `GREY` (unsupported): cannot verify (the recipient or an approved payee is malformed).

The tool cannot say a recipient is cleared when it cannot verify.

## Run it

From the repo root, after `corepack pnpm@10.34.9 install`:

```bash
corepack pnpm@10.34.9 --silent --filter @hexfence/mcp start
```

`--silent` matters: the server speaks JSON-RPC on stdout, so nothing else may print there.
