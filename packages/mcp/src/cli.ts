#!/usr/bin/env node
import { runStdioServer } from "./server.js";

runStdioServer().catch((err) => {
  process.stderr.write(`HexFence MCP server fatal error: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
