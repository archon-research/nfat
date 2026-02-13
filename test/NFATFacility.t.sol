// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import "forge-std/Test.sol";

import {ERC20} from "openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
import {IAccessControl} from "openzeppelin-contracts/contracts/access/IAccessControl.sol";
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

    address private admin = address(0xAD);
    address private operator = address(0xB0B);
    address private pau = address(0xD00D);
    address private depositor = address(0xE11E);

    function setUp() public {
        asset = new MockERC20();
        identityNetwork = new MockIdentityNetwork();
        facility = new NFATFacility("Test", admin, address(asset), pau, address(0), operator);
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

        (, address dataDepositor, uint256 principal) = facility.nfatData(tokenId);
        assertEq(dataDepositor, depositor);
        assertEq(principal, claim);

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
        facility.fund(7, redemption);
        vm.stopPrank();

        vm.prank(depositor);
        facility.claim(7, redemption);

        assertEq(facility.ownerOf(7), depositor);
        assertEq(asset.balanceOf(depositor), redemption);
        assertEq(facility.claimable(7), 0);
        assertEq(asset.balanceOf(pau), claim);
    }

    function testIssueZeroAmount() public {
        vm.prank(operator);
        facility.issue(depositor, 0, 99);

        assertEq(facility.ownerOf(99), depositor);
        assertEq(facility.deposits(depositor), 0);
        assertEq(asset.balanceOf(pau), 0);

        (uint48 mintedAt, address dataDepositor, uint256 principal) = facility.nfatData(99);
        assertEq(dataDepositor, depositor);
        assertEq(principal, 0);
        assertTrue(mintedAt > 0);
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

    function testFundMissingTokenReverts() public {
        vm.expectRevert("NFATFacility/token-missing");
        facility.fund(123, 1);
    }

    function testFundZeroReverts() public {
        vm.prank(operator);
        facility.issue(depositor, 0, 55);

        vm.expectRevert("NFATFacility/amount-zero");
        facility.fund(55, 0);
    }

    function testFundByNonOperator() public {
        vm.prank(operator);
        facility.issue(depositor, 0, 42);

        address anyone = address(0xBEEF);
        uint256 amount = 50e18;
        asset.mint(anyone, amount);

        vm.startPrank(anyone);
        asset.approve(address(facility), amount);
        facility.fund(42, amount);
        vm.stopPrank();

        assertEq(facility.claimable(42), amount);
        assertEq(facility.funded(42, anyone), amount);
        assertEq(asset.balanceOf(address(facility)), amount);
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

    function testIdentityCheckEnforced() public {
        NFATFacility restricted =
            new NFATFacility("Test", admin, address(asset), pau, address(identityNetwork), operator);

        asset.mint(depositor, 100e18);
        vm.startPrank(depositor);
        asset.approve(address(restricted), 100e18);
        vm.expectRevert("NFATFacility/not-member");
        restricted.deposit(10e18);
        vm.stopPrank();

        identityNetwork.setMember(depositor, true);

        vm.startPrank(depositor);
        restricted.deposit(10e18);
        vm.stopPrank();

        vm.prank(operator);
        restricted.issue(depositor, 10e18, 100);

        address receiver = address(0xBEEF);
        vm.prank(depositor);
        vm.expectRevert("NFATFacility/not-member");
        restricted.transferFrom(depositor, receiver, 100);

        identityNetwork.setMember(receiver, true);
        vm.prank(depositor);
        restricted.transferFrom(depositor, receiver, 100);
        assertEq(restricted.ownerOf(100), receiver);
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

    function testEmergencyWithdrawRequiresAdmin() public {
        bytes32 role = facility.DEFAULT_ADMIN_ROLE();
        vm.prank(address(0xF00D));
        vm.expectRevert(
            abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, address(0xF00D), role)
        );
        facility.emergencyWithdraw(address(asset), address(0xBEEF), 1);
    }

    function testEmergencyWithdraw() public {
        asset.mint(address(facility), 10e18);
        vm.prank(admin);
        facility.emergencyWithdraw(address(asset), depositor, 10e18);
        assertEq(asset.balanceOf(depositor), 10e18);
    }

    function testEmergencyWithdrawToZeroReverts() public {
        vm.prank(admin);
        vm.expectRevert("NFATFacility/to-zero-address");
        facility.emergencyWithdraw(address(asset), address(0), 1);
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

        vm.expectRevert("NFATFacility/pau-zero-address");
        new NFATFacility("Test", admin, address(asset), address(0), address(0), operator);

        vm.expectRevert("NFATFacility/operator-zero-address");
        new NFATFacility("Test", admin, address(asset), pau, address(0), address(0));
    }

    function testSetPau() public {
        address newPau = address(0xBEEF);

        vm.expectEmit(true, false, false, false);
        emit NFATFacility.PauUpdated(newPau);

        vm.prank(admin);
        facility.setPau(newPau);

        assertEq(facility.pau(), newPau);
    }

    function testSetPauRoleRequired() public {
        bytes32 role = facility.DEFAULT_ADMIN_ROLE();
        vm.prank(address(0xF00D));
        vm.expectRevert(
            abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, address(0xF00D), role)
        );
        facility.setPau(address(0xBEEF));
    }

    function testSetPauZeroAddressReverts() public {
        vm.prank(admin);
        vm.expectRevert("NFATFacility/pau-zero-address");
        facility.setPau(address(0));
    }

    // ── defund ────────────────────────────────────────────────────────────

    function testDefund() public {
        vm.prank(operator);
        facility.issue(depositor, 0, 1);

        uint256 fundAmount = 100e18;
        asset.mint(operator, fundAmount);
        vm.startPrank(operator);
        asset.approve(address(facility), fundAmount);
        facility.fund(1, fundAmount);
        facility.defund(1, 40e18);
        vm.stopPrank();

        assertEq(facility.claimable(1), 60e18);
        assertEq(facility.funded(1, operator), 60e18);
        assertEq(asset.balanceOf(operator), 40e18);
    }

    function testFuzz_Defund(uint96 fundAmt, uint96 defundAmt) public {
        uint256 fund_ = bound(uint256(fundAmt), 1, 1_000_000e18);
        uint256 defund_ = bound(uint256(defundAmt), 1, fund_);

        vm.prank(operator);
        facility.issue(depositor, 0, 1);

        asset.mint(operator, fund_);
        vm.startPrank(operator);
        asset.approve(address(facility), fund_);
        facility.fund(1, fund_);
        facility.defund(1, defund_);
        vm.stopPrank();

        assertEq(facility.claimable(1), fund_ - defund_);
        assertEq(facility.funded(1, operator), fund_ - defund_);
        assertEq(asset.balanceOf(operator), defund_);
    }

    function testDefundNonFunderReverts() public {
        vm.prank(operator);
        facility.issue(depositor, 0, 1);

        uint256 fundAmount = 100e18;
        asset.mint(operator, fundAmount);
        vm.startPrank(operator);
        asset.approve(address(facility), fundAmount);
        facility.fund(1, fundAmount);
        vm.stopPrank();

        vm.prank(address(0xF00D));
        vm.expectRevert("NFATFacility/insufficient-funded");
        facility.defund(1, 1);
    }

    function testDefundZeroAmountReverts() public {
        vm.expectRevert("NFATFacility/amount-zero");
        facility.defund(1, 0);
    }

    function testDefundInsufficientFundedReverts() public {
        vm.prank(operator);
        facility.issue(depositor, 0, 1);

        uint256 fundAmount = 10e18;
        asset.mint(operator, fundAmount);
        vm.startPrank(operator);
        asset.approve(address(facility), fundAmount);
        facility.fund(1, fundAmount);
        vm.stopPrank();

        vm.prank(operator);
        vm.expectRevert("NFATFacility/insufficient-funded");
        facility.defund(1, 11e18);
    }

    function testDefundAfterClaimReducesClaimable() public {
        vm.prank(operator);
        facility.issue(depositor, 0, 1);

        uint256 fundAmount = 100e18;
        asset.mint(operator, fundAmount);
        vm.startPrank(operator);
        asset.approve(address(facility), fundAmount);
        facility.fund(1, fundAmount);
        vm.stopPrank();

        // Holder claims 60
        vm.prank(depositor);
        facility.claim(1, 60e18);

        // Funder can only defund up to remaining claimable (40)
        vm.prank(operator);
        vm.expectRevert("NFATFacility/insufficient-claimable");
        facility.defund(1, 50e18);

        vm.prank(operator);
        facility.defund(1, 40e18);
        assertEq(facility.claimable(1), 0);
        assertEq(facility.funded(1, operator), 60e18);
    }

    // ── emergencyWithdrawDeposit ─────────────────────────────────────────

    function testEmergencyWithdrawDeposit() public {
        uint256 amount = 50e18;
        asset.mint(depositor, amount);
        vm.startPrank(depositor);
        asset.approve(address(facility), amount);
        facility.deposit(amount);
        vm.stopPrank();

        address recipient = address(0xBEEF);
        vm.prank(admin);
        facility.emergencyWithdrawDeposit(depositor, recipient, 30e18);

        assertEq(facility.deposits(depositor), 20e18);
        assertEq(asset.balanceOf(recipient), 30e18);
    }

    function testFuzz_EmergencyWithdrawDeposit(uint96 depositAmt, uint96 withdrawAmt) public {
        uint256 deposit = bound(uint256(depositAmt), 1, 1_000_000e18);
        uint256 withdraw = bound(uint256(withdrawAmt), 1, deposit);

        asset.mint(depositor, deposit);
        vm.startPrank(depositor);
        asset.approve(address(facility), deposit);
        facility.deposit(deposit);
        vm.stopPrank();

        address recipient = address(0xBEEF);
        vm.prank(admin);
        facility.emergencyWithdrawDeposit(depositor, recipient, withdraw);

        assertEq(facility.deposits(depositor), deposit - withdraw);
        assertEq(asset.balanceOf(recipient), withdraw);
    }

    function testEmergencyWithdrawDepositRequiresAdmin() public {
        bytes32 role = facility.DEFAULT_ADMIN_ROLE();
        vm.prank(address(0xF00D));
        vm.expectRevert(
            abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, address(0xF00D), role)
        );
        facility.emergencyWithdrawDeposit(depositor, address(0xBEEF), 1);
    }

    function testEmergencyWithdrawDepositInsufficientReverts() public {
        vm.prank(admin);
        vm.expectRevert("NFATFacility/insufficient-pending");
        facility.emergencyWithdrawDeposit(depositor, address(0xBEEF), 1);
    }

    function testEmergencyWithdrawDepositToZeroReverts() public {
        vm.prank(admin);
        vm.expectRevert("NFATFacility/to-zero-address");
        facility.emergencyWithdrawDeposit(depositor, address(0), 1);
    }

    function testEmergencyWithdrawDepositZeroAmountReverts() public {
        vm.prank(admin);
        vm.expectRevert("NFATFacility/amount-zero");
        facility.emergencyWithdrawDeposit(depositor, address(0xBEEF), 0);
    }

    // ── emergencyWithdrawDefund ──────────────────────────────────────────

    function testEmergencyWithdrawDefund() public {
        vm.prank(operator);
        facility.issue(depositor, 0, 1);

        uint256 fundAmount = 100e18;
        asset.mint(operator, fundAmount);
        vm.startPrank(operator);
        asset.approve(address(facility), fundAmount);
        facility.fund(1, fundAmount);
        vm.stopPrank();

        address recipient = address(0xBEEF);
        vm.prank(admin);
        facility.emergencyWithdrawDefund(1, recipient, 40e18);

        assertEq(facility.claimable(1), 60e18);
        assertEq(asset.balanceOf(recipient), 40e18);
    }

    function testFuzz_EmergencyWithdrawDefund(uint96 fundAmt, uint96 withdrawAmt) public {
        uint256 fund_ = bound(uint256(fundAmt), 1, 1_000_000e18);
        uint256 withdraw_ = bound(uint256(withdrawAmt), 1, fund_);

        vm.prank(operator);
        facility.issue(depositor, 0, 1);

        asset.mint(operator, fund_);
        vm.startPrank(operator);
        asset.approve(address(facility), fund_);
        facility.fund(1, fund_);
        vm.stopPrank();

        address recipient = address(0xBEEF);
        vm.prank(admin);
        facility.emergencyWithdrawDefund(1, recipient, withdraw_);

        assertEq(facility.claimable(1), fund_ - withdraw_);
        assertEq(asset.balanceOf(recipient), withdraw_);
    }

    function testEmergencyWithdrawDefundRequiresAdmin() public {
        bytes32 role = facility.DEFAULT_ADMIN_ROLE();
        vm.prank(address(0xF00D));
        vm.expectRevert(
            abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, address(0xF00D), role)
        );
        facility.emergencyWithdrawDefund(1, address(0xBEEF), 1);
    }

    function testEmergencyWithdrawDefundInsufficientReverts() public {
        vm.prank(operator);
        facility.issue(depositor, 0, 1);

        vm.prank(admin);
        vm.expectRevert("NFATFacility/insufficient-claimable");
        facility.emergencyWithdrawDefund(1, address(0xBEEF), 1);
    }

    function testEmergencyWithdrawDefundToZeroReverts() public {
        vm.prank(admin);
        vm.expectRevert("NFATFacility/to-zero-address");
        facility.emergencyWithdrawDefund(1, address(0), 1);
    }

    function testEmergencyWithdrawDefundZeroAmountReverts() public {
        vm.prank(admin);
        vm.expectRevert("NFATFacility/amount-zero");
        facility.emergencyWithdrawDefund(1, address(0xBEEF), 0);
    }

    function testFuzz_SetPauIssueUsesNewPau(uint96 depositAmount) public {
        uint256 deposit = bound(uint256(depositAmount), 1, 1_000_000e18);
        address newPau = address(0xBEEF);

        vm.prank(admin);
        facility.setPau(newPau);

        asset.mint(depositor, deposit);
        vm.startPrank(depositor);
        asset.approve(address(facility), deposit);
        facility.deposit(deposit);
        vm.stopPrank();

        vm.prank(operator);
        facility.issue(depositor, deposit, 1);

        assertEq(asset.balanceOf(newPau), deposit);
        assertEq(asset.balanceOf(pau), 0);
    }
}
