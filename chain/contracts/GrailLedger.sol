// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./IIdentityRegistry.sol";

/// @notice Append-only, agent-authorized decision commitments and reveals.
/// @dev Payload bytes are opaque; callers follow contracts/decision.md.
contract GrailLedger {
    IIdentityRegistry public immutable identityRegistry;

    struct Decision {
        bytes32 commitHash;
        uint256 committedAt;
        bool committed;
        bool revealed;
    }

    mapping(uint256 => mapping(uint256 => Decision)) public decisions;
    mapping(uint256 => uint256) public commitCount;
    mapping(uint256 => uint256) public revealCount;

    error InvalidRegistry();
    error Unauthorized();
    error AlreadyCommitted();
    error NotCommitted();
    error AlreadyRevealed();
    error HashMismatch();

    event DecisionCommitted(uint256 indexed agentId, uint256 indexed cycleId, bytes32 commitHash, uint256 timestamp);
    event DecisionRevealed(uint256 indexed agentId, uint256 indexed cycleId, bytes payload, string okxOrderId);

    constructor(address registry) {
        if (registry.code.length == 0) revert InvalidRegistry();
        identityRegistry = IIdentityRegistry(registry);
    }

    modifier onlyAgent(uint256 agentId) {
        // IdentityRegistry also reverts for IDs that have never been registered.
        if (!identityRegistry.isAuthorized(agentId, msg.sender)) revert Unauthorized();
        _;
    }

    function commitDecision(uint256 agentId, uint256 cycleId, bytes32 commitHash) external onlyAgent(agentId) {
        Decision storage decision = decisions[agentId][cycleId];
        if (decision.committed) revert AlreadyCommitted();
        decision.commitHash = commitHash;
        decision.committedAt = block.timestamp;
        decision.committed = true;
        ++commitCount[agentId];
        emit DecisionCommitted(agentId, cycleId, commitHash, block.timestamp);
    }

    function revealDecision(
        uint256 agentId, uint256 cycleId, bytes calldata payload, bytes32 salt, string calldata okxOrderId
    ) external onlyAgent(agentId) {
        Decision storage decision = decisions[agentId][cycleId];
        if (!decision.committed) revert NotCommitted();
        if (decision.revealed) revert AlreadyRevealed();
        if (keccak256(abi.encodePacked(payload, salt)) != decision.commitHash) revert HashMismatch();
        decision.revealed = true;
        ++revealCount[agentId];
        emit DecisionRevealed(agentId, cycleId, payload, okxOrderId);
    }
}
