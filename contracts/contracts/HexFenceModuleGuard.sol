// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;
import {Enum} from "@safe-global/safe-contracts/contracts/common/Enum.sol";

interface IHexFenceGuardV2Reads {
    function holderOf(address safe, bytes4 fingerprint) external view returns (address);
    function fingerprint(address a) external pure returns (bytes4);
}

/// @notice Safe 1.5.0 module guard. Applies HexFenceGuardV2's payment checks to module transactions.
/// @dev Reads the list a Safe keeps in V2 and stores nothing, so module payments are checked but never learned.
///      No owner, no upgrade path. Calls to the Safe or to V2 pass unchecked, as they do in V2, so a module
///      can still change the Safe's settings, including this guard. It stops lookalike payments; it does not
///      contain a module acting against the Safe.
contract HexFenceModuleGuard {
    error LookalikeOfKnownRecipient(address recipient, address knownHolder);
    error DelegateCallNotAllowed(address target);

    IHexFenceGuardV2Reads public immutable guard;

    constructor(IHexFenceGuardV2Reads guard_) { guard = guard_; }

    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return interfaceId == 0x58401ed8 // IModuleGuard
            || interfaceId == 0x01ffc9a7; // IERC165
    }

    function checkModuleTransaction(address to, uint256 value, bytes memory data, Enum.Operation operation, address)
        external view returns (bytes32)
    {
        address safe = msg.sender;
        if (operation == Enum.Operation.Call && (to == safe || to == address(guard))) return bytes32(0);
        if (operation == Enum.Operation.DelegateCall) revert DelegateCallNotAllowed(to);
        if (value > 0 || data.length == 0) _check(safe, to);
        if (data.length >= 68 && bytes4(data) == 0xa9059cbb) _check(safe, _addressAt(data, 4));
        else if (data.length >= 100 && bytes4(data) == 0x23b872dd) _check(safe, _addressAt(data, 36));
        return bytes32(0);
    }

    function checkAfterModuleExecution(bytes32, bool) external pure {}

    function _check(address safe, address recipient) private view {
        address holder = guard.holderOf(safe, guard.fingerprint(recipient));
        if (holder != address(0) && holder != recipient) revert LookalikeOfKnownRecipient(recipient, holder);
    }

    function _addressAt(bytes memory data, uint256 offset) private pure returns (address a) {
        assembly { a := and(mload(add(add(data, 32), offset)), 0xffffffffffffffffffffffffffffffffffffffff) }
    }
}
