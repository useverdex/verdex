// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Verdex Treasury
/// @notice Where every protocol fee lands, and the only thing it can do with them is buy VERDEX. An executor
///         on the list sweeps a balance of USDG or ETH into VERDEX through an allowlisted router, and the
///         contract checks the VERDEX it got against a floor it computes itself from the pools: USDG to ETH
///         from the Uniswap v3 pool, ETH to VERDEX from the Uniswap v4 pool, less a slippage band. Of every
///         sweep, a fixed share goes to the burn address and the rest waits here for the weekly payout to the
///         wallets that paid the fees. There is no function that sends funds anywhere else: not to the owner,
///         not to the executor. The owner keeps the lists, the split and the band.
interface IERC20 {
    function balanceOf(address) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
}

interface IUniswapV3Pool {
    function token0() external view returns (address);
    function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16, uint16, uint16, uint8, bool);
}

interface IPoolManager {
    function extsload(bytes32 slot) external view returns (bytes32);
}

contract VerdexTreasury {
    address public constant DEAD = 0x000000000000000000000000000000000000dEaD;
    bytes32 private constant POOLS_SLOT = bytes32(uint256(6)); // PoolManager._pools

    address public immutable verdex;
    address public immutable usdg;
    address public immutable weth;
    IUniswapV3Pool public immutable usdgEthPool; // USDG/WETH on Uniswap v3, for the USDG leg of the floor
    IPoolManager public immutable poolManager; // Uniswap v4, where VERDEX trades against ETH
    bytes32 public immutable verdexPoolId;

    address public owner;
    mapping(address => bool) public isExecutor;
    mapping(address => bool) public isRouter;
    uint16 public burnBps = 5_000;
    uint16 public maxSlippageBps = 800;
    uint256 public rewardsAvailable; // VERDEX bought and not yet paid back
    uint256 public totalBought;
    uint256 public totalBurned;
    uint256 public totalPaidBack;
    uint256 public epoch;
    bool private _locked;

    event Swept(address indexed executor, address indexed tokenIn, uint256 amountIn, uint256 verdexOut, uint256 burned, uint256 kept);
    event Distributed(uint256 indexed epoch, uint256 total, uint256 recipients);
    event ExecutorSet(address indexed executor, bool allowed);
    event RouterSet(address indexed router, bool allowed);
    event SplitSet(uint16 burnBps);
    event SlippageSet(uint16 maxSlippageBps);
    event OwnershipTransferred(address indexed from, address indexed to);

    error Reentrancy();
    error NotOwner();
    error NotExecutor();
    error NotRouter();
    error BadToken();
    error BadArgs();
    error RouteFailed();
    error Short();
    error TooMuch();

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

    constructor(address verdex_, address usdg_, address weth_, IUniswapV3Pool usdgEthPool_, IPoolManager poolManager_, bytes32 verdexPoolId_, address executor_, address router_) {
        verdex = verdex_;
        usdg = usdg_;
        weth = weth_;
        usdgEthPool = usdgEthPool_;
        poolManager = poolManager_;
        verdexPoolId = verdexPoolId_;
        owner = msg.sender;
        if (executor_ != address(0)) { isExecutor[executor_] = true; emit ExecutorSet(executor_, true); }
        if (router_ != address(0)) { isRouter[router_] = true; emit RouterSet(router_, true); }
    }

    receive() external payable {}

    // ----- The floor, from the pools -----

    /// @notice VERDEX for `weiIn` of ETH at the v4 pool's spot price (ETH is currency0, VERDEX currency1).
    function spotVerdexForEth(uint256 weiIn) public view returns (uint256 out) {
        bytes32 slot = keccak256(abi.encodePacked(verdexPoolId, POOLS_SLOT));
        uint256 sqrtP = uint256(poolManager.extsload(slot)) & ((1 << 160) - 1);
        // price of currency1 in currency0 is sqrtP^2 / 2^192, in two steps so nothing overflows
        out = (weiIn * sqrtP) >> 96;
        out = (out * sqrtP) >> 96;
    }

    /// @notice ETH for `amountIn` of USDG at the v3 pool's spot price.
    function spotEthForUsdg(uint256 amountIn) public view returns (uint256 out) {
        (uint160 sqrtP,,,,,,) = usdgEthPool.slot0();
        if (usdgEthPool.token0() == usdg) { out = (amountIn * sqrtP) >> 96; out = (out * sqrtP) >> 96; }
        else { out = (amountIn << 96) / sqrtP; out = (out << 96) / sqrtP; }
    }

    /// @notice VERDEX a sweep of `amountIn` of `tokenIn` would get at spot, before the slippage band.
    function quoteVerdex(address tokenIn, uint256 amountIn) public view returns (uint256) {
        if (tokenIn == address(0) || tokenIn == weth) return spotVerdexForEth(amountIn);
        if (tokenIn == usdg) return spotVerdexForEth(spotEthForUsdg(amountIn));
        revert BadToken();
    }

    /// @notice The least VERDEX a sweep must return: spot less the band.
    function floorOut(address tokenIn, uint256 amountIn) public view returns (uint256) {
        return (quoteVerdex(tokenIn, amountIn) * (10_000 - maxSlippageBps)) / 10_000;
    }

    // ----- Sweep and distribute -----

    /// @notice Swaps `amountIn` of `tokenIn` held here into VERDEX through `router` with the given calldata,
    ///         keeps the result here, burns `burnBps` of it and books the rest for the next payout.
    function sweep(address tokenIn, uint256 amountIn, address router, address spender, bytes calldata data, uint256 minOut) external nonReentrant returns (uint256 out) {
        if (!isExecutor[msg.sender]) revert NotExecutor();
        if (!isRouter[router]) revert NotRouter();
        if (amountIn == 0) revert BadArgs();
        uint256 floor = floorOut(tokenIn, amountIn);
        uint256 before = IERC20(verdex).balanceOf(address(this));
        if (tokenIn == address(0)) {
            (bool ok,) = router.call{value: amountIn}(data);
            if (!ok) revert RouteFailed();
        } else {
            _approve(tokenIn, spender, amountIn);
            (bool ok,) = router.call(data);
            if (!ok) revert RouteFailed();
            _approve(tokenIn, spender, 0);
        }
        out = IERC20(verdex).balanceOf(address(this)) - before;
        if (out < minOut || out < floor) revert Short();
        uint256 burned = (out * burnBps) / 10_000;
        if (burned != 0) require(IERC20(verdex).transfer(DEAD, burned), "burn");
        uint256 kept = out - burned;
        rewardsAvailable += kept;
        totalBought += out;
        totalBurned += burned;
        emit Swept(msg.sender, tokenIn, amountIn, out, burned, kept);
    }

    /// @notice Pays VERDEX from the rewards bucket to the wallets that paid fees, in the amounts the executor
    ///         computed from the fee events of the period. Never more than the bucket holds.
    function distribute(address[] calldata to, uint256[] calldata amounts) external nonReentrant {
        if (!isExecutor[msg.sender]) revert NotExecutor();
        if (to.length != amounts.length || to.length == 0) revert BadArgs();
        uint256 total;
        for (uint256 i = 0; i < to.length; i++) total += amounts[i];
        if (total > rewardsAvailable) revert TooMuch();
        rewardsAvailable -= total;
        totalPaidBack += total;
        for (uint256 i = 0; i < to.length; i++) if (amounts[i] != 0) require(IERC20(verdex).transfer(to[i], amounts[i]), "pay");
        epoch += 1;
        emit Distributed(epoch, total, to.length);
    }

    // ----- Owner: the lists, the split, the band -----

    function setExecutor(address executor, bool allowed) external onlyOwner {
        isExecutor[executor] = allowed;
        emit ExecutorSet(executor, allowed);
    }

    function setRouter(address router, bool allowed) external onlyOwner {
        isRouter[router] = allowed;
        emit RouterSet(router, allowed);
    }

    function setSplit(uint16 burnBps_) external onlyOwner {
        if (burnBps_ > 10_000) revert BadArgs();
        burnBps = burnBps_;
        emit SplitSet(burnBps_);
    }

    function setMaxSlippage(uint16 bps) external onlyOwner {
        if (bps > 3_000) revert BadArgs();
        maxSlippageBps = bps;
        emit SlippageSet(bps);
    }

    function transferOwnership(address to) external onlyOwner {
        emit OwnershipTransferred(owner, to);
        owner = to;
    }

    function _approve(address token, address spender, uint256 amount) private {
        (bool ok, bytes memory ret) = token.call(abi.encodeWithSelector(IERC20.approve.selector, spender, amount));
        require(ok && (ret.length == 0 || abi.decode(ret, (bool))), "approve");
    }
}
