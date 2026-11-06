// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ReceiverTemplate} from "./cre/ReceiverTemplate.sol";

/// @notice Advisory suspected poisoning alerts. The Guard never reads these reports.
/// @dev Simulation deployments trust a public MockKeystoneForwarder, not DON signatures.
contract HexFenceAlerts is ReceiverTemplate {
    uint256 public constant CAPACITY = 32;
    struct Alert {
        address lookalike;
        address resembles;
        bytes32 txHash;
        uint8 variant; // 0 = zero-value, 1 = dust
        uint64 observedBlock;
    }
    mapping(address => Alert[32]) private _alerts;
    mapping(address => uint256) private _next;
    mapping(address => uint256) private _count;
    // Bounded deduplication: forgotten when an alert leaves the ring.
    mapping(address => mapping(address => bool)) public contains;
    error InvalidAlert();
    event PoisoningAttempt(address indexed safe, address indexed lookalike, address resembles,
        bytes32 txHash, uint8 variant);

    constructor(address forwarder) ReceiverTemplate(forwarder) {}

    function alertsOf(address safe) external view returns (Alert[] memory result) {
        uint256 count = _count[safe];
        result = new Alert[](count);
        uint256 start = count == CAPACITY ? _next[safe] : 0;
        for (uint256 i; i < count; ++i) result[i] = _alerts[safe][(start + i) % CAPACITY];
    }

    function _processReport(bytes calldata report) internal override {
        (uint256 chainId, address receiver, address safe, Alert memory a) =
            abi.decode(report, (uint256, address, address, Alert));
        if (chainId != block.chainid || receiver != address(this) || safe == address(0)
            || a.lookalike == address(0) || a.resembles == address(0) || a.lookalike == a.resembles
            || a.variant > 1 || a.txHash == bytes32(0) || a.observedBlock == 0
            || _fp(a.lookalike) != _fp(a.resembles)) revert InvalidAlert();
        if (contains[safe][a.lookalike]) return;
        uint256 slot = _next[safe];
        if (_count[safe] == CAPACITY) delete contains[safe][_alerts[safe][slot].lookalike];
        else ++_count[safe];
        _alerts[safe][slot] = a;
        contains[safe][a.lookalike] = true;
        _next[safe] = (slot + 1) % CAPACITY;
        emit PoisoningAttempt(safe, a.lookalike, a.resembles, a.txHash, a.variant);
    }

    function _fp(address a) private pure returns (uint32) {
        uint160 x = uint160(a);
        return uint32(((x >> 144) << 16) | (x & 0xffff));
    }
}
