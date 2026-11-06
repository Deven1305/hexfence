// Authorized scripted Sepolia-only drill. Default: read-only checks; --send: one run only.
process.env.HARDHAT_NETWORK ??= "sepolia";
const { ethers, artifacts } = require("hardhat");
const { getSafeSingletonDeployment, getProxyFactoryDeployment } = require("@safe-global/safe-deployments");
const fs = require("node:fs");
const path = require("node:path");
const solc = require("solc-v2");
const Z = ethers.ZeroAddress;
const P = "0x4E185e251Ac7fB83E9DE10723EAda46cadE74120";
const L = "0x4E185a3FC4B530244aB9ed0dE38167b403344120";
const B = ethers.getAddress("0x7c42d2e09b3f5a6c8e1d4f2a0b9c3e5d7f6a1b20");
const GOV = "0x108ea016F84d9817364b65Df6A133afe9CA33855";
const MOD = "0xa7Dc08C6fb15fCdBF4De484FaE393fea052c546B";
const V2 = "0x0adF080DE3DA9D672fDc7330B8750a0579A698c7";
const PROTECTED = ["0x3BCc3969713778F3Ed26AE1490529eeBAD43FbD5", "0x5142C7E9DE82726CaCb847c5469D460508738214"].map(a => a.toLowerCase());
const CAP = ethers.parseEther("0.012");
const GUARD_SLOT = "0x4a204f620c8c5ccdca3fd54d003badd85ba500436a431f0cbda4f558c93c34c8";
const MODULE_SLOT = "0xb104e0b93118902c651344349b610029d694cfdec91c589c91ebafbcd0289947";
const moduleGuardOf = async safe => ethers.getAddress("0x" + (await ethers.provider.getStorage(safe, MODULE_SLOT)).slice(-40));
const file = path.join(__dirname, "../deployments/live-guard-receipts-v2-sepolia.json");
const priorFile = path.join(__dirname, "../deployments/live-guard-receipts-sepolia.json");
// Kept here, rather than adding or changing any contract source/test. Only this
// deployer can operate this module, and only against its immutable isolated Safe.
const moduleSource = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;
interface ISafeModule { function execTransactionFromModule(address,uint256,bytes calldata,uint8) external returns(bool); }
contract ReceiptModule {
 address public immutable owner; address public immutable safe;
 constructor(address s) { owner=msg.sender; safe=s; }
 function pay(address recipient) external { require(msg.sender==owner,"owner"); require(ISafeModule(safe).execTransactionFromModule(recipient,1,"",0),"payment failed"); }
}`;
const assert = (condition, message) => { if (!condition) throw Error(message); };
// Some load-balanced RPC reads lag a newly returned receipt. Retry reads only.
async function readEventually(read) {
  let failure;
  for (let i = 0; i < 8; i++) {
    try { return await read(); } catch (e) { failure = e; }
    await new Promise(resolve => setTimeout(resolve, 1500));
  }
  throw failure;
}
let stage = "initial checks";
async function main() {
  assert((await ethers.provider.getNetwork()).chainId === 11155111n, "Sepolia only");
  if (process.argv.includes("--verify")) {
    let total = 0n;
    for (const receiptFile of [priorFile, file]) {
      const record = JSON.parse(fs.readFileSync(receiptFile, "utf8"));
      for (const entry of record.transactions) {
        const rc = await ethers.provider.getTransactionReceipt(entry.hash);
        assert(rc && rc.status === entry.status && rc.blockHash === entry.blockHash && String(rc.fee) === entry.feeWei, "Receipt differs from journal");
        if (entry.expectedStatus === 0) assert(entry.preflightError?.name === "LookalikeOfKnownRecipient", "Expected preflight refusal missing");
        total += rc.fee + BigInt(entry.valueWei);
        console.log(`${entry.label}: ${entry.hash} status ${rc.status}`);
      }
    }
    const complete = JSON.parse(fs.readFileSync(file, "utf8"));
    assert(complete.state === "complete" && total === BigInt(complete.spentWei) && total <= CAP, "Budget reconciliation failed");
    console.log(`Read-back complete; total including failed first creation and two wei funding: ${ethers.formatEther(total)} ETH`);
    return;
  }
  const existing = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : null;
  assert(!existing || (process.argv.includes("--continue") && existing.state !== "complete"), "Run record exists; refusing repeat");
  if (existing) for (const entry of existing.transactions) {
    const rc = entry.hash && await ethers.provider.getTransactionReceipt(entry.hash);
    assert(entry.state === "mined" && rc?.status === entry.expectedStatus && rc.blockHash === entry.blockHash, "Interrupted broadcast requires read-only reconciliation; cannot continue");
  }
  const [owner] = await ethers.getSigners();
  assert(owner, "Existing testnet key required");
  assert(!existing || existing.owner.toLowerCase() === owner.address.toLowerCase(), "Journal owner differs");
  const balance = await ethers.provider.getBalance(owner.address);
  // Account for the confirmed failed first creation as part of the SAME budget.
  let priorSpent = 0n;
  if (fs.existsSync(priorFile)) {
    const prior = JSON.parse(fs.readFileSync(priorFile, "utf8"));
    assert(prior.state === "failed" && prior.transactions.length === 1, "Prior run requires review");
    const rc = await ethers.provider.getTransactionReceipt(prior.transactions[0].hash);
    assert(rc?.status === 0 && rc.from.toLowerCase() === owner.address.toLowerCase(), "Prior failure not confirmed");
    priorSpent = rc.fee;
  }
  const feeData = await ethers.provider.getFeeData();
  const price = existing ? BigInt(existing.maxFeePerGas) : feeData.maxFeePerGas;
  if (existing) feeData.maxPriorityFeePerGas = BigInt(existing.maxPriorityFeePerGas);
  assert(price && feeData.maxPriorityFeePerGas !== null, "EIP-1559 fees unavailable");
  // Conservative upper bound for every transaction; ordinary sends must also
  // pass estimateGas before broadcasting. The two deliberate reverts skip it.
  const maximumGas = 20000000n;
  const maximumCost = maximumGas * price + 2n + priorSpent;
  assert(maximumCost <= CAP && balance >= maximumCost - priorSpent, "Entire drill will not fit budget/balance; stopped before spending");
  const deployments = {};
  for (const version of ["1.4.1", "1.5.0"]) {
    stage = `official Safe ${version} checks`;
    const filter = { version, network: "11155111" };
    const singleton = getSafeSingletonDeployment(filter);
    const factory = getProxyFactoryDeployment(filter);
    assert(singleton && factory, `Official Safe ${version} unavailable on Sepolia`);
    for (const info of [singleton, factory]) {
      const address = info.networkAddresses[filter.network];
      const hash = ethers.keccak256(await ethers.provider.getCode(address));
      assert(Object.values(info.deployments).some(d => d.address.toLowerCase() === address.toLowerCase() && d.codeHash.toLowerCase() === hash.toLowerCase()), "Official runtime hash mismatch");
    }
    const safe = new ethers.Contract(singleton.networkAddresses[filter.network], singleton.abi, owner);
    assert(await safe.VERSION() === version, "Official Safe version mismatch");
    deployments[version] = { singleton, factory };
  }
  const gov = await ethers.getContractAt("HexFenceGovernanceGuardV2", GOV);
  const v2 = await ethers.getContractAt("HexFenceGuardV2", V2);
  const mod = await ethers.getContractAt("HexFenceModuleGuard", MOD);
  for (const [name, address] of [["HexFenceGovernanceGuardV2", GOV], ["HexFenceGuardV2", V2]]) {
    assert(await ethers.provider.getCode(address) === (await artifacts.readArtifact(name)).deployedBytecode, `${name} runtime mismatch`);
  }
  // The module guard contains an immutable V2 address: compare compiled runtime
  // after replacing only compiler-declared immutable references.
  const modArtifact = await artifacts.readArtifact("HexFenceModuleGuard");
  const build = await artifacts.getBuildInfo(`${modArtifact.sourceName}:${modArtifact.contractName}`);
  const compiled = build.output.contracts[modArtifact.sourceName][modArtifact.contractName].evm.deployedBytecode;
  let runtime = compiled.object;
  for (const refs of Object.values(compiled.immutableReferences)) for (const { start, length } of refs) {
    const value = ethers.zeroPadValue(V2, length).slice(2).toLowerCase();
    runtime = runtime.slice(0, start * 2) + value + runtime.slice((start + length) * 2);
  }
  assert((await ethers.provider.getCode(MOD)).toLowerCase() === `0x${runtime}`.toLowerCase(), "Module runtime mismatch");
  assert((await mod.guard()).toLowerCase() === V2.toLowerCase(), "Module V2 source mismatch");
  assert(await gov.fingerprint(P) === await gov.fingerprint(L), "Expected synthetic resemblance pair");
  const input = { language: "Solidity", sources: { "ReceiptModule.sol": { content: moduleSource } }, settings: { optimizer: { enabled: true, runs: 200 }, evmVersion: "cancun", outputSelection: { "*": { "*": ["abi", "evm.bytecode.object", "evm.deployedBytecode.object", "evm.deployedBytecode.immutableReferences"] } } } };
  const output = JSON.parse(solc.compile(JSON.stringify(input)));
  assert(!output.errors?.some(e => e.severity === "error"), "Module compilation failed");
  const moduleArtifact = output.contracts["ReceiptModule.sol"].ReceiptModule;
  const signature = ethers.solidityPacked(["uint256", "uint256", "uint8"], [BigInt(owner.address), 0, 1]);
  const plans = {};
  for (const [label, version] of [["governance", "1.4.1"], ["module", "1.5.0"]]) {
    const { singleton, factory: info } = deployments[version];
    const safeInterface = new ethers.Interface(singleton.abi);
    const init = safeInterface.encodeFunctionData("setup", [[owner.address], 1, Z, "0x", Z, Z, 0, Z]);
    const factory = new ethers.Contract(info.networkAddresses["11155111"], info.abi, owner);
    const saltNonce = BigInt(ethers.id(`HexFence:live-guard-receipts:v2:${label}:${owner.address}`));
    const salt = ethers.keccak256(ethers.solidityPacked(["bytes32", "uint256"], [ethers.keccak256(init), saltNonce]));
    const creation = ethers.concat([await factory.proxyCreationCode(), ethers.zeroPadValue(singleton.networkAddresses["11155111"], 32)]);
    const address = ethers.getCreate2Address(factory.target, salt, ethers.keccak256(creation));
    const createdHere = existing?.transactions.some(t => t.label === `${label}.createSafe` && t.status === 1) && existing.safes[label].address === address;
    assert(!PROTECTED.includes(address.toLowerCase()) && (createdHere || await ethers.provider.getCode(address) === "0x"), "Fresh isolated Safe required; refusing existing Safe");
    plans[label] = { version, factory, singleton: singleton.networkAddresses["11155111"], init, saltNonce, address, abi: singleton.abi };
  }
  const result = existing ?? { chainId: 11155111, scripted: true, humanWalletFlow: false, owner: owner.address, budgetWei: String(CAP), startBalanceWei: String(balance), priorSpentWei: String(priorSpent), maxFeePerGas: String(price), maxPriorityFeePerGas: String(feeData.maxPriorityFeePerGas), maximumGas: String(maximumGas), maximumCostWei: String(maximumCost), governanceGuard: GOV, moduleGuard: MOD, v2Guard: V2, payee: P, lookalike: L, safes: Object.fromEntries(Object.entries(plans).map(([k, p]) => [k, { address: p.address, version: p.version, singleton: p.singleton, factory: p.factory.target }])), transactions: [], moduleSource, moduleCompiler: solc.version(), state: "prepared" };
  console.log(JSON.stringify({ mode: process.argv.includes("--continue") ? "continue uncompleted steps" : process.argv.includes("--send") ? "send" : "read-only", balanceETH: ethers.formatEther(balance), maximumCostETH: ethers.formatEther(maximumCost), safes: result.safes }, null, 2));
  if (!process.argv.includes("--send") && !process.argv.includes("--continue")) return;
  if (!existing) fs.writeFileSync(file, JSON.stringify(result, null, 2) + "\n", { flag: "wx" });
  const save = () => fs.writeFileSync(file, JSON.stringify(result, null, 2) + "\n");
  let spent = priorSpent + result.transactions.reduce((n, t) => n + BigInt(t.feeWei) + BigInt(t.valueWei), 0n);
  let reservedGas = result.transactions.reduce((n, t) => n + BigInt(t.gasLimit), 0n);
  async function send(label, request, gasLimit, expectedStatus = 1, preflightError) {
    stage = label;
    const done = result.transactions.find(t => t.label === label);
    if (done) return ethers.provider.getTransactionReceipt(done.hash);
    const value = BigInt(request.value ?? 0);
    reservedGas += gasLimit;
    assert(reservedGas <= maximumGas && spent + gasLimit * price + value <= CAP, "Budget exhausted before broadcast");
    assert(await ethers.provider.getBalance(owner.address) >= gasLimit * price + value, "Balance insufficient before broadcast");
    if (expectedStatus === 1) assert(await readEventually(() => owner.estimateGas(request)) <= gasLimit, "Gas estimate exceeds bound; stopped before broadcast");
    // Persist intended nonce before broadcast; never retry an ambiguous submission.
    const nonce = await ethers.provider.getTransactionCount(owner.address, "pending");
    const entry = { label, nonce, gasLimit: String(gasLimit), valueWei: String(value), expectedStatus, ...(preflightError ? { preflightError } : {}), state: "broadcasting" };
    result.transactions.push(entry); save();
    const tx = await owner.sendTransaction({ ...request, nonce, gasLimit, maxFeePerGas: price, maxPriorityFeePerGas: feeData.maxPriorityFeePerGas });
    entry.hash = tx.hash; save();
    let receipt;
    try { receipt = await tx.wait(); } catch (e) { receipt = e.receipt; }
    assert(receipt, "Receipt unavailable; inspect journal nonce/hash without resubmission");
    // Fresh RPC read required even after wait().
    const readBack = await ethers.provider.getTransactionReceipt(tx.hash);
    assert(readBack && readBack.blockHash === receipt.blockHash && readBack.status === expectedStatus, "Receipt read-back status mismatch");
    spent += readBack.fee + value;
    Object.assign(entry, { state: "mined", status: readBack.status, blockNumber: readBack.blockNumber, blockHash: readBack.blockHash, gasUsed: String(readBack.gasUsed), effectiveGasPrice: String(readBack.gasPrice), feeWei: String(readBack.fee) });
    result.spentWei = String(spent); save();
    console.log(`${label}: ${tx.hash} status ${readBack.status}`);
    return readBack;
  }
  async function create(label) {
    const p = plans[label];
    await send(`${label}.createSafe`, await p.factory.createProxyWithNonce.populateTransaction(p.singleton, p.init, p.saltNonce), 1500000n);
    const safe = new ethers.Contract(p.address, p.abi, owner);
    await readEventually(async () => assert(await safe.VERSION() === p.version && await safe.getThreshold() === 1n && await safe.isOwner(owner.address), "Isolated owner check failed"));
    assert((await safe.getOwners()).length === (result.transactions.some(t => t.label === "governance.nonLookalikeOwnerAllowed") && label === "governance" ? 2 : 1), "Unexpected isolated Safe owners");
    return safe;
  }
  function exec(safe, to, data) {
    assert(Object.values(plans).some(p => p.address === safe.target) && !PROTECTED.includes(safe.target.toLowerCase()), "Only newly created isolated Safes permitted");
    return safe.execTransaction.populateTransaction(to, 0, data, 0, 0, 0, 0, Z, Z, signature);
  }
  async function safeCall(label, safe, to, data) {
    if (result.transactions.some(t => t.label === label && t.state === "mined")) return;
    stage = `${label} preflight`;
    const request = await exec(safe, to, data);
    await readEventually(() => ethers.provider.call({ ...request, from: owner.address }));
    const rc = await send(label, request, 750000n);
    assert(rc.logs.some(l => { try { return l.address.toLowerCase() === safe.target.toLowerCase() && safe.interface.parseLog(l)?.name === "ExecutionSuccess"; } catch { return false; } }), "Safe inner execution did not succeed");
  }
  async function refuse(label, request, guard) {
    if (result.transactions.some(t => t.label === label && t.state === "mined")) return;
    let parsed;
    try { await ethers.provider.call({ ...request, from: owner.address }); }
    catch (e) { const data = e.data ?? e.info?.error?.data; try { parsed = guard.interface.parseError(typeof data === "string" ? data : data?.data); } catch {} }
    assert(parsed?.name === "LookalikeOfKnownRecipient" && parsed.args[0].toLowerCase() === L.toLowerCase() && parsed.args[1].toLowerCase() === P.toLowerCase(), "Expected exact lookalike preflight error");
    await send(label, request, 750000n, 0, { name: parsed.name, recipient: parsed.args[0], knownHolder: parsed.args[1] });
  }
  const gs = await create("governance");
  await safeCall("governance.setGuard", gs, gs.target, gs.interface.encodeFunctionData("setGuard", [GOV]));
  await safeCall("governance.approvePayee", gs, GOV, gov.interface.encodeFunctionData("approve", [P]));
  await refuse("governance.lookalikeOwnerRefused", await exec(gs, gs.target, gs.interface.encodeFunctionData("addOwnerWithThreshold", [L, 1])), gov);
  assert(!await gs.isOwner(L), "Refused owner unexpectedly present");
  assert(await gov.fingerprint(B) !== await gov.fingerprint(P) && await gov.fingerprint(B) !== await gov.fingerprint(owner.address), "New owner collision");
  await safeCall("governance.nonLookalikeOwnerAllowed", gs, gs.target, gs.interface.encodeFunctionData("addOwnerWithThreshold", [B, 1]));
  result.nonLookalikeOwner = B; save();
  assert(await gs.isOwner(B) && await gs.getThreshold() === 1n, "Allowed owner missing");
  assert(ethers.getAddress("0x" + (await ethers.provider.getStorage(gs.target, GUARD_SLOT)).slice(-40)) === GOV, "Governance guard not active");
  const ms = await create("module");
  const moduleFactory = new ethers.ContractFactory(moduleArtifact.abi, moduleArtifact.evm.bytecode.object, owner);
  const deployed = await send("module.deployModule", await moduleFactory.getDeployTransaction(ms.target), 1500000n);
  const module = new ethers.Contract(deployed.contractAddress, moduleArtifact.abi, owner);
  result.module = module.target; save();
  await readEventually(async () => assert(await module.owner() === owner.address && await module.safe() === ms.target, "Module restrictions mismatch"));
  const moduleCode = (await ethers.provider.getCode(module.target)).slice(2).toLowerCase();
  let expectedModuleCode = moduleArtifact.evm.deployedBytecode.object;
  const immutableValues = new Set();
  for (const refs of Object.values(moduleArtifact.evm.deployedBytecode.immutableReferences)) for (const { start, length } of refs) {
    const actual = moduleCode.slice(start * 2, (start + length) * 2);
    assert([owner.address, ms.target].some(a => ethers.zeroPadValue(a, length).slice(2).toLowerCase() === actual), "Unexpected module immutable");
    immutableValues.add(actual);
    expectedModuleCode = expectedModuleCode.slice(0, start * 2) + actual + expectedModuleCode.slice((start + length) * 2);
  }
  assert(immutableValues.size === 2 && expectedModuleCode.toLowerCase() === moduleCode, "Deployed module runtime mismatch");
  result.moduleRuntimeHash = ethers.keccak256(`0x${moduleCode}`); save();
  await safeCall("module.setTransactionGuard", ms, ms.target, ms.interface.encodeFunctionData("setGuard", [V2]));
  if (!result.transactions.some(t => t.label === "module.approvePayeeInV2")) assert((await v2.knownRecipients(ms.target)).length === 0, "New Safe list must start empty");
  await safeCall("module.approvePayeeInV2", ms, V2, v2.interface.encodeFunctionData("approve", [P]));
  await safeCall("module.enableModule", ms, ms.target, ms.interface.encodeFunctionData("enableModule", [module.target]));
  await safeCall("module.setModuleGuard", ms, ms.target, ms.interface.encodeFunctionData("setModuleGuard", [MOD]));
  assert(await ms.isModuleEnabled(module.target) && (await moduleGuardOf(ms.target)).toLowerCase() === MOD.toLowerCase(), "Module setup mismatch");
  assert((await v2.holderOf(ms.target, await v2.fingerprint(P))).toLowerCase() === P.toLowerCase(), "Safe-scoped V2 approval missing");
  await send("module.fundTwoWei", { to: ms.target, value: 2n }, 50000n);
  const before = 2n;
  stage = "module.recordedRecipientPaid preflight";
  await readEventually(() => module.pay.staticCall(P));
  const paid = await send("module.recordedRecipientPaid", await module.pay.populateTransaction(P), 750000n);
  assert(paid.logs.some(l => { try { return l.address.toLowerCase() === ms.target.toLowerCase() && ms.interface.parseLog(l)?.name === "ExecutionFromModuleSuccess"; } catch { return false; } }), "Module inner execution missing");
  await readEventually(async () => assert(await ethers.provider.getBalance(ms.target) === before - 1n, "Expected one wei payment"));
  await refuse("module.lookalikePaymentRefused", await module.pay.populateTransaction(L), mod);
  assert(await ethers.provider.getBalance(ms.target) === before - 1n, "Reverted call moved funds");
  result.final = { governanceOwners: Array.from(await gs.getOwners()), governanceGuard: ethers.getAddress("0x" + (await ethers.provider.getStorage(gs.target, GUARD_SLOT)).slice(-40)), moduleGuard: await moduleGuardOf(ms.target), moduleKnownRecipients: Array.from(await v2.knownRecipients(ms.target)), moduleSafeBalanceWei: String(await ethers.provider.getBalance(ms.target)), moduleAutoLearn: await v2.autoLearn(ms.target) };
  result.endBalanceWei = String(await ethers.provider.getBalance(owner.address));
  result.balanceDecreaseWei = String(BigInt(result.startBalanceWei) - BigInt(result.endBalanceWei));
  assert(BigInt(result.balanceDecreaseWei) + priorSpent === spent && spent <= CAP, "Spending reconciliation failed");
  result.state = "complete"; save();
  console.log(JSON.stringify({ state: result.state, spentETH: ethers.formatEther(spent), file }, null, 2));
}
main().catch(e => { console.error(`Guard receipt drill stopped at ${stage}: ${e.message === "Sepolia only" ? "Sepolia only" : e.code ? `error code ${e.code}; provider details withheld` : e.message}. Never repeat an ambiguous broadcast.`); process.exitCode = 1; });
