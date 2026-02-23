// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import "forge-std/Test.sol";

import {ERC20} from "openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
import {IAccessControl} from "openzeppelin-contracts/contracts/access/IAccessControl.sol";
import {IERC721} from "openzeppelin-contracts/contracts/token/ERC721/IERC721.sol";
import {IERC721Metadata} from "openzeppelin-contracts/contracts/token/ERC721/extensions/IERC721Metadata.sol";
import {Pausable} from "openzeppelin-contracts/contracts/utils/Pausable.sol";
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

    address private admin = address(0xAD);
    address private operator = address(0xB0B);
    address private pau = address(0xD00D);
    address private depositor = address(0xE11E);

    function setUp() public {
        asset = new MockERC20();
        identityNetwork = new MockIdentityNetwork();
        facility = new NFATFacility("Test", admin, address(asset), pau, address(0), operator);
        bytes32 pauseRole = facility.ROLE_PAUSE();
        vm.prank(admin);
        facility.grantRole(pauseRole, admin);
    }

    function testFuzz_DepositWithdraw(uint96 depositAmount, uint96 withdrawAmount) public {
        uint256 deposit = bound(uint256(depositAmount), 1, 1_000_000e18);
        uint256 withdraw = bound(uint256(withdrawAmount), 1, deposit);

        asset.mint(depositor, deposit);
        vm.startPrank(depositor);
        asset.approve(address(facility), deposit);
        facility.deposit(deposit);
        assertEq(facility.deposits(depositor), deposit);
        facility.withdraw(withdraw);
        assertEq(facility.deposits(depositor), deposit - withdraw);
        vm.stopPrank();

        assertEq(asset.balanceOf(address(facility)), deposit - withdraw);
    }

    function testFuzz_Issue(uint96 depositAmount, uint96 claimAmount, uint256 tokenId) public {
        uint256 deposit = bound(uint256(depositAmount), 1, 1_000_000e18);
        uint256 claim = bound(uint256(claimAmount), 0, deposit);

        asset.mint(depositor, deposit);
        vm.startPrank(depositor);
        asset.approve(address(facility), deposit);
        facility.deposit(deposit);
        vm.stopPrank();

        vm.prank(operator);
        facility.issue(depositor, claim, tokenId);

        assertEq(facility.deposits(depositor), deposit - claim);
        assertEq(facility.ownerOf(tokenId), depositor);

        assertEq(asset.balanceOf(pau), claim);
    }

    function testFuzz_ClaimKeepsNFAT(uint96 depositAmount, uint96 claimAmount, uint96 redemptionAmount) public {
        uint256 deposit = bound(uint256(depositAmount), 1, 1_000_000e18);
        uint256 claim = bound(uint256(claimAmount), 0, deposit);
        uint256 redemption = bound(uint256(redemptionAmount), 1, 1_000_000e18);

        asset.mint(depositor, deposit);
        asset.mint(operator, redemption);

        vm.startPrank(depositor);
        asset.approve(address(facility), deposit);
        facility.deposit(deposit);
        vm.stopPrank();

        vm.prank(operator);
        facility.issue(depositor, claim, 7);

        vm.startPrank(operator);
        asset.approve(address(facility), redemption);
        facility.repay(7, redemption);
        vm.stopPrank();

        vm.prank(depositor);
        facility.claim(7, operator, redemption);

        assertEq(facility.ownerOf(7), depositor);
        assertEq(asset.balanceOf(depositor), redemption);
        assertEq(facility.claimable(7, operator), 0);
        assertEq(asset.balanceOf(pau), claim);
    }

    function testIssueZeroAmount() public {
        vm.prank(operator);
        facility.issue(depositor, 0, 99);

        assertEq(facility.ownerOf(99), depositor);
        assertEq(facility.deposits(depositor), 0);
        assertEq(asset.balanceOf(facility.recipient()), 0);
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

        assertEq(facility.claimable(42, anyone), amount);
        assertEq(asset.balanceOf(address(facility)), amount);
    }

    function testClaimNotOwnerReverts() public {
        vm.prank(operator);
        facility.issue(depositor, 0, 77);

        vm.prank(address(0xBEEF));
        vm.expectRevert("NFATFacility/not-owner");
        facility.claim(77, address(0), 1);
    }

    function testClaimZeroAmountReverts() public {
        vm.prank(operator);
        facility.issue(depositor, 0, 78);

        vm.prank(depositor);
        vm.expectRevert("NFATFacility/amount-zero");
        facility.claim(78, address(0), 0);
    }

    function testClaimInsufficientReverts() public {
        vm.prank(operator);
        facility.issue(depositor, 0, 78);

        vm.prank(depositor);
        vm.expectRevert("NFATFacility/insufficient-claimable");
        facility.claim(78, address(0), 1);
    }

    function testIdentityCheckEnforced() public {
        NFATFacility restricted =
            new NFATFacility("Test", admin, address(asset), pau, address(identityNetwork), operator);

        // Deposit is not gated by identity network
        asset.mint(depositor, 100e18);
        vm.startPrank(depositor);
        asset.approve(address(restricted), 100e18);
        restricted.deposit(10e18);
        vm.stopPrank();

        identityNetwork.setMember(depositor, true);

        vm.prank(operator);
        restricted.issue(depositor, 10e18, 100);

        // Transfer is gated by identity network
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
        restricted.claim(100, operator, repayAmount);

        // Re-add receiver — claim should succeed
        identityNetwork.setMember(receiver, true);
        vm.prank(receiver);
        restricted.claim(100, operator, repayAmount);
        assertEq(asset.balanceOf(receiver), repayAmount);
    }

    function testClaimGatedByIdentityNetwork() public {
        NFATFacility restricted =
            new NFATFacility("Test", admin, address(asset), pau, address(identityNetwork), operator);

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
        restricted.claim(200, operator, 25e18);
        assertEq(asset.balanceOf(depositor), 25e18);

        // Remove depositor from identity network — claim reverts
        identityNetwork.setMember(depositor, false);
        vm.prank(depositor);
        vm.expectRevert("NFATFacility/not-member");
        restricted.claim(200, operator, 25e18);

        // No identity network — claim succeeds without membership
        vm.prank(admin);
        restricted.setIdentityNetwork(address(0));
        vm.prank(depositor);
        restricted.claim(200, operator, 25e18);
        assertEq(asset.balanceOf(depositor), 50e18);
    }

    function testIdentityNetworkClearedAllowsAll() public {
        NFATFacility restricted =
            new NFATFacility("Test", admin, address(asset), pau, address(identityNetwork), operator);

        vm.prank(admin);
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

    function testSetIdentityNetworkRequiresAdmin() public {
        bytes32 role = facility.DEFAULT_ADMIN_ROLE();
        vm.prank(address(0xF00D));
        vm.expectRevert(
            abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, address(0xF00D), role)
        );
        facility.setIdentityNetwork(address(identityNetwork));
    }

    function testOperatorRoleRequired() public {
        bytes32 role = facility.ROLE_OPERATOR();
        vm.prank(address(0xF00D));
        vm.expectRevert(
            abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, address(0xF00D), role)
        );
        facility.issue(depositor, 0, 5);
    }

    function testRescueRequiresAdmin() public {
        bytes32 role = facility.DEFAULT_ADMIN_ROLE();
        vm.prank(address(0xF00D));
        vm.expectRevert(
            abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, address(0xF00D), role)
        );
        facility.rescue(address(asset), address(0xBEEF), 1);
    }

    function testRescue() public {
        asset.mint(address(facility), 10e18);
        vm.prank(admin);
        facility.rescue(address(asset), depositor, 10e18);
        assertEq(asset.balanceOf(depositor), 10e18);
    }

    function testRescueToZeroReverts() public {
        vm.prank(admin);
        vm.expectRevert("NFATFacility/to-zero-address");
        facility.rescue(address(asset), address(0), 1);
    }

    function testSupportsInterface() public {
        assertTrue(facility.supportsInterface(type(IAccessControl).interfaceId));
        assertTrue(facility.supportsInterface(type(IERC721).interfaceId));
        assertTrue(facility.supportsInterface(type(IERC721Metadata).interfaceId));
        assertFalse(facility.supportsInterface(0xffffffff));
    }

    function testConstructorRejectsZeroAddresses() public {
        vm.expectRevert("NFATFacility/admin-zero-address");
        new NFATFacility("Test", address(0), address(asset), pau, address(0), operator);

        vm.expectRevert("NFATFacility/asset-zero-address");
        new NFATFacility("Test", admin, address(0), pau, address(0), operator);

        vm.expectRevert("NFATFacility/recipient-zero-address");
        new NFATFacility("Test", admin, address(asset), address(0), address(0), operator);

        vm.expectRevert("NFATFacility/operator-zero-address");
        new NFATFacility("Test", admin, address(asset), pau, address(0), address(0));
    }

    function testSetRecipient() public {
        address newRecipient = address(0xBEEF);

        vm.expectEmit(true, false, false, false);
        emit NFATFacility.RecipientUpdated(newRecipient);

        vm.prank(admin);
        facility.setRecipient(newRecipient);

        assertEq(facility.recipient(), newRecipient);
    }

    function testSetRecipientRoleRequired() public {
        bytes32 role = facility.DEFAULT_ADMIN_ROLE();
        vm.prank(address(0xF00D));
        vm.expectRevert(
            abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, address(0xF00D), role)
        );
        facility.setRecipient(address(0xBEEF));
    }

    function testSetRecipientZeroAddressReverts() public {
        vm.prank(admin);
        vm.expectRevert("NFATFacility/recipient-zero-address");
        facility.setRecipient(address(0));
    }

    // ── rescueDeposit ─────────────────────────────────────────────────────

    function testRescueDeposit() public {
        uint256 amount = 50e18;
        asset.mint(depositor, amount);
        vm.startPrank(depositor);
        asset.approve(address(facility), amount);
        facility.deposit(amount);
        vm.stopPrank();

        address recipient = address(0xBEEF);
        vm.prank(admin);
        facility.rescueDeposit(depositor, recipient, 30e18);

        assertEq(facility.deposits(depositor), 20e18);
        assertEq(asset.balanceOf(recipient), 30e18);
    }

    function testFuzz_RescueDeposit(uint96 depositAmt, uint96 withdrawAmt) public {
        uint256 deposit = bound(uint256(depositAmt), 1, 1_000_000e18);
        uint256 withdraw = bound(uint256(withdrawAmt), 1, deposit);

        asset.mint(depositor, deposit);
        vm.startPrank(depositor);
        asset.approve(address(facility), deposit);
        facility.deposit(deposit);
        vm.stopPrank();

        address recipient = address(0xBEEF);
        vm.prank(admin);
        facility.rescueDeposit(depositor, recipient, withdraw);

        assertEq(facility.deposits(depositor), deposit - withdraw);
        assertEq(asset.balanceOf(recipient), withdraw);
    }

    function testRescueDepositRequiresAdmin() public {
        bytes32 role = facility.DEFAULT_ADMIN_ROLE();
        vm.prank(address(0xF00D));
        vm.expectRevert(
            abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, address(0xF00D), role)
        );
        facility.rescueDeposit(depositor, address(0xBEEF), 1);
    }

    function testRescueDepositInsufficientReverts() public {
        vm.prank(admin);
        vm.expectRevert("NFATFacility/insufficient-pending");
        facility.rescueDeposit(depositor, address(0xBEEF), 1);
    }

    function testRescueDepositToZeroReverts() public {
        vm.prank(admin);
        vm.expectRevert("NFATFacility/to-zero-address");
        facility.rescueDeposit(depositor, address(0), 1);
    }

    function testRescueDepositZeroAmountReverts() public {
        vm.prank(admin);
        vm.expectRevert("NFATFacility/amount-zero");
        facility.rescueDeposit(depositor, address(0xBEEF), 0);
    }

    // ── rescueRepayment ─────────────────────────────────────────────────

    function testRescueRepayment() public {
        vm.prank(operator);
        facility.issue(depositor, 0, 1);

        uint256 repayAmount = 100e18;
        asset.mint(operator, repayAmount);
        vm.startPrank(operator);
        asset.approve(address(facility), repayAmount);
        facility.repay(1, repayAmount);
        vm.stopPrank();

        address recipient = address(0xBEEF);
        vm.prank(admin);
        facility.rescueRepayment(1, operator, recipient, 40e18);

        assertEq(facility.claimable(1, operator), 60e18);
        assertEq(asset.balanceOf(recipient), 40e18);
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

        address recipient = address(0xBEEF);
        vm.prank(admin);
        facility.rescueRepayment(1, operator, recipient, withdraw_);

        assertEq(facility.claimable(1, operator), repay_ - withdraw_);
        assertEq(asset.balanceOf(recipient), withdraw_);
    }

    function testRescueRepaymentRequiresAdmin() public {
        bytes32 role = facility.DEFAULT_ADMIN_ROLE();
        vm.prank(address(0xF00D));
        vm.expectRevert(
            abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, address(0xF00D), role)
        );
        facility.rescueRepayment(1, address(0), address(0xBEEF), 1);
    }

    function testRescueRepaymentInsufficientReverts() public {
        vm.prank(operator);
        facility.issue(depositor, 0, 1);

        vm.prank(admin);
        vm.expectRevert("NFATFacility/insufficient-claimable");
        facility.rescueRepayment(1, operator, address(0xBEEF), 1);
    }

    function testRescueRepaymentToZeroReverts() public {
        vm.prank(admin);
        vm.expectRevert("NFATFacility/to-zero-address");
        facility.rescueRepayment(1, address(0), address(0), 1);
    }

    function testRescueRepaymentZeroAmountReverts() public {
        vm.prank(admin);
        vm.expectRevert("NFATFacility/amount-zero");
        facility.rescueRepayment(1, address(0), address(0xBEEF), 0);
    }

    // ── pause / unpause ───────────────────────────────────────────────────

    function testPauseRequiresPauseRole() public {
        bytes32 role = facility.ROLE_PAUSE();
        vm.prank(address(0xF00D));
        vm.expectRevert(
            abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, address(0xF00D), role)
        );
        facility.pause();
    }

    function testUnpauseRequiresAdmin() public {
        vm.prank(admin);
        facility.pause();

        bytes32 role = facility.DEFAULT_ADMIN_ROLE();
        vm.prank(address(0xF00D));
        vm.expectRevert(
            abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, address(0xF00D), role)
        );
        facility.unpause();
    }

    function testPauseBlocksDeposit() public {
        vm.prank(admin);
        facility.pause();

        asset.mint(depositor, 1e18);
        vm.startPrank(depositor);
        asset.approve(address(facility), 1e18);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        facility.deposit(1e18);
        vm.stopPrank();
    }

    function testPauseBlocksIssue() public {
        vm.prank(admin);
        facility.pause();

        vm.prank(operator);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        facility.issue(depositor, 0, 1);
    }

    function testPauseBlocksRepay() public {
        vm.prank(operator);
        facility.issue(depositor, 0, 42);

        vm.prank(admin);
        facility.pause();

        asset.mint(depositor, 1e18);
        vm.startPrank(depositor);
        asset.approve(address(facility), 1e18);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        facility.repay(42, 1e18);
        vm.stopPrank();
    }

    function testPauseBlocksClaim() public {
        vm.prank(operator);
        facility.issue(depositor, 0, 42);

        asset.mint(address(this), 1e18);
        asset.approve(address(facility), 1e18);
        facility.repay(42, 1e18);

        vm.prank(admin);
        facility.pause();

        vm.prank(depositor);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        facility.claim(42, address(this), 1e18);
    }

    function testPauseAllowsWithdraw() public {
        asset.mint(depositor, 1e18);
        vm.startPrank(depositor);
        asset.approve(address(facility), 1e18);
        facility.deposit(1e18);
        vm.stopPrank();

        vm.prank(admin);
        facility.pause();

        vm.prank(depositor);
        facility.withdraw(1e18);
        assertEq(asset.balanceOf(depositor), 1e18);
    }

    function testUnpauseResumesOperations() public {
        vm.prank(admin);
        facility.pause();

        vm.prank(admin);
        facility.unpause();

        asset.mint(depositor, 1e18);
        vm.startPrank(depositor);
        asset.approve(address(facility), 1e18);
        facility.deposit(1e18);
        vm.stopPrank();

        assertEq(facility.deposits(depositor), 1e18);
    }

    // ── retract ───────────────────────────────────────────────────────────

    function testRetract() public {
        vm.prank(operator);
        facility.issue(depositor, 0, 1);

        uint256 repayAmount = 100e18;
        asset.mint(operator, repayAmount);
        vm.startPrank(operator);
        asset.approve(address(facility), repayAmount);
        facility.repay(1, repayAmount);
        facility.retract(1, 40e18);
        vm.stopPrank();

        assertEq(facility.claimable(1, operator), 60e18);
        assertEq(asset.balanceOf(operator), 40e18);
    }

    function testFuzz_Retract(uint96 repayAmt, uint96 retractAmt) public {
        uint256 repay_ = bound(uint256(repayAmt), 1, 1_000_000e18);
        uint256 retract_ = bound(uint256(retractAmt), 1, repay_);

        vm.prank(operator);
        facility.issue(depositor, 0, 1);

        asset.mint(operator, repay_);
        vm.startPrank(operator);
        asset.approve(address(facility), repay_);
        facility.repay(1, repay_);
        facility.retract(1, retract_);
        vm.stopPrank();

        assertEq(facility.claimable(1, operator), repay_ - retract_);
        assertEq(asset.balanceOf(operator), retract_);
    }

    function testRetractNonRepayerReverts() public {
        vm.prank(operator);
        facility.issue(depositor, 0, 1);

        uint256 repayAmount = 50e18;
        asset.mint(operator, repayAmount);
        vm.startPrank(operator);
        asset.approve(address(facility), repayAmount);
        facility.repay(1, repayAmount);
        vm.stopPrank();

        vm.prank(address(0xBEEF));
        vm.expectRevert("NFATFacility/insufficient-claimable");
        facility.retract(1, 1);
    }

    function testRetractZeroAmountReverts() public {
        vm.expectRevert("NFATFacility/amount-zero");
        facility.retract(1, 0);
    }

    function testRetractInsufficientReverts() public {
        vm.prank(operator);
        facility.issue(depositor, 0, 1);

        uint256 repayAmount = 10e18;
        asset.mint(operator, repayAmount);
        vm.startPrank(operator);
        asset.approve(address(facility), repayAmount);
        facility.repay(1, repayAmount);
        vm.stopPrank();

        vm.prank(operator);
        vm.expectRevert("NFATFacility/insufficient-claimable");
        facility.retract(1, repayAmount + 1);
    }

    function testRetractAfterClaimReducesClaimable() public {
        vm.prank(operator);
        facility.issue(depositor, 0, 1);

        uint256 repayAmount = 100e18;
        asset.mint(operator, repayAmount);
        vm.startPrank(operator);
        asset.approve(address(facility), repayAmount);
        facility.repay(1, repayAmount);
        vm.stopPrank();

        // Owner claims half
        vm.prank(depositor);
        facility.claim(1, operator, 50e18);

        // Repayer retracts the other half
        vm.prank(operator);
        facility.retract(1, 50e18);

        assertEq(facility.claimable(1, operator), 0);
        assertEq(asset.balanceOf(depositor), 50e18);
        assertEq(asset.balanceOf(operator), 50e18);
    }

    function testRetractBlockedWhenPaused() public {
        vm.prank(operator);
        facility.issue(depositor, 0, 42);

        uint256 repayAmount = 10e18;
        asset.mint(operator, repayAmount);
        vm.startPrank(operator);
        asset.approve(address(facility), repayAmount);
        facility.repay(42, repayAmount);
        vm.stopPrank();

        vm.prank(admin);
        facility.pause();

        vm.prank(operator);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        facility.retract(42, repayAmount);
    }

    // ── setRecipient (fuzz) ─────────────────────────────────────────────

    function testFuzz_SetRecipientIssueUsesNewRecipient(uint96 depositAmount) public {
        uint256 deposit = bound(uint256(depositAmount), 1, 1_000_000e18);
        address newRecipient = address(0xBEEF);

        vm.prank(admin);
        facility.setRecipient(newRecipient);

        asset.mint(depositor, deposit);
        vm.startPrank(depositor);
        asset.approve(address(facility), deposit);
        facility.deposit(deposit);
        vm.stopPrank();

        vm.prank(operator);
        facility.issue(depositor, deposit, 1);

        assertEq(asset.balanceOf(newRecipient), deposit);
        assertEq(asset.balanceOf(pau), 0);
    }
}
