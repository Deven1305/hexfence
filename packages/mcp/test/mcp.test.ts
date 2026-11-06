import { describe, expect, it } from "vitest";
import {
  hexfenceCheckHandler,
  checkRecipient,
  createHexfenceMcpServer,
} from "../src/index.js";

const P_DEMO = "0x4E185e251Ac7fB83E9DE10723EAda46cadE74120";
const L_DEMO = "0x4E185a3FC4B530244aB9ed0dE38167b403344120";
const NEW_RECIPIENT = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"; // USDC on mainnet

describe("hexfenceCheckHandler", () => {
  it("returns GREEN approved when recipient is in approved payees", async () => {
    const result = await hexfenceCheckHandler({
      recipient: P_DEMO,
      approvedPayees: [P_DEMO],
    });

    expect(result.verdict).toEqual({
      level: "GREEN",
      reason: "approved",
      recipient: P_DEMO,
    });
    expect(result.isError).toBe(false);

    const parsed = JSON.parse(result.content[0]!.text);
    expect(parsed.level).toBe("GREEN");
  });

  it("returns RED resembles when recipient is a lookalike of an approved payee", async () => {
    const result = await hexfenceCheckHandler({
      recipient: L_DEMO,
      approvedPayees: [P_DEMO],
    });

    expect(result.verdict.level).toBe("RED");
    if (result.verdict.level === "RED" && result.verdict.reason === "resembles") {
      expect(result.verdict.recipient).toBe(L_DEMO);
      expect(result.verdict.payee).toBe(P_DEMO);
    }
    expect(result.isError).toBe(false);

    const parsed = JSON.parse(result.content[0]!.text);
    expect(parsed.level).toBe("RED");
    expect(parsed.reason).toBe("resembles");
  });

  it("returns AMBER new when recipient is a new unapproved address with no lookalike", async () => {
    const result = await hexfenceCheckHandler({
      recipient: NEW_RECIPIENT,
      approvedPayees: [P_DEMO],
    });

    expect(result.verdict).toEqual({
      level: "AMBER",
      reason: "new",
      recipient: NEW_RECIPIENT,
    });
    expect(result.isError).toBe(false);
  });

  describe("cannot say a recipient is cleared when it cannot verify", () => {
    it("returns GREY unsupported and isError: true for malformed addresses", async () => {
      const invalidInputs = [
        "not-an-address",
        "0x1234",
        "0xZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ",
        "",
        "0x4E185e251Ac7fB83E9DE10723EAda46cadE7412", // too short (39 chars)
      ];

      for (const invalid of invalidInputs) {
        const result = await hexfenceCheckHandler({
          recipient: invalid,
          approvedPayees: [P_DEMO],
        });

        expect(result.verdict).toEqual({
          level: "GREY",
          reason: "unsupported",
        });
        expect(result.isError).toBe(true);

        const parsed = JSON.parse(result.content[0]!.text);
        expect(parsed.level).toBe("GREY");
        expect(parsed.reason).toBe("unsupported");
        // Must never say cleared / approved / green
        expect(parsed.level).not.toBe("GREEN");
        expect(parsed.level).not.toBe("AMBER");
      }
    });

    it("handles non-string / empty arguments safely without claiming cleared", async () => {
      const result = await hexfenceCheckHandler({
        recipient: null as unknown as string,
        approvedPayees: [],
      });

      expect(result.verdict).toEqual({
        level: "GREY",
        reason: "unsupported",
      });
      expect(result.isError).toBe(true);
    });
  });

  it("filters out invalid addresses in approvedPayees and checks remaining valid ones", async () => {
    const result = await hexfenceCheckHandler({
      recipient: L_DEMO,
      approvedPayees: ["invalid-payee", P_DEMO],
    });

    expect(result.verdict.level).toBe("RED");
    if (result.verdict.level === "RED" && result.verdict.reason === "resembles") {
      expect(result.verdict.payee).toBe(P_DEMO);
    }
  });
});

describe("checkRecipient direct function", () => {
  it("matches @hexfence/shared verdict behaviour", () => {
    expect(checkRecipient(P_DEMO, [P_DEMO]).level).toBe("GREEN");
    expect(checkRecipient(L_DEMO, [P_DEMO]).level).toBe("RED");
    expect(checkRecipient(NEW_RECIPIENT, [P_DEMO]).level).toBe("AMBER");
    expect(checkRecipient("bad-address", [P_DEMO])).toEqual({
      level: "GREY",
      reason: "unsupported",
    });
  });
});

describe("createHexfenceMcpServer", () => {
  it("initializes an MCP server instance without error", () => {
    const server = createHexfenceMcpServer();
    expect(server).toBeDefined();
  });
});
