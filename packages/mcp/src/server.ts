import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { isAddress, type Address } from "viem";
import { verdictFor, checksum, type Verdict, type DecodedPayment } from "@hexfence/shared";

export interface HexfenceCheckInput {
  recipient: string;
  approvedPayees: string[];
}

export interface HexfenceCheckResult {
  verdict: Verdict;
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}

/**
 * Check a recipient against approved payees using @hexfence/shared verdictFor.
 * Returns exact Verdict object.
 * When recipient is invalid or cannot be verified, returns GREY unsupported.
 * It will NEVER say a recipient is cleared when it cannot verify.
 */
export function checkRecipient(recipient: string, approvedPayees: string[]): Verdict {
  if (!recipient || typeof recipient !== "string" || !isAddress(recipient, { strict: false })) {
    return { level: "GREY", reason: "unsupported" };
  }

  const cleanRecipient = checksum(recipient);
  const validPayees: Address[] = [];
  if (Array.isArray(approvedPayees)) {
    for (const p of approvedPayees) {
      if (p && typeof p === "string" && isAddress(p, { strict: false })) {
        validPayees.push(checksum(p));
      }
    }
  }

  const payment: DecodedPayment = {
    kind: "eth",
    recipient: cleanRecipient,
    amount: 0n,
  };

  return verdictFor(payment, validPayees);
}

/**
 * Handler for the hexfence_check MCP tool.
 * Tests call this handler directly.
 */
export async function hexfenceCheckHandler(input: HexfenceCheckInput): Promise<HexfenceCheckResult> {
  const verdict = checkRecipient(input.recipient, input.approvedPayees);
  const isCannotVerify = verdict.level === "GREY";

  return {
    verdict,
    content: [
      {
        type: "text",
        text: JSON.stringify(verdict),
      },
    ],
    isError: isCannotVerify,
  };
}

/**
 * Creates and configures the MCP server exposing `hexfence_check`.
 */
export function createHexfenceMcpServer(): McpServer {
  const server = new McpServer({
    name: "hexfence",
    version: "0.1.0",
  });

  server.tool(
    "hexfence_check",
    "Check a recipient address against approved payees to detect address-poisoning lookalikes. Reverts on-chain if a lookalike shares the first 4 and last 4 hex characters.",
    {
      recipient: z.string().describe("Candidate recipient Ethereum address"),
      approvedPayees: z.array(z.string()).describe("List of approved payee Ethereum addresses"),
    },
    async ({ recipient, approvedPayees }) => {
      const res = await hexfenceCheckHandler({ recipient, approvedPayees });
      return {
        content: res.content,
        isError: res.isError,
      };
    },
  );

  return server;
}

/**
 * Start the MCP server over stdio transport.
 */
export async function runStdioServer(): Promise<void> {
  const server = createHexfenceMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
