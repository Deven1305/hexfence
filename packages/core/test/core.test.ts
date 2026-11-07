import { describe, expect, it } from "vitest";
import { actionRow, combine, recipientRow, type CheckRow } from "../src/index.js";

const row = (level: CheckRow["level"]): CheckRow => ({ kind: "app", level, code: "X", params: {} });

describe("combine", () => {
  it("worst row wins", () => {
    expect(combine([row("green"), row("amber"), row("red")]).overall).toBe("red");
  });
  it("grey is never green", () => {
    expect(combine([row("green"), row("grey")]).overall).toBe("grey");
    expect(combine([]).overall).toBe("grey");
  });
  it("holds per policy", () => {
    expect(combine([row("green")]).hold).toBe("pass");
    expect(combine([row("amber")]).hold).toBe("confirm");
    expect(combine([row("red")], { onRed: "block", onAmber: "confirm", onGrey: "confirm" }).hold).toBe("block");
    expect(combine([row("red")]).hold).toBe("confirm");
  });
});

describe("adapters", () => {
  it("maps HexFence verdicts", () => {
    expect(recipientRow("RED", "RESEMBLES_APPROVED_PAYEE").level).toBe("red");
    expect(recipientRow("GREY", "CANNOT_VERIFY_DELEGATECALL").kind).toBe("action");
  });
  it("maps Pramaan severities", () => {
    expect(actionRow("low", "A").level).toBe("green");
    expect(actionRow("medium", "A").level).toBe("amber");
    expect(actionRow("critical", "A").level).toBe("red");
  });
  it("a tampered app plus a lookalike recipient is red", () => {
    const r = combine([{ kind: "app", level: "red", code: "SITE_FILE_MISMATCH", params: {} }, recipientRow("RED", "RESEMBLES_APPROVED_PAYEE")]);
    expect(r.overall).toBe("red");
    expect(r.rows).toHaveLength(2);
  });
});

import { contractsRow, releaseRow, siteFilesRow } from "../src/index.js";

describe("Pramaan row adapters", () => {
  it("maps release statuses and never turns an unknown status green", () => {
    expect(releaseRow("verified", "https://a.xyz", "a.eth").level).toBe("green");
    for (const s of ["mismatch", "invalid-signature", "revoked"]) expect(releaseRow(s, "o").level).toBe("red");
    for (const s of ["missing", "unverifiable", "something-new"]) expect(releaseRow(s, "o").level).toBe("grey");
    expect(releaseRow("invalid-signature", "o").code).toBe("RELEASE_INVALID_SIGNATURE");
  });
  it("keeps the site severity and builds the code from the status", () => {
    const r = siteFilesRow("file-mismatch", "red", "x");
    expect(r).toMatchObject({ kind: "app", level: "red", code: "SITE_FILES_FILE_MISMATCH" });
  });
  it("contract row: nothing checked is grey, mismatch is red, match is green", () => {
    expect(contractsRow(0, "green", []).level).toBe("grey");
    expect(contractsRow(2, "green", []).code).toBe("CONTRACTS_MATCH_RELEASE");
    expect(contractsRow(2, "red", ["a: bad"])).toMatchObject({ level: "red", code: "CONTRACT_NOT_AS_RELEASED" });
  });
});
