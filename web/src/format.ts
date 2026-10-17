const nf = (min: number, max: number) => new Intl.NumberFormat("tr-TR", { minimumFractionDigits: min, maximumFractionDigits: max });

export const DASH = "—";

export function n(v: number | string | undefined | null, digits = 2, minDigits = 0): string {
  if (v === undefined || v === null || v === "") return DASH;
  const x = typeof v === "number" ? v : Number(v);
  return Number.isFinite(x) ? nf(minDigits, digits).format(x) : String(v);
}

export function usdt(v: string | number | undefined | null): string {
  return v === undefined || v === null || v === "" ? DASH : `${n(v, 2, 2)} USDT`;
}

export function pct(v: number | undefined | null, digits = 1): string {
  return v === undefined || v === null ? DASH : `%${n(v, digits)}`;
}

export function signedPct(v: number | undefined | null, digits = 1): string {
  if (v === undefined || v === null) return DASH;
  const s = v > 0 ? "+" : v < 0 ? "−" : "";
  return `${s}%${n(Math.abs(v), digits)}`;
}

export function price(v: string | undefined): string {
  if (!v) return DASH;
  const x = Number(v);
  if (!Number.isFinite(x)) return v;
  return n(x, x >= 1000 ? 1 : x >= 1 ? 3 : 6);
}

export function time(ms?: number): string {
  if (ms === undefined) return DASH;
  return new Date(ms).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function dateTime(ms?: number): string {
  if (ms === undefined) return DASH;
  return new Date(ms).toLocaleString("tr-TR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function ago(ms: number | undefined, now: number): string {
  if (ms === undefined) return DASH;
  const d = Math.round((now - ms) / 1000);
  if (d < 0) return `${-d} sn sonra`;
  if (d < 60) return `${d} sn önce`;
  if (d < 3600) return `${Math.floor(d / 60)} dk önce`;
  if (d < 86400) return `${Math.floor(d / 3600)} sa önce`;
  return `${Math.floor(d / 86400)} gün önce`;
}

export function shortHash(h?: string, head = 6, tail = 4): string {
  if (!h) return DASH;
  return h.length > head + tail + 3 ? `${h.slice(0, head)}…${h.slice(-tail)}` : h;
}

export const coin = (inst?: string) => (inst ? inst.replace(/-USDT$/, "") : DASH);
