// Display formatting (docs/ui-brief.md §0): money string → $ with 2 decimals, prices as given, *_pct → "24.9%".
const nf = (min: number, max: number) => new Intl.NumberFormat("en-US", { minimumFractionDigits: min, maximumFractionDigits: max });

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
  return v === undefined || v === null ? DASH : `${n(v, digits)}%`;
}

export function signedPct(v: number | undefined | null, digits = 1): string {
  if (v === undefined || v === null) return DASH;
  const s = v > 0 ? "+" : v < 0 ? "−" : "";
  return `${s}${n(Math.abs(v), digits)}%`;
}

/** Prices are shown as the agent wrote them (string), only grouped for readability. */
export function price(v: string | undefined): string {
  if (!v) return DASH;
  const [int, frac] = v.split(".");
  if (!/^-?\d+$/.test(int ?? "")) return v;
  return nf(0, 0).format(Number(int)) + (frac !== undefined ? `.${frac}` : "");
}

export function clock(ms?: number): string {
  if (ms === undefined) return DASH;
  return new Date(ms).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function dayClock(ms?: number): string {
  if (ms === undefined) return DASH;
  const d = new Date(ms);
  const today = new Date();
  const same = d.toDateString() === today.toDateString();
  return same ? clock(ms) : `${d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })} ${clock(ms)}`;
}

export function ago(ms: number | undefined, now: number): string {
  if (ms === undefined) return DASH;
  const d = Math.round((now - ms) / 1000);
  if (d < 0) return "just now";
  if (d < 60) return `${d}s ago`;
  if (d < 3600) return `${Math.floor(d / 60)}m ago`;
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`;
  return `${Math.floor(d / 86400)}d ago`;
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

export const coin = (inst?: string) => (inst ? inst.replace(/-USDT$/, "") : DASH);
