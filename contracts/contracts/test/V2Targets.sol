// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;
contract V2PayableToken {
    mapping(address => uint256) public balanceOf;
    function transfer(address recipient, uint256 amount) external payable returns (bool) {
        balanceOf[recipient] += amount; return true;
    }
}
contract V2ReentryTarget {
    function reenter(address safe, bytes calldata transaction) external payable {
        (bool success,) = safe.call(transaction);
        require(success, "nested execution failed");
    }
}
