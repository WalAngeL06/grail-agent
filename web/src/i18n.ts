// UI language (EN | TR). Method and product names (Hurst, n_eff, HRP, PSR, Sharpe, commit, reveal, hash, keccak256, salt,
// dry run, kill switch, ERC-8004, GRAIL, OKX, Avalanche, Fuji, Snowtrace, BUY/SELL/HOLD) stay English in both languages.
// The agent's own `reason` texts are sealed on chain and are never translated.
import { useSyncExternalStore } from "react";

export type Lang = "en" | "tr";
const KEY = "grail.lang";

function load(): Lang {
  try {
    const v = window.localStorage.getItem(KEY);
    if (v === "en" || v === "tr") return v;
  } catch {
    /* private mode: default */
  }
  return "tr"; // final presentation is in Turkish
}

let current: Lang = typeof window === "undefined" ? "tr" : load();
const subs = new Set<() => void>();
if (typeof document !== "undefined") document.documentElement.lang = current;

export const getLang = (): Lang => current;
export const isTr = () => current === "tr";

export function setLang(l: Lang) {
  if (l === current) return;
  current = l;
  try {
    window.localStorage.setItem(KEY, l);
  } catch {
    /* private mode: just this visit */
  }
  document.documentElement.lang = l;
  subs.forEach((f) => f());
}

export function useLang(): Lang {
  return useSyncExternalStore(
    (f) => {
      subs.add(f);
      return () => subs.delete(f);
    },
    getLang,
    getLang,
  );
}

/** Inline pair: T("English", "Türkçe"). */
export const T = (en: string, tr: string): string => (current === "tr" ? tr : en);

/** Plural helper: P(n, "trade", "trades", "işlem"). Turkish nouns do not change after a number. */
export const P = (k: number, one: string, many: string, tr: string): string => (current === "tr" ? tr : k === 1 ? one : many);

// English strings produced outside the UI layer (verifyLogic, chain.ts) → Turkish. Prefix match keeps the technical tail.
const DICT: [string, string][] = [
  ["the decision text was edited", "karar metni değiştirildi"],
  ["browser fingerprint differs from the agent's file", "tarayıcıdaki parmak izi (hash) agent'ın dosyasındakinden farklı"],
  ["this check-in is not sealed on Avalanche", "bu check-in Avalanche'ta mühürlenmemiş"],
  ["browser fingerprint differs from the seal on Avalanche", "tarayıcıdaki parmak izi (hash) Avalanche'taki mühürden farklı"],
  ["the file says opened, Avalanche says not opened", "dosya açıldı diyor, Avalanche açılmadı diyor"],
  ["the sealed text is for another check-in", "mühürlü metin başka bir check-in'e ait"],
  ["the sealed text names another agent", "mühürlü metin başka bir agent'ı gösteriyor"],
  ["decisions on screen differ from the sealed text", "ekrandaki kararlar mühürlü metinden farklı"],
  ["demo check-in, not on Avalanche", "demo check-in, Avalanche'ta değil"],
  ["seal not checked: ", "mühür kontrol edilemedi: "],
  ["opening not checked: ", "açılış kontrol edilemedi: "],
  ["opening not checked", "açılış kontrol edilemedi"],
  ["reveal transaction not found", "reveal işlemi bulunamadı"],
  ["reveal receipt not found (pending or dropped)", "reveal makbuzu bulunamadı (bekliyor ya da düştü)"],
  ["reveal transaction failed (receipt status is not 1)", "reveal işlemi başarısız (receipt status 1 değil)"],
  ["no ledger address in chain.json", "chain.json içinde ledger adresi yok"],
  ["reveal went to another contract", "reveal başka bir kontrata gitmiş"],
  ["reveal is for agent ", "reveal başka bir agent için: "],
  ["reveal is for check-in ", "reveal başka bir check-in için: "],
  ["reveal was not sent by the agent wallet", "reveal agent cüzdanından gönderilmemiş"],
  ["no DecisionRevealed event for this agent and check-in", "bu agent ve check-in için DecisionRevealed event'i yok"],
  ["payload is not valid JSON", "payload geçerli JSON değil"],
];

/** Translate a known English sentence (or its known prefix) when the UI is Turkish; unknown text is returned as is. */
export function tx(s: string): string {
  if (current !== "tr" || !s) return s;
  for (const [en, tr] of DICT) {
    if (s === en) return tr;
    if (en.endsWith(" ") && s.startsWith(en)) return tr + s.slice(en.length);
  }
  return s;
}
