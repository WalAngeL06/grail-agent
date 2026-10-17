// Demo state üretici: contracts/decision.md kanonik payload + keccak256(payload ‖ salt) kuralıyla
// gerçek hash'li bir state.json yazar (fixtures/demo-state.json). "Kendin Doğrula" ✅ gösterebilsin diye.
// Zincir tx hash'leri uydurmadır; UI bu kaynağı "demo" olarak etiketler.
import { keccak_256 } from "@noble/hashes/sha3.js";
import { bytesToHex, hexToBytes, utf8ToBytes } from "@noble/hashes/utils.js";
import { readFileSync, writeFileSync } from "node:fs";

let seed = 7;
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const hex32 = () => "0x" + Array.from({ length: 32 }, () => Math.floor(rnd() * 256).toString(16).padStart(2, "0")).join("");

// Python json.dumps(sort_keys=True, separators=(",", ":"), ensure_ascii=True) eşleniği
const canon = (v) => {
  if (Array.isArray(v)) return "[" + v.map(canon).join(",") + "]";
  if (v && typeof v === "object")
    return "{" + Object.keys(v).sort().map((k) => canon(k) + ":" + canon(v[k])).join(",") + "}";
  if (typeof v === "string")
    return JSON.stringify(v).replace(/[\u0080-￿]/g, (c) => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"));
  return JSON.stringify(v);
};

const coins = ["AVAX-USDT", "BTC-USDT", "ETH-USDT", "OKB-USDT", "SOL-USDT"];
const price = { "BTC-USDT": 67250.1, "ETH-USDT": 2612.4, "SOL-USDT": 152.37, "AVAX-USDT": 27.415, "OKB-USDT": 43.21 };
const trend = { "BTC-USDT": 2.4, "ETH-USDT": 1.1, "SOL-USDT": -0.8, "AVAX-USDT": 3.2, "OKB-USDT": -1.9 };
const vol = { "BTC-USDT": 38.2, "ETH-USDT": 51.7, "SOL-USDT": 74.9, "AVAX-USDT": 82.3, "OKB-USDT": 46.1 };
// engine: HRP only among coins trending up; trending-down coins get 0 (R-007-11)
const hrp = { "BTC-USDT": 47.72, "ETH-USDT": 33.13, "SOL-USDT": 0, "AVAX-USDT": 19.15, "OKB-USDT": 0 };
const tw = { "BTC-USDT": 26.18, "ETH-USDT": 19.34, "SOL-USDT": 0, "AVAX-USDT": 12.15, "OKB-USDT": 0 };

// Zamanlar üretim anına göre; demo öncesi `npm run fixture` ile tazele.
const T0 = Math.floor(Date.now() / 1000) * 1000;
const agent = "GRAIL-01";
const decisions = [];
const cycles = [9, 10, 11, 12];
for (const cycle_id of cycles) {
  const at = T0 - (12 - cycle_id) * 90_000;
  const ds = coins.map((inst_id) => {
    const up = trend[inst_id] > 0;
    let action = "HOLD", size = "0";
    if (cycle_id === 9 && up) { action = "BUY"; size = inst_id === "BTC-USDT" ? "10.00" : "6.50"; }
    if (cycle_id === 11 && inst_id === "SOL-USDT") { action = "SELL"; size = "4.20"; }
    if (cycle_id === 12 && inst_id === "BTC-USDT") { action = "BUY"; size = "5.00"; }
    const p = (price[inst_id] * (1 + (cycle_id - 12) * 0.0007)).toFixed(inst_id === "BTC-USDT" ? 1 : 3);
    // engine/src/grail_engine/decision.py reason format (English, T-009)
    const held = ["BTC-USDT", "ETH-USDT"].includes(inst_id);
    const reason = up
      ? `Price trending up (+${trend[inst_id].toFixed(1)}%), target ${tw[inst_id]}% of funds (1.4 independent bets)` +
        (vol[inst_id] > 50 ? `; size cut to keep risk near 20% (was ${Math.round(vol[inst_id] * 0.55)}%)` : "")
      : `Price trending down (${trend[inst_id].toFixed(1)}%), ${held ? "moving to cash" : "staying in cash"}`;
    return { action, agent, cycle_id, decided_at_ms: at, dry_run: true, inst_id, mode: "live", reason, ref_price: p, size_usdt: size, target_weight_pct: tw[inst_id] };
  });
  // v0.5 analist (analyst/src/grail_analyst/review.py davranışı): sadece BUY'lar incelenir, SELL exempt,
  // BUY yoksa hepsi "skipped: no_buys"; llm_note/llm_flag payload'a ve hash'e girer.
  const hasBuy = ds.some((d) => d.action === "BUY");
  for (const d of ds) {
    if (d.action === "SELL") Object.assign(d, { llm_flag: "exempt", llm_note: "exempt: sell reduces exposure" });
    else if (!hasBuy) Object.assign(d, { llm_flag: "skipped", llm_note: "skipped: no_buys" });
    else if (d.action === "HOLD") Object.assign(d, { llm_flag: "skipped", llm_note: "" });
    else if (cycle_id === 9 && d.inst_id === "ETH-USDT")
      Object.assign(d, { size_usdt: "4.00", llm_flag: "reduced", llm_note: "Reduced: ETH moves with BTC (rho 0.82), adds little diversification" });
    else if (cycle_id === 9 && d.inst_id === "AVAX-USDT")
      Object.assign(d, { action: "HOLD", size_usdt: "0", llm_flag: "vetoed", llm_note: "Vetoed: 24h volatility spike, trend signal not confirmed" });
    else Object.assign(d, { llm_flag: "approved", llm_note: "Approved within configured limits" });
  }
  const payload = { cycle_id, agent, mode: "live", dry_run: true, decided_at_ms: at, decisions: ds };
  const payload_utf8 = canon(payload);
  const salt_hex = hex32();
  const bytes = new Uint8Array([...utf8ToBytes(payload_utf8), ...hexToBytes(salt_hex.slice(2))]);
  const commit_hash = "0x" + bytesToHex(keccak_256(bytes));
  const revealed = cycle_id !== 12;
  const commit_tx = hex32();
  const reveal_tx = revealed ? hex32() : null;
  for (const d of ds) {
    const traded = d.action !== "HOLD";
    decisions.push({
      cycle_id, inst_id: d.inst_id, action: d.action, size_usdt: d.size_usdt, ref_price: d.ref_price,
      target_weight_pct: d.target_weight_pct, reason: d.reason, llm_note: d.llm_note, llm_flag: d.llm_flag,
      decided_at_ms: at, mode: "live", dry_run: true,
      commit_tx, commit_hash,
      okx_order_id: traded && revealed ? `sim-${cycle_id}-${d.inst_id}` : null,
      order_status: traded ? (revealed ? "simulated" : "pending") : "none",
      fill_price: traded && revealed ? d.ref_price : null,
      reveal_tx, verified: revealed ? true : null,
      ...(revealed ? { payload_utf8, salt_hex } : {}),
      demo_synthetic: true, // uydurma tx: UI bu döngüleri Fuji'de aramaz
    });
  }
}

// Gerçek Fuji döngüsü (agentId 1, cycle 1): reveal tx calldata'sından çözüldü → UI zincirden uçtan uca doğrular.
const real = JSON.parse(readFileSync(new URL("../fixtures/fuji-cycle-1.json", import.meta.url), "utf8"));
const realPayload = JSON.parse(real.payload_utf8);
const realOrders = JSON.parse(real.okx_order_id_map || "{}");
for (const d of realPayload.decisions) {
  const traded = d.action !== "HOLD";
  decisions.push({
    cycle_id: real.cycle_id, inst_id: d.inst_id, action: d.action, size_usdt: d.size_usdt, ref_price: d.ref_price,
    target_weight_pct: d.target_weight_pct, reason: d.reason, llm_note: d.llm_note, llm_flag: d.llm_flag,
    decided_at_ms: realPayload.decided_at_ms, mode: realPayload.mode, dry_run: realPayload.dry_run,
    commit_tx: real.commit_tx, commit_hash: real.commit_hash,
    okx_order_id: traded ? (realOrders[d.inst_id] === "simulated" ? `sim-${real.cycle_id}-${d.inst_id}` : realOrders[d.inst_id] ?? null) : null,
    order_status: traded ? (realOrders[d.inst_id] === "simulated" ? "simulated" : "unknown") : "none",
    fill_price: traded ? d.ref_price : null,
    reveal_tx: real.reveal_tx, verified: true, payload_utf8: real.payload_utf8, salt_hex: real.salt_hex,
  });
}

const corrLabels = ["BTC-USDT", "ETH-USDT", "SOL-USDT", "AVAX-USDT", "OKB-USDT"];
const corrValues = [
  [1, 0.82, 0.71, 0.68, 0.55],
  [0.82, 1, 0.74, 0.7, 0.52],
  [0.71, 0.74, 1, 0.77, 0.46],
  [0.68, 0.7, 0.77, 1, 0.44],
  [0.55, 0.52, 0.46, 0.44, 1],
];
const rho = 0.639;
const sr1 = 0.5;
const neff = (n) => 1 / (1 / n + (1 - 1 / n) * rho);

const state = {
  contract_version: "0.6",
  generated_at_ms: T0 + 1500,
  mode: "live",
  dry_run: true,
  agent: { name: agent, status: "running", cycle_id: 12, next_cycle_at_ms: T0 + 90_000 },
  config: {
    coins: corrLabels, risk_budget_pct: 10, max_position_pct: 30, cycle_seconds: 90, candle_bar: "1H", lookback_bars: 48,
    target_vol_pct: 20, max_order_usdt: "10", min_order_usdt: "2", max_total_deploy_usdt: "50", kill_switch_drawdown_pct: 5, okx_site: "tr",
  },
  market: corrLabels.map((inst_id) => ({ inst_id, last: String(price[inst_id]), change_24h_pct: trend[inst_id] * 0.7, at_ms: T0 })),
  portfolio: {
    equity_usdt: "100.00", cash_usdt: "86.03",
    positions: [
      { inst_id: "BTC-USDT", size_base: "0.000148", value_usdt: "9.95", weight_pct: 9.95 },
      { inst_id: "ETH-USDT", size_base: "0.00154", value_usdt: "4.02", weight_pct: 4.02 },
    ],
  },
  metrics: {
    avg_corr: rho, n_assets: 5, n_eff: Number(neff(5).toFixed(4)), sr_single_assumed: sr1,
    sr_portfolio_est: Number((sr1 * Math.sqrt(neff(5))).toFixed(4)),
    holy_grail_curve: [1, 2, 3, 5, 10, 20].map((n) => ({ n, sr: Number((sr1 * Math.sqrt(neff(n))).toFixed(4)) })),
    corr_matrix: { labels: corrLabels, values: corrValues },
    hrp_weights_pct: hrp, target_weights_pct: tw, trend_pct: trend, vol_pct: vol,
    portfolio_vol_raw_pct: 41.3, portfolio_vol_pct: 18.5, psr: 0.71, psr_basis: "hrp_all_valid_in_sample",
    window_bars: 48, drawdown_pct: 0.8, kill_switch: false,
    // T-014 shape (engine fixture pending): per-coin Hurst regime + breakout/retest setup
    signals: {
      "BTC-USDT": { hurst: 0.61, regime: "trending", setup: "retest" },
      "ETH-USDT": { hurst: 0.57, regime: "trending", setup: "breakout" },
      "SOL-USDT": { hurst: 0.42, regime: "ranging", setup: "none" },
      "AVAX-USDT": { hurst: 0.51, regime: "unclear", setup: "breakout" },
      "OKB-USDT": { hurst: 0.44, regime: "ranging", setup: "none" },
    },
  },
  decisions: decisions.reverse(),
  chain: {
    network: "fuji", chain_id: 43113, address: "0x1B5fcf6DeFf2F9375338A2C35932224522118851", explorer: "https://testnet.snowtrace.io",
    agent_id: "1", identity_registry: "0x120A4E53A24ddd09991633b4Cb88c3feA6166721",
    commits: 5, reveals: 4, unrevealed: 1,
  },
  errors: [
    { code: "ATK_TIMEOUT", message: "ticker timeout, döngü atlandı", at_ms: T0 - 400_000, where: "agents.market", context: {} },
  ],
  future_field_from_v0_5: { note: "UI bilinmeyen alanda çökmemeli" },
};

writeFileSync(new URL("../fixtures/demo-state.json", import.meta.url), JSON.stringify(state, null, 2) + "\n");
console.log("fixtures/demo-state.json yazıldı:", decisions.length, "karar");
