# @hexfence/mcp

HexFence MCP (Model Context Protocol) stdio server providing the `hexfence_check` tool for AI agents.

AI agents cannot safely eyeball 40-character hex addresses. This server exposes `hexfence_check(recipient, approvedPayees[])` so autonomous agent wallets can verify recipients before initiating or signing Safe transactions.

## Tool: `hexfence_check`

- `recipient`: Candidate recipient address
- `approvedPayees`: Array of approved payee addresses

Returns the same verdict as `@hexfence/shared`:
- `GREEN` (approved): recipient is in approved payees.
- `RED` (resembles): recipient shares the 32-bit fingerprint (first 4 and last 4 hex chars) with an approved payee but is a different address (address poisoning lookalike).
- `AMBER` (new): recipient is new and does not resemble any approved payee.
- `GREY` (unsupported): cannot verify (invalid address or unsupported format).

The tool cannot say a recipient is cleared when it cannot verify.
