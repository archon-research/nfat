// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import "forge-std/Test.sol";

import {ERC20} from "openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
import {IERC721} from "openzeppelin-contracts/contracts/token/ERC721/IERC721.sol";
import {IERC721Metadata} from "openzeppelin-contracts/contracts/token/ERC721/extensions/IERC721Metadata.sol";
import {NFATFacility} from "../src/NFATFacility.sol";

contract MockERC20 is ERC20 {
    constructor() ERC20("Mock", "MOCK") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract MockIdentityNetwork {
    mapping(address => bool) public isMember;

    function setMember(address account, bool allowed) external {
        isMember[account] = allowed;
    }
}

contract NFATFacilityTest is Test {
    MockERC20 private asset;
    MockIdentityNetwork private identityNetwork;
    NFATFacility private facility;

    address private operator = address(0xB0B);
    address private pau = address(0xD00D);
    address private depositor = address(0xE11E);

    function setUp() public {
        asset = new MockERC20();
        identityNetwork = new MockIdentityNetwork();
        facility = new NFATFacility("Test", address(asset), pau, address(0), operator);
    }

    // ── wards / hope / nope ─────────────────────────────────────────────

    function testRely() public {
        address usr = address(0xABC);
        facility.rely(usr);
        assertEq(facility.wards(usr), 1);
    }

    function testDeny() public {
        address usr = address(0xABC);
        facility.rely(usr);
        facility.deny(usr);
        assertEq(facility.wards(usr), 0);
    }

    function testRelyNotAuthorized() public {
        vm.prank(address(0xF00D));
        vm.expectRevert("NFATFacility/not-authorized");
        facility.rely(address(0xABC));
    }

    function testDenyNotAuthorized() public {
        vm.prank(address(0xF00D));
        vm.expectRevert("NFATFacility/not-authorized");
        facility.deny(address(0xABC));
    }

    function testHopeNope() public {
        address usr = address(0xABC);
        facility.hope(usr);
        assertEq(facility.can(usr), 1);

        facility.nope(usr);
        assertEq(facility.can(usr), 0);
    }

    function testHopeNotAuthorized() public {
        vm.prank(address(0xF00D));
        vm.expectRevert("NFATFacility/not-authorized");
        facility.hope(address(0xABC));
    }

    function testNopeNotAuthorized() public {
        vm.prank(address(0xF00D));
        vm.expectRevert("NFATFacility/not-authorized");
        facility.nope(address(0xABC));
    }

    function testWardsCanCallOperatorFunctions() public {
        facility.issue(depositor, 0, 99);
        assertEq(facility.ownerOf(99), depositor);
    }

    // ── stop / start ────────────────────────────────────────────────────

    function testStopStart() public {
        facility.stop();
        assertEq(facility.stopped(), 1);

        facility.start();
        assertEq(facility.stopped(), 0);
    }

    function testStopNotAuthorized() public {
        vm.prank(address(0xF00D));
        vm.expectRevert("NFATFacility/not-authorized");
        facility.stop();
    }

    function testStartNotAuthorized() public {
        vm.prank(address(0xF00D));
        vm.expectRevert("NFATFacility/not-authorized");
        facility.start();
    }

    function testStopBlocksDeposit() public {
        facility.stop();

        asset.mint(depositor, 1e18);
        vm.startPrank(depositor);
        asset.approve(address(facility), 1e18);
        vm.expectRevert("NFATFacility/stopped");
        facility.deposit(1e18);
        vm.stopPrank();
    }

    function testStopBlocksIssue() public {
        facility.stop();

        vm.prank(operator);
        vm.expectRevert("NFATFacility/stopped");
        facility.issue(depositor, 0, 1);
    }

    function testStopBlocksIssueForWards() public {
        facility.stop();

        vm.expectRevert("NFATFacility/stopped");
        facility.issue(depositor, 0, 1);
    }

    function testStopBlocksRepay() public {
        vm.prank(operator);
        facility.issue(depositor, 0, 42);

        facility.stop();

        asset.mint(depositor, 1e18);
        vm.startPrank(depositor);
        asset.approve(address(facility), 1e18);
        vm.expectRevert("NFATFacility/stopped");
        facility.repay(42, 1e18);
        vm.stopPrank();
    }

    function testStopBlocksClaim() public {
        vm.prank(operator);
        facility.issue(depositor, 0, 42);

        asset.mint(address(this), 1e18);
        asset.approve(address(facility), 1e18);
        facility.repay(42, 1e18);

        facility.stop();

        vm.prank(depositor);
        vm.expectRevert("NFATFacility/stopped");
        facility.claim(42, 1e18);
    }

    function testStopAllowsWithdraw() public {
        asset.mint(depositor, 1e18);
        vm.startPrank(depositor);
        asset.approve(address(facility), 1e18);
        facility.deposit(1e18);
        vm.stopPrank();

        facility.stop();

        vm.prank(depositor);
        facility.withdraw(1e18);
        assertEq(asset.balanceOf(depositor), 1e18);
    }

    // ── deposit / withdraw ──────────────────────────────────────────────

    function testFuzz_DepositWithdraw(uint96 depositAmount, uint96 withdrawAmount) public {
        uint256 dep = bound(uint256(depositAmount), 1, 1_000_000e18);
        uint256 wit = bound(uint256(withdrawAmount), 1, dep);

        asset.mint(depositor, dep);
        vm.startPrank(depositor);
        asset.approve(address(facility), dep);
        facility.deposit(dep);
        assertEq(facility.deposits(depositor), dep);
        facility.withdraw(wit);
        assertEq(facility.deposits(depositor), dep - wit);
        vm.stopPrank();

        assertEq(asset.balanceOf(address(facility)), dep - wit);
    }

    function testDepositZeroReverts() public {
        vm.prank(depositor);
        vm.expectRevert("NFATFacility/amount-zero");
        facility.deposit(0);
    }

    function testWithdrawZeroReverts() public {
        vm.prank(depositor);
        vm.expectRevert("NFATFacility/amount-zero");
        facility.withdraw(0);
    }

    function testWithdrawInsufficientReverts() public {
        vm.prank(depositor);
        vm.expectRevert("NFATFacility/insufficient-pending");
        facility.withdraw(1);
    }

    // ── issue ───────────────────────────────────────────────────────────

    function testFuzz_Issue(uint96 depositAmount, uint96 claimAmount, uint256 tokenId) public {
        uint256 dep = bound(uint256(depositAmount), 1, 1_000_000e18);
        uint256 clm = bound(uint256(claimAmount), 0, dep);

        asset.mint(depositor, dep);
        vm.startPrank(depositor);
        asset.approve(address(facility), dep);
        facility.deposit(dep);
        vm.stopPrank();

        vm.prank(operator);
        facility.issue(depositor, clm, tokenId);

        assertEq(facility.deposits(depositor), dep - clm);
        assertEq(facility.ownerOf(tokenId), depositor);
        assertEq(asset.balanceOf(pau), clm);
    }

    function testIssueZeroAmount() public {
        vm.prank(operator);
        facility.issue(depositor, 0, 99);

        assertEq(facility.ownerOf(99), depositor);
        assertEq(facility.deposits(depositor), 0);
        assertEq(asset.balanceOf(facility.recipient()), 0);
    }

    function testIssueInsufficientReverts() public {
        vm.prank(operator);
        vm.expectRevert("NFATFacility/insufficient-pending");
        facility.issue(depositor, 1, 1);
    }

    function testIssueZeroDepositorReverts() public {
        vm.prank(operator);
        vm.expectRevert("NFATFacility/depositor-zero-address");
        facility.issue(address(0), 0, 1);
    }

    function testOperatorRoleRequired() public {
        vm.prank(address(0xF00D));
        vm.expectRevert("NFATFacility/not-operator");
        facility.issue(depositor, 0, 5);
    }

    // ── repay ───────────────────────────────────────────────────────────

    function testRepayByNonOperator() public {
        vm.prank(operator);
        facility.issue(depositor, 0, 42);

        address anyone = address(0xBEEF);
        uint256 amount = 50e18;
        asset.mint(anyone, amount);

        vm.startPrank(anyone);
        asset.approve(address(facility), amount);
        facility.repay(42, amount);
        vm.stopPrank();

        assertEq(facility.claimable(42), amount);
        assertEq(asset.balanceOf(address(facility)), amount);
    }

    function testRepayMissingTokenReverts() public {
        vm.expectRevert("NFATFacility/token-missing");
        facility.repay(123, 1);
    }

    function testRepayZeroReverts() public {
        vm.prank(operator);
        facility.issue(depositor, 0, 55);

        vm.expectRevert("NFATFacility/amount-zero");
        facility.repay(55, 0);
    }

    // ── claim ───────────────────────────────────────────────────────────

    function testFuzz_ClaimKeepsNFAT(uint96 depositAmount, uint96 claimAmount, uint96 redemptionAmount) public {
        uint256 dep = bound(uint256(depositAmount), 1, 1_000_000e18);
        uint256 clm = bound(uint256(claimAmount), 0, dep);
        uint256 redemption = bound(uint256(redemptionAmount), 1, 1_000_000e18);

        asset.mint(depositor, dep);
        asset.mint(operator, redemption);

        vm.startPrank(depositor);
        asset.approve(address(facility), dep);
        facility.deposit(dep);
        vm.stopPrank();

        vm.prank(operator);
        facility.issue(depositor, clm, 7);

        vm.startPrank(operator);
        asset.approve(address(facility), redemption);
        facility.repay(7, redemption);
        vm.stopPrank();

        vm.prank(depositor);
        facility.claim(7, redemption);

        assertEq(facility.ownerOf(7), depositor);
        assertEq(asset.balanceOf(depositor), redemption);
        assertEq(facility.claimable(7), 0);
        assertEq(asset.balanceOf(pau), clm);
    }

    function testClaimNotOwnerReverts() public {
        vm.prank(operator);
        facility.issue(depositor, 0, 77);

        vm.prank(address(0xBEEF));
        vm.expectRevert("NFATFacility/not-owner");
        facility.claim(77, 1);
    }

    function testClaimZeroAmountReverts() public {
        vm.prank(operator);
        facility.issue(depositor, 0, 78);

        vm.prank(depositor);
        vm.expectRevert("NFATFacility/amount-zero");
        facility.claim(78, 0);
    }

    function testClaimInsufficientReverts() public {
        vm.prank(operator);
        facility.issue(depositor, 0, 78);

        vm.prank(depositor);
        vm.expectRevert("NFATFacility/insufficient-claimable");
        facility.claim(78, 1);
    }

    // ── identity network ────────────────────────────────────────────────

    function testIdentityCheckEnforced() public {
        NFATFacility restricted = new NFATFacility("Test", address(asset), pau, address(identityNetwork), operator);

        // Deposit succeeds without membership (no deposit gating)
        asset.mint(depositor, 100e18);
        vm.startPrank(depositor);
        asset.approve(address(restricted), 100e18);
        restricted.deposit(10e18);
        vm.stopPrank();

        identityNetwork.setMember(depositor, true);

        vm.prank(operator);
        restricted.issue(depositor, 10e18, 100);

        // Transfer gated by identity network
        address receiver = address(0xBEEF);
        vm.prank(depositor);
        vm.expectRevert("NFATFacility/not-member");
        restricted.transferFrom(depositor, receiver, 100);

        identityNetwork.setMember(receiver, true);
        vm.prank(depositor);
        restricted.transferFrom(depositor, receiver, 100);
        assertEq(restricted.ownerOf(100), receiver);

        // Claim is gated by identity network
        uint256 repayAmount = 10e18;
        asset.mint(operator, repayAmount);
        vm.startPrank(operator);
        asset.approve(address(restricted), repayAmount);
        restricted.repay(100, repayAmount);
        vm.stopPrank();

        // Remove receiver from identity network — claim should revert
        identityNetwork.setMember(receiver, false);
        vm.prank(receiver);
        vm.expectRevert("NFATFacility/not-member");
        restricted.claim(100, repayAmount);

        // Re-add receiver — claim should succeed
        identityNetwork.setMember(receiver, true);
        vm.prank(receiver);
        restricted.claim(100, repayAmount);
        assertEq(asset.balanceOf(receiver), repayAmount);
    }

    function testClaimGatedByIdentityNetwork() public {
        NFATFacility restricted = new NFATFacility("Test", address(asset), pau, address(identityNetwork), operator);

        identityNetwork.setMember(depositor, true);

        // Issue an NFAT
        vm.prank(operator);
        restricted.issue(depositor, 0, 200);

        // Repay
        uint256 repayAmount = 50e18;
        asset.mint(operator, repayAmount);
        vm.startPrank(operator);
        asset.approve(address(restricted), repayAmount);
        restricted.repay(200, repayAmount);
        vm.stopPrank();

        // Depositor is a member — claim succeeds
        vm.prank(depositor);
        restricted.claim(200, 25e18);
        assertEq(asset.balanceOf(depositor), 25e18);

        // Remove depositor from identity network — claim reverts
        identityNetwork.setMember(depositor, false);
        vm.prank(depositor);
        vm.expectRevert("NFATFacility/not-member");
        restricted.claim(200, 25e18);

        // No identity network — claim succeeds without membership
        restricted.setIdentityNetwork(address(0));
        vm.prank(depositor);
        restricted.claim(200, 25e18);
        assertEq(asset.balanceOf(depositor), 50e18);
    }

    function testIdentityNetworkClearedAllowsAll() public {
        NFATFacility restricted = new NFATFacility("Test", address(asset), pau, address(identityNetwork), operator);

        restricted.setIdentityNetwork(address(0));

        vm.prank(operator);
        restricted.issue(depositor, 0, 1234);

        address receiver = address(0xBEEF);
        vm.prank(depositor);
        restricted.transferFrom(depositor, receiver, 1234);
        assertEq(restricted.ownerOf(1234), receiver);
    }

    function testNoIdentityNetworkAllowsTransfer() public {
        vm.prank(operator);
        facility.issue(depositor, 0, 1234);

        address receiver = address(0xBEEF);
        vm.prank(depositor);
        facility.transferFrom(depositor, receiver, 1234);
        assertEq(facility.ownerOf(1234), receiver);
    }

    function testSetIdentityNetworkRequiresAuth() public {
        vm.prank(address(0xF00D));
        vm.expectRevert("NFATFacility/not-authorized");
        facility.setIdentityNetwork(address(identityNetwork));
    }

    // ── setRecipient ────────────────────────────────────────────────────

    function testSetRecipient() public {
        address newRecipient = address(0xBEEF);

        vm.expectEmit(true, false, false, false);
        emit NFATFacility.SetRecipient(newRecipient);

        facility.setRecipient(newRecipient);

        assertEq(facility.recipient(), newRecipient);
    }

    function testSetRecipientRoleRequired() public {
        vm.prank(address(0xF00D));
        vm.expectRevert("NFATFacility/not-authorized");
        facility.setRecipient(address(0xBEEF));
    }

    function testSetRecipientZeroAddressReverts() public {
        vm.expectRevert("NFATFacility/recipient-zero-address");
        facility.setRecipient(address(0));
    }

    function testFuzz_SetRecipientIssueUsesNewRecipient(uint96 depositAmount) public {
        uint256 dep = bound(uint256(depositAmount), 1, 1_000_000e18);
        address newRecipient = address(0xBEEF);

        facility.setRecipient(newRecipient);

        asset.mint(depositor, dep);
        vm.startPrank(depositor);
        asset.approve(address(facility), dep);
        facility.deposit(dep);
        vm.stopPrank();

        vm.prank(operator);
        facility.issue(depositor, dep, 1);

        assertEq(asset.balanceOf(newRecipient), dep);
        assertEq(asset.balanceOf(pau), 0);
    }

    // ── rescue ──────────────────────────────────────────────────────────────

    function testRescueRequiresAuth() public {
        vm.prank(address(0xF00D));
        vm.expectRevert("NFATFacility/not-authorized");
        facility.rescue(address(asset), address(0xBEEF), 1);
    }

    function testRescue() public {
        asset.mint(address(facility), 10e18);
        facility.rescue(address(asset), depositor, 10e18);
        assertEq(asset.balanceOf(depositor), 10e18);
    }

    function testRescueToZeroReverts() public {
        vm.expectRevert("NFATFacility/to-zero-address");
        facility.rescue(address(asset), address(0), 1);
    }

    // ── rescueDeposit ─────────────────────────────────────────────────────

    function testRescueDeposit() public {
        uint256 amount = 50e18;
        asset.mint(depositor, amount);
        vm.startPrank(depositor);
        asset.approve(address(facility), amount);
        facility.deposit(amount);
        vm.stopPrank();

        address recv = address(0xBEEF);
        facility.rescueDeposit(depositor, recv, 30e18);

        assertEq(facility.deposits(depositor), 20e18);
        assertEq(asset.balanceOf(recv), 30e18);
    }

    function testFuzz_RescueDeposit(uint96 depositAmt, uint96 withdrawAmt) public {
        uint256 dep = bound(uint256(depositAmt), 1, 1_000_000e18);
        uint256 wit = bound(uint256(withdrawAmt), 1, dep);

        asset.mint(depositor, dep);
        vm.startPrank(depositor);
        asset.approve(address(facility), dep);
        facility.deposit(dep);
        vm.stopPrank();

        address recv = address(0xBEEF);
        facility.rescueDeposit(depositor, recv, wit);

        assertEq(facility.deposits(depositor), dep - wit);
        assertEq(asset.balanceOf(recv), wit);
    }

    function testRescueDepositRequiresAuth() public {
        vm.prank(address(0xF00D));
        vm.expectRevert("NFATFacility/not-authorized");
        facility.rescueDeposit(depositor, address(0xBEEF), 1);
    }

    function testRescueDepositInsufficientReverts() public {
        vm.expectRevert("NFATFacility/insufficient-pending");
        facility.rescueDeposit(depositor, address(0xBEEF), 1);
    }

    function testRescueDepositToZeroReverts() public {
        vm.expectRevert("NFATFacility/to-zero-address");
        facility.rescueDeposit(depositor, address(0), 1);
    }

    function testRescueDepositZeroAmountReverts() public {
        vm.expectRevert("NFATFacility/amount-zero");
        facility.rescueDeposit(depositor, address(0xBEEF), 0);
    }

    // ── rescueRepayment ──────────────────────────────────────────────────

    function testRescueRepayment() public {
        vm.prank(operator);
        facility.issue(depositor, 0, 1);

        uint256 repayAmount = 100e18;
        asset.mint(operator, repayAmount);
        vm.startPrank(operator);
        asset.approve(address(facility), repayAmount);
        facility.repay(1, repayAmount);
        vm.stopPrank();

        address recv = address(0xBEEF);
        facility.rescueRepayment(1, recv, 40e18);

        assertEq(facility.claimable(1), 60e18);
        assertEq(asset.balanceOf(recv), 40e18);
    }

    function testFuzz_RescueRepayment(uint96 repayAmt, uint96 withdrawAmt) public {
        uint256 repay_ = bound(uint256(repayAmt), 1, 1_000_000e18);
        uint256 withdraw_ = bound(uint256(withdrawAmt), 1, repay_);

        vm.prank(operator);
        facility.issue(depositor, 0, 1);

        asset.mint(operator, repay_);
        vm.startPrank(operator);
        asset.approve(address(facility), repay_);
        facility.repay(1, repay_);
        vm.stopPrank();

        address recv = address(0xBEEF);
        facility.rescueRepayment(1, recv, withdraw_);

        assertEq(facility.claimable(1), repay_ - withdraw_);
        assertEq(asset.balanceOf(recv), withdraw_);
    }

    function testRescueRepaymentRequiresAuth() public {
        vm.prank(address(0xF00D));
        vm.expectRevert("NFATFacility/not-authorized");
        facility.rescueRepayment(1, address(0xBEEF), 1);
    }

    function testRescueRepaymentInsufficientReverts() public {
        vm.prank(operator);
        facility.issue(depositor, 0, 1);

        vm.expectRevert("NFATFacility/insufficient-claimable");
        facility.rescueRepayment(1, address(0xBEEF), 1);
    }

    function testRescueRepaymentToZeroReverts() public {
        vm.expectRevert("NFATFacility/to-zero-address");
        facility.rescueRepayment(1, address(0), 1);
    }

    function testRescueRepaymentZeroAmountReverts() public {
        vm.expectRevert("NFATFacility/amount-zero");
        facility.rescueRepayment(1, address(0xBEEF), 0);
    }

    // ── supportsInterface ───────────────────────────────────────────────

    function testSupportsInterface() public view {
        assertTrue(facility.supportsInterface(type(IERC721).interfaceId));
        assertTrue(facility.supportsInterface(type(IERC721Metadata).interfaceId));
        assertFalse(facility.supportsInterface(0xffffffff));
    }

    // ── constructor ─────────────────────────────────────────────────────

    function testConstructorRejectsZeroAddresses() public {
        vm.expectRevert("NFATFacility/asset-zero-address");
        new NFATFacility("Test", address(0), pau, address(0), operator);

        vm.expectRevert("NFATFacility/recipient-zero-address");
        new NFATFacility("Test", address(asset), address(0), address(0), operator);
    }

    function testConstructorAllowsZeroOperator() public {
        NFATFacility f = new NFATFacility("Test", address(asset), pau, address(0), address(0));
        assertEq(f.can(address(0)), 0);
    }

    function testDeployerIsWarded() public view {
        assertEq(facility.wards(address(this)), 1);
    }
}
