import fs from "node:fs";
import path from "node:path";

export const productConfig = JSON.parse(fs.readFileSync(
  process.env.GRAIL_CONFIG || path.resolve(__dirname, "../../contracts/config.example.json"), "utf8",
));
export const agent = {
  name: productConfig.agent_name as string,
  description: "GRAIL: correlation-aware trading agent, OKX TR (dry_run + guarded live), commit-reveal ledger",
};

// This fixture deliberately includes non-ASCII text and analyst fields.
// It contains no order/result identifiers, which are revealed separately.
export function testVector() {
  const decision = {
    action: "HOLD", agent: agent.name, cycle_id: 12, decided_at_ms: 1792224000000,
    dry_run: true, inst_id: "BTC-USDT", llm_flag: "skipped", llm_note: "HOLD requires no order",
    mode: "live", reason: "Volatilite bütçesi; HOLD", ref_price: "67250.1", size_usdt: "0", target_weight_pct: 0,
  };
  const payload = {
    cycle_id: 12, agent: agent.name, mode: "live", dry_run: true,
    decided_at_ms: decision.decided_at_ms, decisions: [decision],
  };
  function sorted(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(sorted);
    if (value !== null && typeof value === "object") return Object.fromEntries(
      Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([k, v]) => [k, sorted(v)]),
    );
    return value;
  }
  const payloadUtf8 = JSON.stringify(sorted(payload)).replace(/[\u007f-\uffff]/g,
    char => "\\u" + char.charCodeAt(0).toString(16).padStart(4, "0"));
  return { payloadUtf8, saltHex: "0x" + "11".repeat(32) };
}
