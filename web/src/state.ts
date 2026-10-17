// state.json okuyucu. Sözleşme: contracts/state.example.json (v0.4).
// Kural: her alan opsiyonel, bilinmeyen alanlar yok sayılır, yanlış tip → undefined. Hiçbir şey fırlatmaz.
import { useEffect, useRef, useState } from "react";
import mockState from "../../contracts/state.example.json";

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const obj = (v: unknown): Obj => (isObj(v) ? v : {});
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown): string | undefined =>
  typeof v === "string" ? v : typeof v === "number" && Number.isFinite(v) ? String(v) : undefined;
const num = (v: unknown): number | undefined => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  return undefined;
};
const bool = (v: unknown): boolean | undefined => (typeof v === "boolean" ? v : undefined);
const numMap = (v: unknown): Record<string, number> => {
  const out: Record<string, number> = {};
  for (const [k, x] of Object.entries(obj(v))) {
    const n = num(x);
    if (n !== undefined) out[k] = n;
  }
  return out;
};

export type ErrorItem = { code?: string; message?: string; at_ms?: number; where?: string };
export type Decision = {
  key: string;
  cycle_id?: number;
  inst_id?: string;
  action?: string;
  size_usdt?: string;
  ref_price?: string;
  target_weight_pct?: number;
  reason?: string;
  llm_flag?: string;
  llm_note?: string;
  decided_at_ms?: number;
  dry_run?: boolean;
  mode?: string;
  commit_tx?: string;
  commit_hash?: string;
  okx_order_id?: string;
  order_status?: string;
  fill_price?: string;
  reveal_tx?: string;
  verified?: boolean;
  payload_utf8?: string;
  salt_hex?: string;
  /** web/fixtures only: synthetic demo cycle that was never sent to Fuji */
  synthetic?: boolean;
};
export type Position = { inst_id?: string; size_base?: string; value_usdt?: string; weight_pct?: number };
export type MarketRow = { inst_id?: string; last?: string; change_24h_pct?: number; at_ms?: number };

export type GrailState = {
  contract_version?: string;
  generated_at_ms?: number;
  mode?: string;
  dry_run?: boolean;
  agent: { name?: string; status?: string; cycle_id?: number; next_cycle_at_ms?: number };
  config: Obj;
  market: MarketRow[];
  portfolio: { equity_usdt?: string; cash_usdt?: string; positions: Position[] };
  metrics: {
    avg_corr?: number;
    n_assets?: number;
    n_eff?: number;
    sr_single_assumed?: number;
    sr_portfolio_est?: number;
    holy_grail_curve: { n: number; sr: number }[];
    corr: { labels: string[]; values: (number | null)[][] } | null;
    hrp_weights_pct: Record<string, number>;
    target_weights_pct: Record<string, number>;
    trend_pct: Record<string, number>;
    vol_pct: Record<string, number>;
    portfolio_vol_pct?: number;
    portfolio_vol_raw_pct?: number;
    psr?: number;
    drawdown_pct?: number;
    kill_switch?: boolean;
    window_bars?: number;
  };
  decisions: Decision[];
  chain: {
    network?: string;
    chain_id?: number;
    address?: string;
    explorer?: string;
    agent_id?: string;
    identity_registry?: string;
    /** v0.5: alan var ama null → kimlik henüz kayıtlı değil. Alan hiç yoksa undefined. */
    registered?: boolean;
    commits?: number;
    reveals?: number;
    unrevealed?: number;
  };
  errors: ErrorItem[];
};

export function normalize(raw: unknown): GrailState {
  const r = obj(raw);
  const agent = obj(r.agent);
  const pf = obj(r.portfolio);
  const m = obj(r.metrics);
  const ch = obj(r.chain);
  const cm = obj(m.corr_matrix);
  const labels = arr(cm.labels).map(str).filter((x): x is string => !!x);
  const values = arr(cm.values).map((row) => arr(row).map((x) => num(x) ?? null));
  return {
    contract_version: str(r.contract_version),
    generated_at_ms: num(r.generated_at_ms),
    mode: str(r.mode),
    dry_run: bool(r.dry_run),
    agent: {
      name: str(agent.name),
      status: str(agent.status),
      cycle_id: num(agent.cycle_id),
      next_cycle_at_ms: num(agent.next_cycle_at_ms),
    },
    config: obj(r.config),
    market: arr(r.market).map((x) => {
      const o = obj(x);
      return { inst_id: str(o.inst_id), last: str(o.last), change_24h_pct: num(o.change_24h_pct), at_ms: num(o.at_ms) };
    }),
    portfolio: {
      equity_usdt: str(pf.equity_usdt),
      cash_usdt: str(pf.cash_usdt),
      positions: arr(pf.positions).map((x) => {
        const o = obj(x);
        return { inst_id: str(o.inst_id), size_base: str(o.size_base), value_usdt: str(o.value_usdt), weight_pct: num(o.weight_pct) };
      }),
    },
    metrics: {
      avg_corr: num(m.avg_corr),
      n_assets: num(m.n_assets),
      n_eff: num(m.n_eff),
      sr_single_assumed: num(m.sr_single_assumed),
      sr_portfolio_est: num(m.sr_portfolio_est),
      holy_grail_curve: arr(m.holy_grail_curve)
        .map((x) => ({ n: num(obj(x).n), sr: num(obj(x).sr) }))
        .filter((p): p is { n: number; sr: number } => p.n !== undefined && p.sr !== undefined),
      corr: labels.length && values.length ? { labels, values } : null,
      hrp_weights_pct: numMap(m.hrp_weights_pct),
      target_weights_pct: numMap(m.target_weights_pct),
      trend_pct: numMap(m.trend_pct),
      vol_pct: numMap(m.vol_pct),
      portfolio_vol_pct: num(m.portfolio_vol_pct),
      portfolio_vol_raw_pct: num(m.portfolio_vol_raw_pct),
      psr: num(m.psr),
      drawdown_pct: num(m.drawdown_pct),
      kill_switch: bool(m.kill_switch),
      window_bars: num(m.window_bars),
    },
    decisions: arr(r.decisions).map((x, i) => {
      const o = obj(x);
      return {
        key: `${str(o.cycle_id) ?? "?"}-${str(o.inst_id) ?? "?"}-${i}`,
        cycle_id: num(o.cycle_id),
        inst_id: str(o.inst_id),
        action: str(o.action)?.toUpperCase(),
        size_usdt: str(o.size_usdt),
        ref_price: str(o.ref_price),
        target_weight_pct: num(o.target_weight_pct),
        reason: str(o.reason),
        llm_flag: str(o.llm_flag)?.toLowerCase(),
        llm_note: str(o.llm_note),
        decided_at_ms: num(o.decided_at_ms),
        dry_run: bool(o.dry_run),
        mode: str(o.mode),
        commit_tx: str(o.commit_tx),
        commit_hash: str(o.commit_hash),
        okx_order_id: str(o.okx_order_id),
        order_status: str(o.order_status),
        fill_price: str(o.fill_price),
        reveal_tx: str(o.reveal_tx),
        verified: bool(o.verified),
        payload_utf8: str(o.payload_utf8),
        salt_hex: str(o.salt_hex),
        synthetic: o.demo_synthetic === true ? true : undefined,
      };
    }),
    chain: {
      network: str(ch.network),
      chain_id: num(ch.chain_id),
      address: str(ch.address),
      explorer: str(ch.explorer),
      agent_id: str(ch.agent_id ?? ch.agentId ?? ch.erc8004_agent_id),
      identity_registry: str(ch.identity_registry ?? ch.identityRegistry),
      registered: "agent_id" in ch ? str(ch.agent_id) !== undefined : undefined,
      commits: num(ch.commits),
      reveals: num(ch.reveals),
      unrevealed: num(ch.unrevealed),
    },
    errors: arr(r.errors).map((x) => {
      const o = obj(x);
      return { code: str(o.code), message: str(o.message), at_ms: num(o.at_ms), where: str(o.where) };
    }),
  };
}

/** Bir döngünün bütün kararları tek payload / tek commit'tir (contracts/decision.md); zincir alanları grubun ilk dolu satırından. */
export type Cycle = {
  id: string;
  cycle_id?: number;
  decisions: Decision[];
  decided_at_ms?: number;
  commit_tx?: string;
  reveal_tx?: string;
  commit_hash?: string;
  payload_utf8?: string;
  salt_hex?: string;
  verified?: boolean;
  dry_run?: boolean;
  trades: number;
  synthetic: boolean;
  /** read from GrailLedger event logs, not present in this state file */
  fromChain?: boolean;
};

export function groupCycles(s: GrailState): Cycle[] {
  const map = new Map<string, Decision[]>();
  for (const d of s.decisions) {
    const k = d.cycle_id !== undefined ? String(d.cycle_id) : "?";
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(d);
  }
  const first = <K extends keyof Decision>(ds: Decision[], k: K) => ds.find((d) => d[k] !== undefined && d[k] !== null)?.[k];
  return [...map.entries()]
    .map(([id, ds]) => ({
      id,
      cycle_id: ds[0].cycle_id,
      decisions: ds,
      decided_at_ms: first(ds, "decided_at_ms"),
      commit_tx: first(ds, "commit_tx"),
      reveal_tx: first(ds, "reveal_tx"),
      commit_hash: first(ds, "commit_hash"),
      payload_utf8: first(ds, "payload_utf8"),
      salt_hex: first(ds, "salt_hex"),
      verified: first(ds, "verified"),
      dry_run: decisionDryRun({ ...ds[0], payload_utf8: first(ds, "payload_utf8") }, s),
      trades: ds.filter((d) => d.action === "BUY" || d.action === "SELL").length,
      synthetic: ds.some((d) => d.synthetic),
    }))
    .sort((a, b) => (b.cycle_id ?? -1) - (a.cycle_id ?? -1));
}

/** Bir döngünün etkin dry_run bayrağı: karar → payload → state. */
export function decisionDryRun(d: Decision, s: GrailState): boolean | undefined {
  if (d.dry_run !== undefined) return d.dry_run;
  if (d.payload_utf8) {
    try {
      const p = JSON.parse(d.payload_utf8);
      if (typeof p?.dry_run === "boolean") return p.dry_run;
    } catch {
      /* payload JSON değilse state'e düş */
    }
  }
  return s.dry_run;
}

export type Source = "live" | "demo" | "mock" | "bundled";
export type Feed = {
  state: GrailState | null;
  source: Source | null;
  missingPath: string | null;
  loading: boolean;
  error: string | null;
  fetchedAt: number | null;
  chainJson: unknown;
};

const POLL_MS = 3000;

export function useGrailFeed(): Feed {
  const [feed, setFeed] = useState<Feed>({
    state: null,
    source: null,
    missingPath: null,
    loading: true,
    error: null,
    fetchedAt: null,
    chainJson: null,
  });
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    let timer: number | undefined;

    const tick = async () => {
      try {
        const res = await fetch("/api/state", { cache: "no-store" });
        if (!res.ok) throw new Error(`state request returned HTTP ${res.status}`);
        const text = await res.text();
        let raw: unknown;
        try {
          raw = JSON.parse(text);
        } catch {
          throw new Error("state.json is not valid JSON (possibly caught mid-write)");
        }
        const src = (res.headers.get("X-Grail-Source") as Source | null) ?? "mock";
        if (!alive.current) return;
        setFeed((f) => ({
          ...f,
          state: normalize(raw),
          source: src,
          missingPath: res.headers.get("X-Grail-Missing"),
          loading: false,
          error: null,
          fetchedAt: Date.now(),
        }));
      } catch (e) {
        if (!alive.current) return;
        const msg = e instanceof Error ? e.message : String(e);
        setFeed((f) =>
          f.state
            ? { ...f, loading: false, error: msg }
            : // Sunucu yoksa (ör. statik build) paketlenmiş örnek state ile aç.
              { ...f, state: normalize(mockState), source: "bundled", loading: false, error: msg, fetchedAt: Date.now() },
        );
      } finally {
        if (alive.current) timer = window.setTimeout(tick, POLL_MS);
      }
    };
    tick();

    fetch("/api/chain", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => alive.current && setFeed((f) => ({ ...f, chainJson: j })))
      .catch(() => undefined);

    return () => {
      alive.current = false;
      window.clearTimeout(timer);
    };
  }, []);

  return feed;
}
