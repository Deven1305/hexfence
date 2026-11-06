import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { describe, expect, it } from "vitest";

const P = "0x4E185e251Ac7fB83E9DE10723EAda46cadE74120";
const L = "0x4E185a3FC4B530244aB9ed0dE38167b403344120";

describe("stdio server", () => {
  it("starts, lists hexfence_check and answers over stdio", async () => {
    const client = new Client({ name: "stdio-test", version: "0" });
    const cwd = fileURLToPath(new URL("..", import.meta.url));
    await client.connect(new StdioClientTransport({ command: process.execPath, args: ["--import", "tsx", "src/cli.ts"], cwd }));
    try {
      const { tools } = await client.listTools();
      expect(tools.map((t) => t.name)).toEqual(["hexfence_check"]);

      const red = await client.callTool({ name: "hexfence_check", arguments: { recipient: L, approvedPayees: [P] } });
      expect(JSON.parse((red.content as { text: string }[])[0]!.text)).toEqual({ level: "RED", reason: "resembles", recipient: L, payee: P });

      const grey = await client.callTool({ name: "hexfence_check", arguments: { recipient: L, approvedPayees: ["bad", P] } });
      expect(grey.isError).toBe(true);
    } finally {
      await client.close();
    }
  }, 30_000);
});
