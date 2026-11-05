/**
 * The parts of the deployed HexFenceGuard that clients use (contracts/contracts/HexFenceGuard.sol).
 * `checkTransaction` / `checkAfterExecution` are left out: only the Safe calls them.
 * A test compares every entry here with the compiled Hardhat artifact.
 */
export const hexFenceGuardAbi = [
  {
    type: "function",
    name: "payees",
    stateMutability: "view",
    inputs: [{ name: "safe", type: "address" }],
    outputs: [{ name: "", type: "address[]" }],
  },
  {
    type: "function",
    name: "isApprovedPayee",
    stateMutability: "view",
    inputs: [
      { name: "safe", type: "address" },
      { name: "payee", type: "address" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "payeeByFingerprint",
    stateMutability: "view",
    inputs: [
      { name: "", type: "address" },
      { name: "", type: "bytes4" },
    ],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "fingerprint",
    stateMutability: "pure",
    inputs: [{ name: "a", type: "address" }],
    outputs: [{ name: "", type: "bytes4" }],
  },
  {
    type: "function",
    name: "supportsInterface",
    stateMutability: "view",
    inputs: [{ name: "interfaceId", type: "bytes4" }],
    outputs: [{ name: "", type: "bool" }],
  },
  // Called BY the Safe, as a Safe transaction to the Guard (msg.sender is the Safe).
  {
    type: "function",
    name: "approvePayee",
    stateMutability: "nonpayable",
    inputs: [{ name: "payee", type: "address" }],
    outputs: [],
  },
  {
    type: "function",
    name: "removePayee",
    stateMutability: "nonpayable",
    inputs: [{ name: "payee", type: "address" }],
    outputs: [],
  },
  {
    type: "event",
    name: "PayeeApproved",
    anonymous: false,
    inputs: [
      { name: "safe", type: "address", indexed: true },
      { name: "payee", type: "address", indexed: true },
      { name: "fingerprint", type: "bytes4", indexed: false },
    ],
  },
  {
    type: "event",
    name: "PayeeRemoved",
    anonymous: false,
    inputs: [
      { name: "safe", type: "address", indexed: true },
      { name: "payee", type: "address", indexed: true },
      { name: "fingerprint", type: "bytes4", indexed: false },
    ],
  },
  {
    type: "error",
    name: "LookalikeOfApprovedPayee",
    inputs: [
      { name: "recipient", type: "address" },
      { name: "approvedPayee", type: "address" },
    ],
  },
  {
    type: "error",
    name: "FingerprintAlreadyApproved",
    inputs: [
      { name: "fingerprint", type: "bytes4" },
      { name: "existingPayee", type: "address" },
    ],
  },
  { type: "error", name: "NotApprovedPayee", inputs: [{ name: "payee", type: "address" }] },
  { type: "error", name: "DelegateCallNotAllowed", inputs: [{ name: "target", type: "address" }] },
  { type: "error", name: "ZeroAddressPayee", inputs: [] },
] as const;
