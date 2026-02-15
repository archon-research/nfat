// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import {AccessControl} from "openzeppelin-contracts/contracts/access/AccessControl.sol";
import {ERC721} from "openzeppelin-contracts/contracts/token/ERC721/ERC721.sol";
import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
import {Pausable} from "openzeppelin-contracts/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";
import {IIdentityNetwork} from "./interfaces/IIdentityNetwork.sol";

contract NFATFacility is ERC721, AccessControl, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant ROLE_OPERATOR = keccak256("OPERATOR");
    bytes32 public constant ROLE_PAUSE = keccak256("PAUSE");

    struct NFATData {
        uint48 mintedAt;
        address depositor;
        uint256 principal;
    }

    IERC20 public immutable asset;
    address public recipient; // NFAT PAU (ALM Proxy)

    IIdentityNetwork public identityNetwork;

    mapping(address => uint256) public deposits;
    mapping(uint256 => uint256) public claimable;
    mapping(uint256 => NFATData) public nfatData;

    event FacilityCreated(address indexed asset, address indexed recipient, address indexed admin, address operator);
    event Deposited(address indexed depositor, uint256 amount);
    event Withdrawn(address indexed depositor, uint256 amount);
    event Issued(address indexed depositor, uint256 amount, uint256 indexed tokenId);
    event Funded(uint256 indexed tokenId, address indexed funder, uint256 amount);
    event Claimed(uint256 indexed tokenId, address indexed claimer, uint256 amount);
    event RecipientUpdated(address indexed recipient);
    event IdentityNetworkUpdated(address indexed manager);
    event Rescued(address indexed token, address indexed to, uint256 amount);
    event RescuedDeposit(address indexed depositor, address indexed to, uint256 amount);
    event RescuedFunding(uint256 indexed tokenId, address indexed to, uint256 amount);

    constructor(
        string memory name_,
        address admin,
        address asset_,
        address recipient_,
        address identityNetwork_,
        address operator
    ) ERC721(string.concat("NFAT-", name_), string.concat("NFAT-", name_)) {
        require(admin != address(0), "NFATFacility/admin-zero-address");
        require(asset_ != address(0), "NFATFacility/asset-zero-address");
        require(recipient_ != address(0), "NFATFacility/recipient-zero-address");
        require(operator != address(0), "NFATFacility/operator-zero-address");

        asset = IERC20(asset_);
        recipient = recipient_;
        identityNetwork = IIdentityNetwork(identityNetwork_);

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ROLE_OPERATOR, operator);

        emit FacilityCreated(asset_, recipient_, admin, operator);
    }

    /// @notice Deposit asset into the facility queue.
    function deposit(uint256 amount) external nonReentrant whenNotPaused {
        require(amount > 0, "NFATFacility/amount-zero");
        _requireMember(msg.sender);

        asset.safeTransferFrom(msg.sender, address(this), amount);
        deposits[msg.sender] += amount;

        emit Deposited(msg.sender, amount);
    }

    /// @notice Withdraw queued assets before they are claimed.
    function withdraw(uint256 amount) external nonReentrant {
        require(amount > 0, "NFATFacility/amount-zero");

        uint256 pending = deposits[msg.sender];
        require(pending >= amount, "NFATFacility/insufficient-pending");
        deposits[msg.sender] = pending - amount;

        asset.safeTransfer(msg.sender, amount);
        emit Withdrawn(msg.sender, amount);
    }

    /// @notice Issue an NFAT: claim funds from a depositor's queue and mint an NFAT.
    /// @dev Only callable by the facility operator. Amount may be zero.
    function issue(address depositor, uint256 amount, uint256 tokenId) external nonReentrant whenNotPaused onlyRole(ROLE_OPERATOR) {
        require(depositor != address(0), "NFATFacility/depositor-zero-address");

        if (amount > 0) {
            uint256 pending = deposits[depositor];
            require(pending >= amount, "NFATFacility/insufficient-pending");
            deposits[depositor] = pending - amount;
            asset.safeTransfer(recipient, amount);
        }

        _mint(depositor, tokenId);
        nfatData[tokenId] = NFATData(uint48(block.timestamp), depositor, amount);

        emit Issued(depositor, amount, tokenId);
    }

    /// @notice Fund an NFAT for the holder to claim.
    /// @dev Payments accumulate until the holder claims.
    function fund(uint256 tokenId, uint256 amount) external nonReentrant whenNotPaused {
        require(amount > 0, "NFATFacility/amount-zero");
        require(_ownerOf(tokenId) != address(0), "NFATFacility/token-missing");

        asset.safeTransferFrom(msg.sender, address(this), amount);
        claimable[tokenId] += amount;

        emit Funded(tokenId, msg.sender, amount);
    }

    /// @notice Claim funded amounts for an NFAT.
    function claim(uint256 tokenId, uint256 amount) external nonReentrant whenNotPaused {
        require(ownerOf(tokenId) == msg.sender, "NFATFacility/not-owner");
        require(amount > 0, "NFATFacility/amount-zero");

        uint256 available = claimable[tokenId];
        require(available >= amount, "NFATFacility/insufficient-claimable");
        claimable[tokenId] = available - amount;

        asset.safeTransfer(msg.sender, amount);

        emit Claimed(tokenId, msg.sender, amount);
    }

    /// @notice Rescue any ERC-20 token held by the facility.
    function rescue(address token, address to, uint256 amount)
        external
        nonReentrant
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        require(to != address(0), "NFATFacility/to-zero-address");
        IERC20(token).safeTransfer(to, amount);
        emit Rescued(token, to, amount);
    }

    /// @notice Rescue from deposit queue with accounting.
    function rescueDeposit(address depositor, address to, uint256 amount)
        external
        nonReentrant
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        require(to != address(0), "NFATFacility/to-zero-address");
        require(amount > 0, "NFATFacility/amount-zero");

        uint256 pending = deposits[depositor];
        require(pending >= amount, "NFATFacility/insufficient-pending");
        deposits[depositor] = pending - amount;

        asset.safeTransfer(to, amount);
        emit RescuedDeposit(depositor, to, amount);
    }

    /// @notice Rescue from claimable balance with accounting.
    function rescueFunding(uint256 tokenId, address to, uint256 amount)
        external
        nonReentrant
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        require(to != address(0), "NFATFacility/to-zero-address");
        require(amount > 0, "NFATFacility/amount-zero");

        uint256 available = claimable[tokenId];
        require(available >= amount, "NFATFacility/insufficient-claimable");
        claimable[tokenId] = available - amount;

        asset.safeTransfer(to, amount);
        emit RescuedFunding(tokenId, to, amount);
    }

    /// @notice Pause deposit, issue, fund, and claim.
    function pause() external onlyRole(ROLE_PAUSE) {
        _pause();
    }

    /// @notice Unpause deposit, issue, fund, and claim.
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    /// @notice Update the recipient address (NFAT PAU (ALMProxy)).
    function setRecipient(address recipient_) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(recipient_ != address(0), "NFATFacility/recipient-zero-address");
        recipient = recipient_;
        emit RecipientUpdated(recipient_);
    }

    /// @notice Set or clear the identity network. Pass address(0) to disable identity checks.
    function setIdentityNetwork(address manager) external onlyRole(DEFAULT_ADMIN_ROLE) {
        identityNetwork = IIdentityNetwork(manager);
        emit IdentityNetworkUpdated(manager);
    }

    function _requireMember(address account) internal view {
        if (address(identityNetwork) == address(0)) {
            return;
        }
        require(identityNetwork.isMember(account), "NFATFacility/not-member");
    }

    function _update(address to, uint256 tokenId, address auth) internal override returns (address from) {
        if (to != address(0)) {
            _requireMember(to);
        }
        return super._update(to, tokenId, auth);
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC721, AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
