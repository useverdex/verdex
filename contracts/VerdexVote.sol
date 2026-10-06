// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Verdex Holders vote
/// @notice Rounds of ranked votes on what ships next, where a holder's VERDEX balance is their vote. A round
///         names its candidates and when it closes; any address can submit a ranking while it is open, and
///         change it. Nothing is locked, deposited or snapshotted here: the page tallies a round by reading
///         every voter's ranking from this contract and every voter's balance from the token at that moment,
///         so holding is enough and selling is leaving the vote.
/// @dev    The admin only opens rounds; it cannot vote for anyone, remove a ranking or change a round once
///         opened. Rankings are validated as distinct candidate indexes; a partial ranking is allowed.
interface IERC20 {
    function balanceOf(address) external view returns (uint256);
}

contract VerdexVote {
    struct Round {
        string title;
        string[] options;
        uint40 opensAt;
        uint40 closesAt;
        address[] voters;
    }

    uint256 public constant MAX_OPTIONS = 12;

    IERC20 public immutable verdex;
    address public admin;
    uint256 public roundCount;
    mapping(uint256 => Round) private _rounds;
    mapping(uint256 => mapping(address => uint8[])) private _ranking;
    mapping(uint256 => mapping(address => uint40)) public votedAt;

    event RoundOpened(uint256 indexed id, string title, string[] options, uint40 opensAt, uint40 closesAt);
    event Voted(uint256 indexed id, address indexed voter, uint8[] ranking);
    event AdminTransferred(address indexed from, address indexed to);

    error NotAdmin();
    error BadRound();
    error NotOpen();
    error BadRanking();

    constructor(address verdex_) {
        if (verdex_ == address(0)) revert BadRound();
        verdex = IERC20(verdex_);
        admin = msg.sender;
    }

    // ---- rounds ----

    /// @notice Opens a round. Two to twelve candidates; it closes at `closesAt`, in the future.
    function openRound(string calldata title, string[] calldata options, uint40 closesAt) external returns (uint256 id) {
        if (msg.sender != admin) revert NotAdmin();
        if (options.length < 2 || options.length > MAX_OPTIONS || closesAt <= block.timestamp) revert BadRound();
        id = ++roundCount;
        Round storage r = _rounds[id];
        r.title = title;
        for (uint256 i = 0; i < options.length; i++) r.options.push(options[i]);
        r.opensAt = uint40(block.timestamp);
        r.closesAt = closesAt;
        emit RoundOpened(id, title, options, r.opensAt, closesAt);
    }

    /// @notice Submits or replaces the caller's ranking: candidate indexes, best first, each at most once.
    function vote(uint256 id, uint8[] calldata ranking) external {
        Round storage r = _rounds[id];
        if (r.closesAt == 0) revert BadRound();
        if (block.timestamp > r.closesAt) revert NotOpen();
        uint256 n = r.options.length;
        if (ranking.length == 0 || ranking.length > n) revert BadRanking();
        uint256 seen;
        for (uint256 i = 0; i < ranking.length; i++) {
            uint8 k = ranking[i];
            if (k >= n || (seen & (1 << k)) != 0) revert BadRanking();
            seen |= 1 << k;
        }
        if (votedAt[id][msg.sender] == 0) r.voters.push(msg.sender);
        votedAt[id][msg.sender] = uint40(block.timestamp);
        _ranking[id][msg.sender] = ranking;
        emit Voted(id, msg.sender, ranking);
    }

    // ---- views ----

    function round(uint256 id) external view returns (string memory title, string[] memory options, uint40 opensAt, uint40 closesAt, uint256 voterCount) {
        Round storage r = _rounds[id];
        return (r.title, r.options, r.opensAt, r.closesAt, r.voters.length);
    }

    function isOpen(uint256 id) public view returns (bool) {
        Round storage r = _rounds[id];
        return r.closesAt != 0 && block.timestamp <= r.closesAt;
    }

    /// @notice A page of a round's voters, so a tally can read them in batches.
    function voters(uint256 id, uint256 offset, uint256 limit) external view returns (address[] memory out) {
        address[] storage v = _rounds[id].voters;
        if (offset >= v.length) return out;
        uint256 n = v.length - offset;
        if (n > limit) n = limit;
        out = new address[](n);
        for (uint256 i = 0; i < n; i++) out[i] = v[offset + i];
    }

    function rankingOf(uint256 id, address voter) external view returns (uint8[] memory) {
        return _ranking[id][voter];
    }

    /// @notice A voter's weight right now: their VERDEX balance. Read at tally time, never stored.
    function weightOf(address voter) external view returns (uint256) {
        return verdex.balanceOf(voter);
    }

    // ---- admin: opening rounds only ----

    function transferAdmin(address to) external {
        if (msg.sender != admin) revert NotAdmin();
        if (to == address(0)) revert BadRound();
        emit AdminTransferred(admin, to);
        admin = to;
    }
}
