// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;
import {Enum} from "@safe-global/safe-contracts/contracts/common/Enum.sol";
import {BaseGuard} from "@safe-global/safe-contracts/contracts/base/GuardManager.sol";

interface IHexFenceGovernanceOwners {
    function getOwners() external view returns (address[] memory);
}

/// @notice Separate V2 deployment with owner/module address resemblance checks.
/// @dev New deployment; no owner, upgrade path, oracle or dependency on v1.
contract HexFenceGovernanceGuardV2 is BaseGuard {
    error LookalikeOfKnownRecipient(address recipient, address knownHolder);
    error FingerprintAlreadyHeld(bytes4 fingerprint, address holder);
    error DelegateCallNotAllowed(address target);
    error LookalikeOfExistingOwner(address candidate, address existingOwner);
    error ZeroAddressRecipient();
    error UnknownRecipient(address recipient);
    event RecipientLearned(address indexed safe, address indexed recipient, bytes4 fingerprint);
    event RecipientApproved(address indexed safe, address indexed recipient, bytes4 fingerprint);
    event RecipientForgotten(address indexed safe, address indexed recipient, bytes4 fingerprint);
    event AutoLearnChanged(address indexed safe, bool enabled);

    mapping(address => mapping(bytes4 => address)) public holderOf;
    mapping(address => bool) public autoLearn;
    mapping(address => address[]) private _known;
    mapping(address => mapping(address => uint256)) private _index;
    mapping(address => mapping(address => bool)) public isApproved;
    mapping(address => mapping(address => uint64)) public firstPaidAt;
    struct Recipient { address recipient; bool approved; uint64 firstPaidAt; }

    function fingerprint(address a) public pure returns (bytes4) {
        uint160 x = uint160(a);
        return bytes4(uint32(((x >> 144) << 16) | (x & 0xffff)));
    }
    function knownRecipients(address safe) external view returns (address[] memory) { return _known[safe]; }
    function recipientDetails(address safe) external view returns (Recipient[] memory result) {
        address[] storage list = _known[safe];
        result = new Recipient[](list.length);
        for (uint256 i; i < list.length; ++i)
            result[i] = Recipient(list[i], isApproved[safe][list[i]], firstPaidAt[safe][list[i]]);
    }
    function setAutoLearn(bool enabled) external {
        autoLearn[msg.sender] = enabled;
        emit AutoLearnChanged(msg.sender, enabled);
    }
    function approve(address recipient) external { _hold(msg.sender, recipient, true); }
    function forget(address recipient) external {
        address safe = msg.sender;
        uint256 idx = _index[safe][recipient];
        if (idx == 0) revert UnknownRecipient(recipient);
        address[] storage list = _known[safe];
        address last = list[list.length - 1];
        list[idx - 1] = last; _index[safe][last] = idx; list.pop();
        delete _index[safe][recipient]; delete holderOf[safe][fingerprint(recipient)];
        delete isApproved[safe][recipient]; delete firstPaidAt[safe][recipient];
        emit RecipientForgotten(safe, recipient, fingerprint(recipient));
    }
    function _hold(address safe, address recipient, bool approved) private {
        if (recipient == address(0)) revert ZeroAddressRecipient();
        bytes4 fp = fingerprint(recipient);
        address holder = holderOf[safe][fp];
        if (holder != address(0) && holder != recipient) revert FingerprintAlreadyHeld(fp, holder);
        if (_index[safe][recipient] == 0) {
            holderOf[safe][fp] = recipient;
            _known[safe].push(recipient); _index[safe][recipient] = _known[safe].length;
        }
        if (approved) {
            if (!isApproved[safe][recipient]) {
                isApproved[safe][recipient] = true;
                emit RecipientApproved(safe, recipient, fp);
            }
        } else if (firstPaidAt[safe][recipient] == 0) {
            firstPaidAt[safe][recipient] = uint64(block.timestamp);
            emit RecipientLearned(safe, recipient, fp);
        }
    }

    function checkTransaction(address to, uint256 value, bytes memory data, Enum.Operation operation,
        uint256, uint256, uint256, address, address payable, bytes memory, address) external override {
        address safe = msg.sender;
        address nativeRecipient;
        address tokenRecipient;
        // Administration / recovery remain first. Push an empty frame so a nested
        // admin call cannot consume the outer call's pending recipients.
        if (operation == Enum.Operation.Call && (to == safe || to == address(this))) {
            if (to == safe) _checkGovernance(safe, data);
            _push(safe, address(0), address(0)); return;
        }
        if (operation == Enum.Operation.DelegateCall) revert DelegateCallNotAllowed(to);
        if (value > 0 || data.length == 0) nativeRecipient = _check(safe, to);
        if (data.length >= 68 && bytes4(data) == 0xa9059cbb) tokenRecipient = _check(safe, _addressAt(data, 4));
        else if (data.length >= 100 && bytes4(data) == 0x23b872dd) tokenRecipient = _check(safe, _addressAt(data, 36));
        _push(safe, nativeRecipient, tokenRecipient);
    }
    /// @dev Only the three named Safe self-calls are inspected. In particular,
    /// setGuard is never decoded and never causes an owner-list read.
    function _checkGovernance(address safe, bytes memory data) private view {
        if (data.length < 4) return;
        bytes4 selector = bytes4(data);
        address candidate;
        if (selector == 0x0d582f13 && data.length >= 68) candidate = _addressAt(data, 4);
        else if (selector == 0xe318b52b && data.length >= 100) candidate = _addressAt(data, 68);
        else if (selector == 0x610b5925 && data.length >= 36) candidate = _addressAt(data, 4);
        else return;
        _check(safe, candidate); // Check known holders without learning an admin address.
        bytes4 fp = fingerprint(candidate);
        address[] memory owners = IHexFenceGovernanceOwners(safe).getOwners();
        for (uint256 i; i < owners.length; ++i) {
            if (owners[i] != candidate && fingerprint(owners[i]) == fp)
                revert LookalikeOfExistingOwner(candidate, owners[i]);
        }
    }

    function _check(address safe, address recipient) private view returns (address) {
        address holder = holderOf[safe][fingerprint(recipient)];
        if (holder != address(0) && holder != recipient) revert LookalikeOfKnownRecipient(recipient, holder);
        // Zero-address transfers may be inspected but never become a holder.
        if (autoLearn[safe] && firstPaidAt[safe][recipient] == 0) return recipient;
        return address(0);
    }
    function checkAfterExecution(bytes32, bool success) external override {
        address safe = msg.sender;
        bytes32 depthSlot = _depthSlot(safe);
        uint256 depth = _load(depthSlot);
        if (depth == 0) return;
        bytes32 firstSlot = _pendingSlot(safe, depth, 0);
        bytes32 secondSlot = _pendingSlot(safe, depth, 1);
        address first = address(uint160(_load(firstSlot)));
        address second = address(uint160(_load(secondSlot)));
        _store(firstSlot, 0); _store(secondSlot, 0); _store(depthSlot, depth - 1);
        if (!success) return;
        if (first != address(0)) _hold(safe, first, false);
        if (second != address(0)) _hold(safe, second, false);
    }
    function _push(address safe, address first, address second) private {
        bytes32 slot = _depthSlot(safe);
        uint256 depth = _load(slot) + 1;
        _store(slot, depth);
        _store(_pendingSlot(safe, depth, 0), uint160(first));
        _store(_pendingSlot(safe, depth, 1), uint160(second));
    }
    function _depthSlot(address safe) private pure returns (bytes32) { return keccak256(abi.encode("hexfence.v2.depth", safe)); }
    function _pendingSlot(address safe, uint256 depth, uint256 field) private pure returns (bytes32) {
        return keccak256(abi.encode("hexfence.v2.pending", safe, depth, field));
    }
    function _load(bytes32 slot) private view returns (uint256 value) { assembly { value := tload(slot) } }
    function _store(bytes32 slot, uint256 value) private { assembly { tstore(slot, value) } }
    function _addressAt(bytes memory data, uint256 offset) private pure returns (address a) {
        assembly { a := and(mload(add(add(data, 32), offset)), 0xffffffffffffffffffffffffffffffffffffffff) }
    }
}
