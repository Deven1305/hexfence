// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Enum} from "@safe-global/safe-contracts/contracts/common/Enum.sol";
import {BaseGuard} from "@safe-global/safe-contracts/contracts/base/GuardManager.sol";

/// @title HexFenceGuard (reference sketch) - deny by resemblance for Safe payments.
/// @notice A Safe transaction guard that refuses ETH / ERC-20 payments to an address that shares
///         the visible fingerprint (first 4 + last 4 hex chars) of one of the Safe's approved payees
///         but is NOT that payee. Genuinely new recipients are allowed (this is not an allowlist).
/// @dev Non-upgradeable, no owner. Every Safe configures only its own namespace (msg.sender).
contract HexFenceGuard is BaseGuard {
    error LookalikeOfApprovedPayee(address recipient, address approvedPayee);
    error FingerprintAlreadyApproved(bytes4 fingerprint, address existingPayee);
    error NotApprovedPayee(address payee);
    error DelegateCallNotAllowed(address target);
    error ZeroAddressPayee();

    event PayeeApproved(address indexed safe, address indexed payee, bytes4 fingerprint);
    event PayeeRemoved(address indexed safe, address indexed payee, bytes4 fingerprint);

    /// safe => fingerprint => the ONE approved payee holding it (duplicates are rejected).
    mapping(address => mapping(bytes4 => address)) public payeeByFingerprint;
    /// safe => approved payees (enumerable for clients).
    mapping(address => address[]) private _payees;
    /// safe => payee => index in _payees + 1 (0 = not approved).
    mapping(address => mapping(address => uint256)) private _indexPlusOne;

    bytes4 private constant TRANSFER = 0xa9059cbb;      // transfer(address,uint256)
    bytes4 private constant TRANSFER_FROM = 0x23b872dd; // transferFrom(address,address,uint256)

    /// @notice fingerprint = first 4 hex chars || last 4 hex chars, e.g. 0x2ef9...8bf7 -> 0x2ef98bf7.
    function fingerprint(address a) public pure returns (bytes4) {
        uint160 x = uint160(a);
        return bytes4(uint32(((x >> 144) << 16) | (x & 0xFFFF)));
    }

    function isApprovedPayee(address safe, address payee) public view returns (bool) {
        return _indexPlusOne[safe][payee] != 0;
    }

    function payees(address safe) external view returns (address[] memory) {
        return _payees[safe];
    }

    /// @notice Call this FROM the Safe (as a Safe transaction). msg.sender is the Safe.
    function approvePayee(address payee) external {
        if (payee == address(0)) revert ZeroAddressPayee();
        address safe = msg.sender;
        if (_indexPlusOne[safe][payee] != 0) return; // already approved: idempotent
        bytes4 fp = fingerprint(payee);
        address existing = payeeByFingerprint[safe][fp];
        if (existing != address(0)) revert FingerprintAlreadyApproved(fp, existing);
        payeeByFingerprint[safe][fp] = payee;
        _payees[safe].push(payee);
        _indexPlusOne[safe][payee] = _payees[safe].length;
        emit PayeeApproved(safe, payee, fp);
    }

    /// @notice Call this FROM the Safe (as a Safe transaction). msg.sender is the Safe.
    function removePayee(address payee) external {
        address safe = msg.sender;
        uint256 idx = _indexPlusOne[safe][payee];
        if (idx == 0) revert NotApprovedPayee(payee);
        address[] storage list = _payees[safe];
        address last = list[list.length - 1];
        list[idx - 1] = last;          // swap-and-pop (works when payee == last)
        _indexPlusOne[safe][last] = idx;
        list.pop();
        delete _indexPlusOne[safe][payee];
        bytes4 fp = fingerprint(payee);
        // Invariant: payeeByFingerprint[safe][fp] == payee, because duplicates are rejected on approval.
        delete payeeByFingerprint[safe][fp];
        emit PayeeRemoved(safe, payee, fp);
    }

    function checkTransaction(
        address to,
        uint256, /* value */
        bytes memory data,
        Enum.Operation operation,
        uint256,
        uint256,
        uint256,
        address,
        address payable,
        bytes memory,
        address
    ) external view override {
        address safe = msg.sender;
        // (1) Administration + recovery path FIRST, before any decoding:
        //     the Safe calling itself (setGuard, owners, threshold) or configuring this guard.
        if (operation == Enum.Operation.Call && (to == safe || to == address(this))) return;
        // (2) Fail closed on delegatecall: we cannot inspect what it will do.
        if (operation == Enum.Operation.DelegateCall) revert DelegateCallNotAllowed(to);
        // (3) Decode the supported payment shapes. Never revert on malformed calldata.
        address recipient;
        if (data.length == 0) {
            recipient = to; // native ETH transfer
        } else if (data.length >= 68 && bytes4(data) == TRANSFER) {
            recipient = _addressAt(data, 4);
        } else if (data.length >= 100 && bytes4(data) == TRANSFER_FROM) {
            recipient = _addressAt(data, 36);
        } else {
            return; // (4) unsupported shape: not inspected (clients must show "cannot verify")
        }
        // (5) Deny by resemblance.
        if (_indexPlusOne[safe][recipient] != 0) return; // approved payee
        address approved = payeeByFingerprint[safe][fingerprint(recipient)];
        if (approved != address(0)) revert LookalikeOfApprovedPayee(recipient, approved);
        // otherwise: a genuinely new recipient -> allowed
    }

    function checkAfterExecution(bytes32, bool) external view override {}

    function _addressAt(bytes memory data, uint256 offset) private pure returns (address a) {
        assembly {
            a := and(mload(add(add(data, 32), offset)), 0xffffffffffffffffffffffffffffffffffffffff)
        }
    }
}
