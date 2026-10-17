// Display formatting (docs/ui-brief.md §0): money string → $ with 2 decimals, prices as given, *_pct → "24.9%".
import { isTr } from "./i18n";

// TR mode: decimal comma, dot grouping, "%" before the number (Turkish convention). EN mode unchanged.
const nf = (min: number, max: number) => new Intl.NumberFormat(isTr() ? "tr-TR" : "en-US", { minimumFractionDigits: min, maximumFractionDigits: max });
const loc = () => (isTr() ? "tr-TR" : "en-GB");
const pc = (num: string) => (isTr() ? `%${num}` : `${num}%`);

export const DASH = "—";

export function n(v: number | string | undefined | null, digits = 2, minDigits = 0): string {
  if (v === undefined || v === null || v === "") return DASH;
  const x = typeof v === "number" ? v : Number(v);
  return Number.isFinite(x) ? nf(minDigits, digits).format(x) : String(v);
}

export function usd(v: string | number | undefined | null): string {
  if (v === undefined || v === null || v === "") return DASH;
  const x = Number(v);
  return Number.isFinite(x) ? `${x < 0 ? "−" : ""}$${nf(2, 2).format(Math.abs(x))}` : String(v);
}

export function pct(v: number | undefined | null, digits = 1): string {
  return v === undefined || v === null ? DASH : pc(n(v, digits));
}

export function signedPct(v: number | undefined | null, digits = 1): string {
  if (v === undefined || v === null) return DASH;
  const s = v > 0 ? "+" : v < 0 ? "−" : "";
  return `${s}${pc(n(Math.abs(v), digits))}`;
}

/** Prices are shown as the agent wrote them (string), only grouped for readability. */
export function price(v: string | undefined): string {
  if (!v) return DASH;
  const [int, frac] = v.split(".");
  if (!/^-?\d+$/.test(int ?? "")) return v;
  return nf(0, 0).format(Number(int)) + (frac !== undefined ? `${isTr() ? "," : "."}${frac}` : "");
}

export function clock(ms?: number): string {
  if (ms === undefined) return DASH;
  return new Date(ms).toLocaleTimeString(loc(), { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function dayClock(ms?: number): string {
  if (ms === undefined) return DASH;
  const d = new Date(ms);
  const today = new Date();
  const same = d.toDateString() === today.toDateString();
  return same ? clock(ms) : `${d.toLocaleDateString(loc(), { day: "2-digit", month: "short" })} ${clock(ms)}`;
}

export function ago(ms: number | undefined, now: number): string {
  if (ms === undefined) return DASH;
  const d = Math.round((now - ms) / 1000);
  const tr = isTr();
  if (d < 0) return tr ? "az önce" : "just now";
  if (d < 60) return tr ? `${d} sn önce` : `${d}s ago`;
  if (d < 3600) return tr ? `${Math.floor(d / 60)} dk önce` : `${Math.floor(d / 60)}m ago`;
  if (d < 86400) return tr ? `${Math.floor(d / 3600)} sa önce` : `${Math.floor(d / 3600)}h ago`;
  return tr ? `${Math.floor(d / 86400)} gün önce` : `${Math.floor(d / 86400)}d ago`;
}

export function countdown(target: number | undefined, now: number): string | null {
  if (target === undefined) return null;
  const s = Math.round((target - now) / 1000);
  if (s <= 0) return null;
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function shortHash(h?: string, head = 6, tail = 4): string {
  if (!h) return DASH;
  return h.length > head + tail + 3 ? `${h.slice(0, head)}…${h.slice(-tail)}` : h;
}

/** R-007-6: never claim certainty from a 0-decimal percentage. */
export function psrText(psr: number | undefined | null): string {
  if (psr === undefined || psr === null) return DASH;
  if (psr >= 0.995) return `> ${pc("99")}`;
  if (psr < 0.005) return `< ${pc("1")}`;
  return pc(n(psr * 100, 0));
}

/** "last 48h" from lookback_bars × candle_bar (R-007-12). */
export function windowLabel(cfg: Record<string, unknown>, fallbackBars?: number): string {
  const bars = typeof cfg.lookback_bars === "number" ? cfg.lookback_bars : fallbackBars;
  const bar = typeof cfg.candle_bar === "string" ? cfg.candle_bar : "1H";
  const m = /^(\d+)([mHD])$/.exec(bar);
  if (!bars || !m) return isTr() ? "son fiyatlar" : "recent prices";
  const unit = m[2] === "m" ? 1 / 60 : m[2] === "H" ? 1 : 24;
  const hours = bars * Number(m[1]) * unit;
  if (isTr()) return hours > 72 && hours % 24 === 0 ? `son ${hours / 24} gün` : `son ${Math.round(hours)} saat`;
  return hours > 72 && hours % 24 === 0 ? `last ${hours / 24} days` : `last ${Math.round(hours)}h`;
}

export const coin = (inst?: string) => (inst ? inst.replace(/-USDT$/, "") : DASH);
