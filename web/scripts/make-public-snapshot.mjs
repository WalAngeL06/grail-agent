// Public demo snapshot: copies a real agent state.json into web/fixtures/public-snapshot.json for the static
// jury build (npm run build:public). Whitelist only; salt + payload are dropped for any check-in that is not
// revealed yet (the random code must stay private until the envelope is opened).
// Usage: node scripts/make-public-snapshot.mjs "<path to runtime/.../state.json>"
import { readFileSync, writeFileSync } from "node:fs";

const src = process.argv[2];
if (!src) {
  console.error("usage: node scripts/make-public-snapshot.mjs <state.json>");
  process.exit(1);
}
const s = JSON.parse(readFileSync(src, "utf8"));
const pick = (o, keys) => Object.fromEntries(keys.filter((k) => o && o[k] !== undefined).map((k) => [k, o[k]]));

const DECISION_KEYS = [
  "cycle_id", "agent", "mode", "dry_run", "inst_id", "action", "size_usdt", "ref_price", "target_weight_pct", "reason",
  "llm_flag", "llm_note", "decided_at_ms", "commit_tx", "commit_hash", "okx_order_id", "order_status", "fill_price",
  "execution_size_usdt", "execution_size_base", "reveal_tx", "verified", "payload_utf8", "salt_hex",
];
let hidden = 0;
const decisions = (s.decisions ?? []).map((d) => {
  const out = pick(d, DECISION_KEYS);
  if (!d.reveal_tx) {
    if (out.salt_hex || out.payload_utf8) hidden++;
    delete out.salt_hex;
    delete out.payload_utf8;
  }
  return out;
});

const snap = {
  ...pick(s, ["contract_version", "generated_at_ms", "mode", "dry_run"]),
  agent: pick(s.agent, ["name", "status", "cycle_id", "next_cycle_at_ms"]),
  config: pick(s.config, [
    "coins", "risk_budget_pct", "max_position_pct", "cycle_seconds", "candle_bar", "lookback_bars", "target_vol_pct",
    "max_order_usdt", "min_order_usdt", "max_total_deploy_usdt", "kill_switch_drawdown_pct", "okx_site", "quote",
  ]),
  market: (s.market ?? []).map((m) => pick(m, ["inst_id", "last", "change_24h_pct", "at_ms"])),
  portfolio: {
    ...pick(s.portfolio, ["equity_usdt", "cash_usdt"]),
    positions: (s.portfolio?.positions ?? []).map((p) => pick(p, ["inst_id", "size_base", "value_usdt", "weight_pct"])),
  },
  metrics: s.metrics ?? {},
  decisions,
  chain: pick(s.chain, ["network", "chain_id", "address", "explorer", "agent_id", "identity_registry", "commits", "reveals", "unrevealed"]),
  errors: (s.errors ?? []).map((e) => pick(e, ["code", "message", "at_ms", "where"])),
  snapshot: { source: "agents dry-run runtime state.json", taken_at_ms: s.generated_at_ms },
};

const text = JSON.stringify(snap);
if (/(api[_-]?key|secret|passphrase|private[_-]?key|mnemonic)/i.test(text)) {
  console.error("refusing to write: snapshot text contains a secret-looking word");
  process.exit(2);
}
writeFileSync(new URL("../fixtures/public-snapshot.json", import.meta.url), text + "\n");
console.log(`fixtures/public-snapshot.json: ${decisions.length} decisions, cycles up to #${snap.agent.cycle_id}, ${hidden} unrevealed salts dropped, ${text.length} bytes`);
