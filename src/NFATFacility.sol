// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import {ERC721} from "openzeppelin-contracts/contracts/token/ERC721/ERC721.sol";

interface GemLike {
    function transfer(address, uint256) external returns (bool);
    function transferFrom(address, address, uint256) external returns (bool);
}

interface IdentityNetworkLike {
    function isMember(address account) external view returns (bool);
}

contract NFATFacility is ERC721 {
    // --- Storage variables ---

    mapping(address usr => uint256 allowed) public wards;
    mapping(address usr => uint256 allowed) public can;

    uint256 public stopped;

    address public recipient;
    IdentityNetworkLike public identityNetwork;

    mapping(address => uint256) public deposits;
    mapping(uint256 => uint256) public claimable;

    // --- Immutables ---

    GemLike public immutable asset;

    // --- Events ---

    event Rely(address indexed usr);
    event Deny(address indexed usr);
    event Hope(address indexed usr);
    event Nope(address indexed usr);
    event Stop();
    event Start();
    event Deposit(address indexed depositor, uint256 amount);
    event Withdraw(address indexed depositor, uint256 amount);
    event Issue(address indexed depositor, uint256 amount, uint256 indexed tokenId);
    event Repay(uint256 indexed tokenId, address indexed repayer, uint256 amount);
    event Claim(uint256 indexed tokenId, address indexed claimer, uint256 amount);
    event SetRecipient(address indexed recipient);
    event SetIdentityNetwork(address indexed identityNetwork);
    event Rescue(address indexed token, address indexed to, uint256 amount);
    event RescueDeposit(address indexed depositor, address indexed to, uint256 amount);
    event RescueRepayment(uint256 indexed tokenId, address indexed to, uint256 amount);

    // --- Modifiers ---

    modifier auth() {
        require(wards[msg.sender] == 1, "NFATFacility/not-authorized");
        _;
    }

    modifier operatorAuth() {
        require(can[msg.sender] == 1 || wards[msg.sender] == 1, "NFATFacility/not-operator");
        _;
    }

    modifier stoppable() {
        require(stopped == 0, "NFATFacility/stopped");
        _;
    }

    // --- Constructor ---

    constructor(string memory name_, address asset_, address recipient_, address identityNetwork_, address operator_)
        ERC721(name_, name_)
    {
        require(asset_ != address(0), "NFATFacility/asset-zero-address");
        require(recipient_ != address(0), "NFATFacility/recipient-zero-address");

        asset = GemLike(asset_);
        recipient = recipient_;
        identityNetwork = IdentityNetworkLike(identityNetwork_);

        wards[msg.sender] = 1;
        emit Rely(msg.sender);

        if (operator_ != address(0)) {
            can[operator_] = 1;
            emit Hope(operator_);
        }
    }

    // --- Internal functions ---

    function _requireMember(address account) internal view {
        if (address(identityNetwork) == address(0)) {
            return;
        }
        require(identityNetwork.isMember(account), "NFATFacility/not-member");
    }

    function _update(address to, uint256 tokenId, address authAddr) internal override returns (address from) {
        if (to != address(0)) {
            _requireMember(to);
        }
        return super._update(to, tokenId, authAddr);
    }

    // --- Admin functions ---

    function rely(address usr) external auth {
        wards[usr] = 1;
        emit Rely(usr);
    }

    function deny(address usr) external auth {
        wards[usr] = 0;
        emit Deny(usr);
    }

    function hope(address usr) external auth {
        can[usr] = 1;
        emit Hope(usr);
    }

    function nope(address usr) external auth {
        can[usr] = 0;
        emit Nope(usr);
    }

    function stop() external auth {
        stopped = 1;
        emit Stop();
    }

    function start() external auth {
        stopped = 0;
        emit Start();
    }

    function setRecipient(address recipient_) external auth {
        require(recipient_ != address(0), "NFATFacility/recipient-zero-address");
        recipient = recipient_;
        emit SetRecipient(recipient_);
    }

    function setIdentityNetwork(address identityNetwork_) external auth {
        identityNetwork = IdentityNetworkLike(identityNetwork_);
        emit SetIdentityNetwork(identityNetwork_);
    }

    function rescue(address token, address to, uint256 amount) external auth {
        require(to != address(0), "NFATFacility/to-zero-address");
        GemLike(token).transfer(to, amount);
        emit Rescue(token, to, amount);
    }

    function rescueDeposit(address depositor, address to, uint256 amount) external auth {
        require(to != address(0), "NFATFacility/to-zero-address");
        require(amount > 0, "NFATFacility/amount-zero");

        uint256 pending = deposits[depositor];
        require(pending >= amount, "NFATFacility/insufficient-pending");
        deposits[depositor] = pending - amount;

        asset.transfer(to, amount);
        emit RescueDeposit(depositor, to, amount);
    }

    function rescueRepayment(uint256 tokenId, address to, uint256 amount) external auth {
        require(to != address(0), "NFATFacility/to-zero-address");
        require(amount > 0, "NFATFacility/amount-zero");

        uint256 available = claimable[tokenId];
        require(available >= amount, "NFATFacility/insufficient-claimable");
        claimable[tokenId] = available - amount;

        asset.transfer(to, amount);
        emit RescueRepayment(tokenId, to, amount);
    }

    // --- Operator functions ---

    // Note: amount may be zero to mint an NFAT without claiming from the deposit queue.
    function issue(address depositor, uint256 amount, uint256 tokenId) external operatorAuth stoppable {
        require(depositor != address(0), "NFATFacility/depositor-zero-address");

        if (amount > 0) {
            uint256 pending = deposits[depositor];
            require(pending >= amount, "NFATFacility/insufficient-pending");
            deposits[depositor] = pending - amount;
        }

        _mint(depositor, tokenId);

        // Note: transfer after effects to maintain CEI ordering.
        if (amount > 0) {
            asset.transfer(recipient, amount);
        }

        emit Issue(depositor, amount, tokenId);
    }

    // --- Public functions ---

    function deposit(uint256 amount) external stoppable {
        require(amount > 0, "NFATFacility/amount-zero");

        deposits[msg.sender] += amount;

        asset.transferFrom(msg.sender, address(this), amount);

        emit Deposit(msg.sender, amount);
    }

    function withdraw(uint256 amount) external {
        require(amount > 0, "NFATFacility/amount-zero");

        uint256 pending = deposits[msg.sender];
        require(pending >= amount, "NFATFacility/insufficient-pending");
        deposits[msg.sender] = pending - amount;

        asset.transfer(msg.sender, amount);

        emit Withdraw(msg.sender, amount);
    }

    function repay(uint256 tokenId, uint256 amount) external stoppable {
        require(amount > 0, "NFATFacility/amount-zero");
        require(_ownerOf(tokenId) != address(0), "NFATFacility/token-missing");

        claimable[tokenId] += amount;

        asset.transferFrom(msg.sender, address(this), amount);

        emit Repay(tokenId, msg.sender, amount);
    }

    function claim(uint256 tokenId, uint256 amount) external stoppable {
        require(ownerOf(tokenId) == msg.sender, "NFATFacility/not-owner");
        require(amount > 0, "NFATFacility/amount-zero");

        uint256 available = claimable[tokenId];
        require(available >= amount, "NFATFacility/insufficient-claimable");
        claimable[tokenId] = available - amount;

        asset.transfer(msg.sender, amount);

        emit Claim(tokenId, msg.sender, amount);
    }
}
