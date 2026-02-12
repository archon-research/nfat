// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

interface IIdentityNetwork {
    function isMember(address account) external view returns (bool);
}
