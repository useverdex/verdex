// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Verdex Index
/// @notice A basket of tokenized stocks as one ERC-20. Every share is backed by a fixed number of units of
///         each component, set when the index is created and never changed. `issue` pulls exactly those units
///         from the caller and mints shares; `redeem` burns shares and sends the units back. The contract holds
///         the components behind the shares and nothing else: no cash, no swaps, no manager, no oracle. The
///         creator keeps one lever, a cap on the share supply, which only limits how big the index can grow.
/// @dev    Units are per 1e18 shares. Issue rounds the pull up and redeem rounds the payout down, so the
///         balance of every component is always at least totalSupply * units / 1e18.
interface IERC20 {
    function balanceOf(address) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

library SafeERC20 {
    function safeTransfer(address token, address to, uint256 amount) internal {
        (bool ok, bytes memory data) = token.call(abi.encodeWithSelector(IERC20.transfer.selector, to, amount));
        require(ok && (data.length == 0 || abi.decode(data, (bool))), "transfer");
    }
    function safeTransferFrom(address token, address from, address to, uint256 amount) internal {
        (bool ok, bytes memory data) = token.call(abi.encodeWithSelector(IERC20.transferFrom.selector, from, to, amount));
        require(ok && (data.length == 0 || abi.decode(data, (bool))), "transferFrom");
    }
}

contract VerdexIndex {
    using SafeERC20 for address;

    // ERC-20
    string public name;
    string public symbol;
    uint8 public constant decimals = 18;
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    // Index
    uint256 private constant ONE = 1e18;
    address public immutable factory;
    address[] private _tokens;
    uint256[] private _units; // of each token, per 1e18 shares
    address public owner;
    uint256 public maxSupply;
    bool private _locked;

    event Issued(address indexed by, address indexed to, uint256 shares);
    event Redeemed(address indexed by, address indexed to, uint256 shares);
    event MaxSupplySet(uint256 maxSupply);
    event OwnershipTransferred(address indexed from, address indexed to);

    error Reentrancy();
    error NotOwner();
    error ZeroShares();
    error CapReached();
    error ShortPull();
    error Insufficient();

    modifier nonReentrant() {
        if (_locked) revert Reentrancy();
        _locked = true;
        _;
        _locked = false;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor(string memory name_, string memory symbol_, address[] memory tokens_, uint256[] memory units_, address owner_, uint256 maxSupply_) {
        name = name_;
        symbol = symbol_;
        factory = msg.sender;
        _tokens = tokens_;
        _units = units_;
        owner = owner_;
        maxSupply = maxSupply_;
    }

    // ----- Reads -----

    function count() external view returns (uint256) {
        return _tokens.length;
    }

    function components() external view returns (address[] memory tokens, uint256[] memory units) {
        return (_tokens, _units);
    }

    /// @notice What `issue(shares)` pulls from the caller, rounded up per component.
    function amountsIn(uint256 shares) public view returns (uint256[] memory amounts) {
        amounts = new uint256[](_tokens.length);
        for (uint256 i = 0; i < amounts.length; i++) amounts[i] = (shares * _units[i] + ONE - 1) / ONE;
    }

    /// @notice What `redeem(shares)` pays out, rounded down per component.
    function amountsOut(uint256 shares) public view returns (uint256[] memory amounts) {
        amounts = new uint256[](_tokens.length);
        for (uint256 i = 0; i < amounts.length; i++) amounts[i] = (shares * _units[i]) / ONE;
    }

    // ----- Issue and redeem -----

    /// @notice Pulls the units behind `shares` from the caller and mints the shares to `to`.
    function issue(uint256 shares, address to) external nonReentrant {
        if (shares == 0) revert ZeroShares();
        if (totalSupply + shares > maxSupply) revert CapReached();
        uint256[] memory amounts = amountsIn(shares);
        for (uint256 i = 0; i < amounts.length; i++) {
            address token = _tokens[i];
            uint256 before = IERC20(token).balanceOf(address(this));
            token.safeTransferFrom(msg.sender, address(this), amounts[i]);
            // A token that takes a cut on transfer would leave the shares under-backed; refuse it.
            if (IERC20(token).balanceOf(address(this)) < before + amounts[i]) revert ShortPull();
        }
        _mint(to, shares);
        emit Issued(msg.sender, to, shares);
    }

    /// @notice Burns `shares` from the caller and sends the units behind them to `to`.
    function redeem(uint256 shares, address to) external nonReentrant {
        if (shares == 0) revert ZeroShares();
        _burn(msg.sender, shares);
        uint256[] memory amounts = amountsOut(shares);
        for (uint256 i = 0; i < amounts.length; i++) if (amounts[i] != 0) _tokens[i].safeTransfer(to, amounts[i]);
        emit Redeemed(msg.sender, to, shares);
    }

    // ----- Owner: the cap only -----

    function setMaxSupply(uint256 maxSupply_) external onlyOwner {
        maxSupply = maxSupply_;
        emit MaxSupplySet(maxSupply_);
    }

    function transferOwnership(address to) external onlyOwner {
        emit OwnershipTransferred(owner, to);
        owner = to;
    }

    // ----- ERC-20 -----

    function approve(address spender, uint256 value) external returns (bool) {
        allowance[msg.sender][spender] = value;
        emit Approval(msg.sender, spender, value);
        return true;
    }

    function transfer(address to, uint256 value) external returns (bool) {
        _transfer(msg.sender, to, value);
        return true;
    }

    function transferFrom(address from, address to, uint256 value) external returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        if (allowed != type(uint256).max) {
            if (allowed < value) revert Insufficient();
            allowance[from][msg.sender] = allowed - value;
        }
        _transfer(from, to, value);
        return true;
    }

    function _transfer(address from, address to, uint256 value) private {
        uint256 bal = balanceOf[from];
        if (bal < value) revert Insufficient();
        balanceOf[from] = bal - value;
        balanceOf[to] += value;
        emit Transfer(from, to, value);
    }

    function _mint(address to, uint256 value) private {
        totalSupply += value;
        balanceOf[to] += value;
        emit Transfer(address(0), to, value);
    }

    function _burn(address from, uint256 value) private {
        uint256 bal = balanceOf[from];
        if (bal < value) revert Insufficient();
        balanceOf[from] = bal - value;
        totalSupply -= value;
        emit Transfer(from, address(0), value);
    }
}

/// @title Verdex Index Factory
/// @notice Creates indexes and keeps the list. Anyone can create one; the site shows the ones Verdex made.
contract VerdexIndexFactory {
    address[] public indexes;
    mapping(address => bool) public isIndex;

    event IndexCreated(address indexed index, address indexed creator, string name, string symbol, address[] tokens, uint256[] units, uint256 maxSupply);

    error BadComponents();

    function create(string calldata name, string calldata symbol, address[] calldata tokens, uint256[] calldata units, uint256 maxSupply) external returns (address index) {
        uint256 n = tokens.length;
        if (n < 2 || n > 20 || units.length != n) revert BadComponents();
        for (uint256 i = 0; i < n; i++) {
            if (units[i] == 0 || tokens[i].code.length == 0) revert BadComponents();
            for (uint256 j = 0; j < i; j++) if (tokens[j] == tokens[i]) revert BadComponents();
        }
        index = address(new VerdexIndex(name, symbol, tokens, units, msg.sender, maxSupply));
        indexes.push(index);
        isIndex[index] = true;
        emit IndexCreated(index, msg.sender, name, symbol, tokens, units, maxSupply);
    }

    function count() external view returns (uint256) {
        return indexes.length;
    }

    function all() external view returns (address[] memory) {
        return indexes;
    }
}
