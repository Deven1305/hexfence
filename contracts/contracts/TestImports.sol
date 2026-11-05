// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import "@safe-global/safe-contracts/contracts/Safe.sol";
import "@safe-global/safe-contracts/contracts/proxies/SafeProxyFactory.sol";

contract MockToken {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    function mint(address to, uint256 v) external { balanceOf[to] += v; }
    function transfer(address to, uint256 v) external returns (bool) { balanceOf[msg.sender] -= v; balanceOf[to] += v; return true; }
    function approve(address s, uint256 v) external returns (bool) { allowance[msg.sender][s] = v; return true; }
    function transferFrom(address f, address to, uint256 v) external returns (bool) { allowance[f][msg.sender] -= v; balanceOf[f] -= v; balanceOf[to] += v; return true; }
}

contract DelegateTarget {
    function poke() external {}
}
