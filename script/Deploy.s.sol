// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {MockERC20} from "../src/MockERC20.sol";
import {NFATFacility} from "../src/NFATFacility.sol";

contract Deploy is Script {
    // Anvil default accounts
    address constant ADMIN = 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266;
    address constant OPERATOR = 0x70997970C51812dc3A010C7d01b50e0d17dc79C8;
    address constant DEPOSITOR = 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC;
    address constant RECIPIENT = 0x90F79bf6EB2c4f870365E785982E1f101E93b906;

    // Anvil default private key for account 0
    uint256 constant ADMIN_KEY = 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80;

    function run() external {
        vm.startBroadcast(ADMIN_KEY);

        // 1. Deploy MockERC20
        MockERC20 token = new MockERC20();
        console.log("MockERC20:", address(token));

        // 2. Mint 1M tokens to Depositor and Admin
        uint256 amount = 1_000_000e18;
        token.mint(DEPOSITOR, amount);
        token.mint(ADMIN, amount);

        // 3. Deploy 3 NFATFacility instances
        NFATFacility senior = new NFATFacility(
            "SeniorSecured", ADMIN, address(token), RECIPIENT, address(0), OPERATOR
        );
        NFATFacility mezzanine = new NFATFacility(
            "Mezzanine", ADMIN, address(token), RECIPIENT, address(0), OPERATOR
        );
        NFATFacility structured = new NFATFacility(
            "Structured", ADMIN, address(token), RECIPIENT, address(0), OPERATOR
        );

        console.log("SeniorSecured:", address(senior));
        console.log("Mezzanine:", address(mezzanine));
        console.log("Structured:", address(structured));

        // 4. Approve all 3 facilities for Admin (Halo funder)
        token.approve(address(senior), type(uint256).max);
        token.approve(address(mezzanine), type(uint256).max);
        token.approve(address(structured), type(uint256).max);

        vm.stopBroadcast();

        // 5. Approve all 3 facilities for Depositor (separate broadcast)
        uint256 depositorKey = 0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a;
        vm.startBroadcast(depositorKey);
        token.approve(address(senior), type(uint256).max);
        token.approve(address(mezzanine), type(uint256).max);
        token.approve(address(structured), type(uint256).max);
        vm.stopBroadcast();

        console.log("");
        console.log("=== Deployed 3 facilities ===");
        console.log("TOKEN:", address(token));
    }
}
