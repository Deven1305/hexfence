import { encodeFunctionData, parseAbi, type Address } from "viem";
import { describe, expect, it } from "vitest";
import { decodeSafeCall, explainCall, resemblingPayees, verdictFor, type SafeCall } from "../src/index.js";

// A descriptor written the way ERC-7730 section "Minimal contract examples" does (https://eips.ethereum.org/EIPS/eip-7730),
// bound to a test contract. The contract and addresses are fixtures; the synthetic lookalike is the repo's usual P / L pair.
const CONTRACT: Address = "0x1111111111111111111111111111111111111111";
const SAFE: Address = "0x3BCc3969713778F3Ed26AE1490529eeBAD43FbD5";
const GUARD: Address = "0xA061fB511D69e5c92E50E3BE5c789472d6f19748";
const P: Address = "0x4E185e251Ac7fB83E9DE10723EAda46cadE74120";
const L: Address = "0x4E185a3FC4B530244aB9ed0dE38167b403344120";
const OTHER: Address = "0x2222222222222222222222222222222222222222";

const descriptor = {
  context: { contract: { deployments: [{ chainId: 11155111, address: CONTRACT }] } },
  metadata: { contractName: "Example Vault" },
  display: {
    formats: {
      "payOut(address to,uint256 amount)": {
        intent: "Pay out",
        interpolatedIntent: "Pay out {amount} units to {to}",
        fields: [
          { path: "to", label: "To", format: "addressName" },
          { path: "amount", label: "Amount", format: "raw" },
        ],
      },
      "submitOrder((address token,uint256 amount) order,address[] recipients)": {
        intent: { Action: "Place", Type: "order" },
        fields: [
          { path: "order.token", label: "Token", format: "addressName" },
          { path: "recipients[0]", label: "First recipient", format: "addressName" },
          { path: "@.value", label: "Value", format: "amount" },
        ],
      },
    },
  },
};

const abi = parseAbi(["function payOut(address to, uint256 amount)", "function submitOrder((address token, uint256 amount) order, address[] recipients)", "function other(uint256 x)"]);
const call = (data: `0x${string}`, to: Address = CONTRACT, operation: 0 | 1 = 0): SafeCall => ({ to, value: 0n, data, operation });
const payOut = (to: Address) => call(encodeFunctionData({ abi, functionName: "payOut", args: [to, 5n] }));

describe("explain layer", () => {
  it("explains a described call and finds its address field", () => {
    const e = explainCall(payOut(OTHER), 11155111, [descriptor])!;
    expect(e.contractName).toBe("Example Vault");
    expect(e.intent).toBe("Pay out");
    expect(e.text).toBe(`Pay out 5 units to ${OTHER}`);
    expect(e.addresses).toEqual([{ label: "To", address: OTHER }]);
    expect(e.fields.map((f) => f.label)).toEqual(["To", "Amount"]);
  });

  it("reads nested tuple and array paths, joins an object intent, skips the transaction container", () => {
    const data = encodeFunctionData({ abi, functionName: "submitOrder", args: [{ token: OTHER, amount: 9n }, [L]] });
    const e = explainCall(call(data), 11155111, [descriptor])!;
    expect(e.intent).toBe("Place order");
    expect(e.text).toBe("Place order");
    expect(e.addresses.map((a) => a.address)).toEqual([OTHER, L]);
    expect(e.fields.some((f) => f.label === "Value")).toBe(false);
  });

  it("explains nothing when the descriptor does not bind to this contract and chain", () => {
    expect(explainCall(payOut(OTHER), 1, [descriptor])).toBeNull();
    expect(explainCall(call(payOut(OTHER).data, OTHER), 11155111, [descriptor])).toBeNull();
  });

  it("explains nothing for an undescribed function, malformed calldata, a delegatecall or a bad descriptor", () => {
    expect(explainCall(call(encodeFunctionData({ abi, functionName: "other", args: [1n] })), 11155111, [descriptor])).toBeNull();
    expect(explainCall(call("0x"), 11155111, [descriptor])).toBeNull();
    expect(explainCall(call(payOut(OTHER).data.slice(0, 20) as `0x${string}`), 11155111, [descriptor])).toBeNull();
    expect(explainCall({ ...payOut(OTHER), operation: 1 }, 11155111, [descriptor])).toBeNull();
    expect(explainCall(payOut(OTHER), 11155111, [null, "x", {}, { context: 3 }])).toBeNull();
  });

  it("treats two keys with one type-only signature as an invalid descriptor", () => {
    const twice = { ...descriptor, display: { formats: { "payOut(address to,uint256 amount)": {}, "payOut(address who,uint256 n)": {} } } };
    expect(explainCall(payOut(OTHER), 11155111, [twice])).toBeNull();
  });

  it("flags a described address that resembles an approved payee, but not the payee itself or a different address", () => {
    expect(resemblingPayees(explainCall(payOut(L), 11155111, [descriptor])!, [P])).toEqual([{ address: L, payee: P, label: "To" }]);
    expect(resemblingPayees(explainCall(payOut(P), 11155111, [descriptor])!, [P])).toEqual([]);
    expect(resemblingPayees(explainCall(payOut(OTHER), 11155111, [descriptor])!, [P])).toEqual([]);
  });

  it("never changes the verdict: a described call is still cannot verify", () => {
    const c = payOut(P);
    expect(explainCall(c, 11155111, [descriptor])).not.toBeNull();
    const decoded = decodeSafeCall(c, { safe: SAFE, guard: GUARD });
    expect(decoded.kind).toBe("unsupported");
    expect(verdictFor(decoded, [P])).toEqual({ level: "GREY", reason: "unsupported" });
  });
});
