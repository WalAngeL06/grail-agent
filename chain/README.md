# GRAIL chain — T-003

Fuji (43113), contracts v0.5. Public deployment data, full ABIs and the
cross-language hash fixture are in [`../contracts/chain.json`](../contracts/chain.json).
`agentId` is a decimal string. `agentWallet` owns the identity NFT and signs ledger transactions.

```powershell
cd chain
npm ci
npx hardhat test
npm run typecheck
npm run verify:fuji
```

The Solidity compiler is the pinned local `solc` package (0.8.20, Paris EVM,
optimizer 200 runs, viaIR). No compiler download is needed after `npm ci`.

## Ledger interface

- `commitDecision(agentId, cycleId, commitHash)` emits `DecisionCommitted` with a timestamp.
- `revealDecision(agentId, cycleId, payloadBytes, saltBytes32, okxOrderId)` checks
  `keccak256(payloadBytes || saltBytes32)` and emits `DecisionRevealed`.
- `decisions(agentId, cycleId)` returns `(commitHash, committedAt, committed, revealed)`.
- `commitCount(agentId)` and `revealCount(agentId)` expose cumulative counts;
  their difference is the number of open commitments.

The identity registry's NFT owner, token-approved account and approved operators
can write. Authorization is checked again on reveal, so revoked operators lose
access immediately. A cycle can be committed/revealed once per identity. Payloads
are opaque bytes, including HOLD decisions; canonical JSON and order sequencing
are enforced by the caller according to `../contracts/decision.md`.
Payload and order result are retained in immutable logs, and the commitment
remains readable from contract storage. There is no ledger admin or upgrade path.

## Deployment and recovery

`npm run deploy:local` rehearses all four deployments plus agent registration on
an ephemeral Hardhat network and writes ignored local outputs.

`npm run deploy:fuji` deploys the three project registries and GrailLedger,
registers the agent directly to the configured wallet, and writes `contracts/chain.json`.
Agent name comes from `GRAIL_CONFIG` or `contracts/config.example.json`.
The token URI contains a self-contained base64 ERC-8004 registration file;
name and description are also registry metadata.

Only the main worktree's `.env` is loaded by default:
`C:/Users/Serdar Arif/Desktop/Agentic Hack/.env`.
Override its location with `GRAIL_ENV`. Required: `AGENT_PRIVATE_KEY`,
`AGENT_ADDRESS`; optional: `FUJI_RPC_URL`. Keys are never written into outputs.

The public `deployments/fuji.json` journal records transaction hash, nonce and
predicted deployment address **before broadcast**. Rerunning queries the recorded
hash; it never automatically resends an unresolved transaction. A revert or
unresolved receipt stops the script. Do not delete the Fuji journal to retry:
query the recorded transaction and wallet nonce first. The actual recovery path
was exercised during this deployment: the first receipt wait failed, and the
next run confirmed the original IdentityRegistry transaction and continued.

`npm run verify:fuji` compares confirmed deployment receipts, deployed runtime
bytecode (with constructor immutables masked), ABIs, registry links, owner,
registration event, metadata and the hash fixture against the local build.

The fixture uses a public fixed salt for reproducibility. Real agent cycles must
use a fresh random 32-byte salt and persist payload/salt before committing.
No OKX action is performed by this package. TaskAgent and its tests are retained
as upstream reference only; TaskAgent is not deployed.

## Source

Registries, interfaces and TaskAgent reference come from
[ava-labs/8004-boilerplate](https://github.com/ava-labs/8004-boilerplate/tree/27d04ef9f2de048370be6286041eb38d54c76153),
snapshot recorded in `UPSTREAM.txt`. Registries are unchanged. GRAIL adds the
ledger, TypeScript configuration, acceptance tests and deployment/verification
scripts. Upstream frontend/backend and task CLI are excluded.
