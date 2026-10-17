# GRAIL chain

## Full ledger audit (T-015)

```powershell
cd chain
npm run audit
```

This reads every agent #1 commit/reveal from the ledger deployment block through
one fixed Fuji block, using the public
[PublicNode Fuji RPC](https://avalanche.publicnode.com/?fuji). It prints terminal
tables and saves `runtime/audit-latest.md` in a git-ignored directory.
The tracked [`deployments/audit-latest.md`](deployments/audit-latest.md) is a
**sample snapshot from 16:06 on 2026-10-17, containing 16 cycles**; running the
audit never replaces that example.
The standalone command does not load Hardhat configuration or `.env`, request a
signer, send transactions, or call OKX. No key or RPC setup is required.

The scan uses contiguous windows of at most 1,000 blocks, with a 150 ms pause
between windows. Rate limits (including HTTP 429) have four retries with
500/1,000/2,000/4,000 ms backoff. The deployment block comes from the verified
deployment receipt. Logs have a fixed upper block, but `commitCount`,
`revealCount` and `decisions` are read at **latest**, since public RPCs may not
support historical `eth_call`. Both counters are read freshly before the scan
and again after all cycle checks, without caching state calls. Both pairs must
be identical and exactly match the scanned event counts. Missing/duplicate
events, a changed ledger, or RPC failures stop the audit. A changed ledger is
reported as **INCOMPLETE**; retry to include the new records. The scan head's
block hash is also checked again at the end.

Choose another RPC with `npm run audit -- --rpc URL`. Precedence is `--rpc`,
then `GRAIL_AUDIT_RPC_URL`, then `FUJI_RPC_URL`, then PublicNode. These are shell
environment variables; the command still does not load `.env`. A custom RPC
must support Fuji, the log windows and latest state reads. Output identifies
only its origin, keeping credential paths and query parameters out of reports.

Each row includes commit/reveal tx hashes, block times in UTC, elapsed seconds,
`dry_run (SIMULATED)`/`LIVE`, hash verification and the exact `okxOrderId` string.
Salt and payload come from reveal calldata. The existing cycle verifier checks
canonical receipts/blocks, event/storage consistency, calldata identities,
payload agent/cycle and v0.6 order results. The proof table compares the stored
commitHash with `keccak(payload || salt)` for each revealed cycle.

Summary counts are total cycles, revealed, unopened, MATCH, mismatch and LIVE
order IDs. Unopened commitments are `PENDING`; their mode/order result and
preimage cannot be known yet. LIVE order IDs count only MATCH rows with
`dry_run=false`, excluding `simulated` and `unknown`. The ledger records the
agent's reported order IDs; it does not prove exchange execution or fills.
**okxOrderId is revealed alongside the payload but is not part of the committed hash; it is not proof of exchange execution.**

Exit 0 means a complete scan with no mismatches; valid pending commitments are
allowed. Mismatches are reported per row and exit 1. RPC/completeness failures
exit 1 and leave the last completed report unchanged. The output is replaced
only after the scan and its checks complete.

## Deployment package (T-003)

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

## Explorer source verification (T-010)

The pinned `hardhat-verify` plugin uses Routescan's public Fuji endpoint. No secret
API key is needed. Verification publishes Solidity sources and compiler inputs
to the explorer; these commands do not deploy or submit blockchain transactions:

Verified source pages (API confirmation recorded in `deployments/source-verification.json`):

- [IdentityRegistry](https://testnet.snowtrace.io/address/0x120A4E53A24ddd09991633b4Cb88c3feA6166721#code)
- [ReputationRegistry](https://testnet.snowtrace.io/address/0x326671e1e2e80121C3Cd53a9b9fA5751a669596F#code)
- [ValidationRegistry](https://testnet.snowtrace.io/address/0x1a9c67CA99391812D7b157748fB814F6c7dADf0C#code)
- [GrailLedger](https://testnet.snowtrace.io/address/0x1B5fcf6DeFf2F9375338A2C35932224522118851#code)

```powershell
npx hardhat verify --network fuji --contract contracts/IdentityRegistry.sol:IdentityRegistry 0x120A4E53A24ddd09991633b4Cb88c3feA6166721
npx hardhat verify --network fuji --contract contracts/ReputationRegistry.sol:ReputationRegistry 0x326671e1e2e80121C3Cd53a9b9fA5751a669596F 0x120A4E53A24ddd09991633b4Cb88c3feA6166721
npx hardhat verify --network fuji --contract contracts/ValidationRegistry.sol:ValidationRegistry 0x1a9c67CA99391812D7b157748fB814F6c7dADf0C 0x120A4E53A24ddd09991633b4Cb88c3feA6166721
npx hardhat verify --network fuji --contract contracts/GrailLedger.sol:GrailLedger 0x1B5fcf6DeFf2F9375338A2C35932224522118851 0x120A4E53A24ddd09991633b4Cb88c3feA6166721
npm run verify:sources
```

`verify:sources` checks `getsourcecode` independently of the submission queue and
writes `deployments/source-verification.json` only after all four addresses have
published source and ABI. It records compiler information, a source digest and
the four Snowtrace `#code` links. The queue's CLI status can remain pending after
sources become readable; the API check provides a separate confirmation.
The check uses the same endpoint as submissions and requests uncached results.
It also checks compiler version, optimizer runs, constructor arguments and ABI.
The first ReputationRegistry minimal-input request stalled; submitting the
original full compiler input succeeded. To use that fallback on an unverified
address, set `$env:GRAIL_VERIFY_FULL_INPUT = '1'` before `hardhat verify`.
New submissions print their public request GUID and stop after 40 pending polls.

## Read-only cycle verification (T-010)

```powershell
npx hardhat run scripts/verify-cycle.ts --network fuji --cycle 1
```

The narrow `run --cycle` extension accepts this parameter only for
`scripts/verify-cycle.ts`. The script loads deployment information from
`contracts/chain.json` and uses no signer or private key. It reads the stored
commitment and indexed commit/reveal events, obtains the successful reveal
transaction, and decodes `payload` and `salt` from its calldata. It checks the
target, agent/cycle, receipt, event values, storage and
`keccak256(payload || salt) == commitHash` before printing `MATCH` and explorer
transaction links. A supplied state file or fixture salt is never used.

Cycle IDs are uint256 decimal strings, so values above JavaScript's safe integer
limit retain full precision. Log scans start from the deployment receipt and run
backwards in windows of at most 100 blocks. Once both events are found, older
windows are skipped. Older-window reads are paced, and a rate-limited log read
is retried once. Persistent RPC limits are reported as errors.

Exit codes: `MATCH` = 0, `MISMATCH` or invalid/unavailable RPC data = 1,
`PENDING` (committed, unrevealed) or `NOT_FOUND` = 2. These are cryptographic
preimage checks; the opaque payload's trading semantics remain the caller's
responsibility.

The verified Fuji cycle 1 can be read without a log scan:

```powershell
npm run verify:cycle:1
```

This expands to `verify-cycle.ts --network fuji --cycle 1` with the known
`--commit-tx 0x7b47c4f313ffa5630d1acfff6411f11c6d13c321bbc69649ec8c90976995f728`
and `--reveal-tx 0x541cb8ff88aac0248fbf79d7997915b62bb08fb873e226bbefc35cbcec77cf45`.
The IDs are lookup hints; every receipt and transaction is independently checked
against the configured ledger, agent wallet and canonical block. Arbitrary
cycles can use `npm run verify:cycle -- --cycle N --commit-tx HASH --reveal-tx HASH`.
Only `--commit-tx` is also accepted for open commitments.

Before `MATCH`, the reader validates payload `agent`/`cycle_id`, the `dry_run`
label and the v0.6 canonical order-results mapping. HOLD/no attempted order uses
an empty results string. Unsubmitted BUY/SELL decisions may be absent from the
mapping; present keys must refer to BUY/SELL instruments in the committed
payload. This checks the committed record and results format; it does not
attest to exchange fills or returns.

Observed cycle 1 result (2026-10-17):

```text
MATCH agent=1 cycle=1
payload dry_run=true (SIMULATED)
commitHash=0xd9064ac4000cae4637a50cd3f25b4ae7c9612e9c9600772f7468533371785a83
keccak(payload||salt)=0xd9064ac4000cae4637a50cd3f25b4ae7c9612e9c9600772f7468533371785a83
```
