"""review(): LLM, engine kararlarını sadece riski AZALTACAK yönde değiştirebilir (T-007).

Kod düzeyinde zorunlu kurallar (LLM ne derse desin):
- action' ∈ {action, HOLD}; BUY<->SELL dönüşümü yok, HOLD emre dönmez (ters yön → HOLD).
- size_usdt' <= size_usdt (kuruşa aşağı yuvarlı); min_order_usdt altına düşerse HOLD.
- Sağlayıcı yok / timeout / bozuk JSON / hata → kararlar aynen geçer, llm_flag "skipped". İstisna fırlatmaz.
Her karara `llm_note` (ASCII, <=160) ve `llm_flag` eklenir; payload'la birlikte zincire mühürlenir.
"""
from __future__ import annotations

import json
import re
import threading
import unicodedata
from decimal import ROUND_DOWN, Decimal, InvalidOperation

MAX_TIMEOUT_S = 8.0
NOTE_MAX = 160
NEWS_MAX = 10
CENT = Decimal("0.01")
ACTIONS = ("BUY", "SELL", "HOLD")

PROMPT = """You are the risk officer of an autonomous spot crypto trading agent.
A deterministic quant engine proposed the orders below. You may ONLY reduce risk:
approve an order, reduce its size_usdt, or veto it (action "HOLD"). You can never
increase size, flip BUY/SELL, or create new orders; such answers are ignored.
Veto or reduce only for a concrete reason (news, abnormal move, event risk).
Reply with JSON only, no prose:
{"reviews":[{"inst_id":"BTC-USDT","action":"BUY|SELL|HOLD","size_usdt":"<= proposed","note":"<=120 chars, English, why"}]}
One review per proposed order.

INPUT:
"""


def _cents(x: Decimal) -> Decimal:
    return x.quantize(CENT, rounding=ROUND_DOWN)


def _dec(x) -> Decimal | None:
    """Sonlu, >= 0 Decimal ya da None (bool/NaN/negatif/parse edilemez)."""
    if isinstance(x, bool) or not isinstance(x, (str, int, float)):
        return None
    try:
        d = Decimal(str(x).strip())
    except (InvalidOperation, ValueError):
        return None
    return d if d.is_finite() and d >= 0 else None


def _note(x) -> str:
    """Zincire girecek not: ASCII (JS/Python kanonik JSON aynı bayt), tek satır, kısa."""
    s = str(x) if isinstance(x, (str, int, float)) and not isinstance(x, bool) else ""
    s = s.replace("ı", "i").replace("İ", "I")
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode("ascii")
    s = re.sub(r"[\x00-\x1f\x7f]+", " ", s)
    return re.sub(r"\s+", " ", s).strip()[:NOTE_MAX]


def _is_decision(d) -> bool:
    return isinstance(d, dict) and isinstance(d.get("inst_id"), str) and d.get("action") in ACTIONS


def _mark(decisions: list, flag: str, note: str) -> list:
    return [{**d, "llm_note": note, "llm_flag": flag} if _is_decision(d) else d for d in decisions]


def _market_summary(snap) -> dict:
    """Son fiyat ve pencere değişimi (closes ya da OKX ham candles); okunamayan coin atlanır."""
    out = {}
    if not isinstance(snap, dict):
        return out
    series = {}
    if isinstance(snap.get("closes"), dict):
        series.update(snap["closes"])
    if isinstance(snap.get("candles"), dict):
        for inst, rows in snap["candles"].items():
            try:
                series.setdefault(inst, [r[4] for r in sorted(rows, key=lambda r: int(r[0]))])
            except (TypeError, ValueError, IndexError, KeyError):
                pass
    for inst, closes in series.items():
        try:
            vals = [float(c) for c in closes]
            if len(vals) >= 2 and vals[0] > 0:
                out[inst] = {"last": vals[-1], "bars": len(vals) - 1, "change_pct": round((vals[-1] / vals[0] - 1) * 100, 2)}
        except (TypeError, ValueError):
            pass
    return out


def _news(items) -> list:
    out = []
    for it in items if isinstance(items, list) else []:
        if isinstance(it, dict):
            t = it.get("title") or it.get("headline") or it.get("text")
            if isinstance(t, str) and t.strip():
                out.append({"title": t.strip()[:200], "source": str(it.get("source", ""))[:40]})
        elif isinstance(it, str) and it.strip():
            out.append({"title": it.strip()[:200]})
    return out[:NEWS_MAX]


def build_prompt(orders: list, snap, news) -> str:
    data = {
        "orders": [{k: d.get(k) for k in ("inst_id", "action", "size_usdt", "ref_price", "reason")} for d in orders],
        "market": _market_summary(snap),
        "news": _news(news),
    }
    return PROMPT + json.dumps(data, ensure_ascii=True, separators=(",", ":"))


def _call(provider, prompt: str, timeout_s: float):
    """Sağlayıcıyı daemon thread'de çağırır; en çok timeout_s bekler. Dönüş: (metin|None, hata kodu|None)."""
    box = {}

    def run():
        try:
            box["text"] = provider(prompt, timeout_s)
        except Exception:  # anahtar/URL içerebilir: mesaj loglanmaz, sadece kod döner
            box["err"] = "provider_error"

    t = threading.Thread(target=run, name="grail-analyst-llm", daemon=True)
    t.start()
    t.join(timeout_s)
    if t.is_alive():
        return None, "timeout"
    if "err" in box:
        return None, box["err"]
    return box.get("text"), None


def _parse(text) -> dict | None:
    """LLM metni → {inst_id: review dict}; şema dışıysa None."""
    if not isinstance(text, str):
        return None
    s = text.strip()
    m = re.match(r"^```(?:json)?\s*(.*?)\s*```$", s, re.S)
    if m:
        s = m.group(1)
    try:
        obj = json.loads(s)
    except (ValueError, RecursionError):
        return None
    if not isinstance(obj, dict) or not isinstance(obj.get("reviews"), list):
        return None
    reviews = obj["reviews"]
    if reviews and not all(isinstance(r, dict) for r in reviews):
        return None
    return {r["inst_id"]: r for r in reviews if isinstance(r.get("inst_id"), str)}


def _apply(d: dict, r: dict | None, min_o: Decimal) -> dict:
    """Tek karar + LLM önerisi → kısıtlanmış karar."""
    act = d["action"]
    if r is None:
        return {**d, "llm_note": "", "llm_flag": "skipped"}
    want = r.get("action")
    want = want.strip().upper() if isinstance(want, str) else None
    size_raw = r.get("size_usdt")
    want_size = None if size_raw is None else _dec(size_raw)
    if want not in ACTIONS or (size_raw is not None and want_size is None):
        return {**d, "llm_note": "", "llm_flag": "skipped"}
    note = _note(r.get("note"))
    if act == "HOLD":
        return {**d, "llm_note": note, "llm_flag": "approved"}
    hold = {**d, "action": "HOLD", "size_usdt": "0", "llm_flag": "vetoed"}
    if want == "HOLD":
        return {**hold, "llm_note": note}
    if want != act:
        return {**hold, "llm_note": _note(f"{note} [clamp: {want}->HOLD]")}
    size = _dec(d.get("size_usdt")) or Decimal(0)
    if want_size is None or want_size >= size:
        extra = f" [clamp: {want_size}->{d.get('size_usdt')}]" if want_size is not None and want_size > size else ""
        return {**d, "llm_note": _note(note + extra), "llm_flag": "approved"}
    new = _cents(want_size)
    if new < min_o:
        return {**hold, "llm_note": _note(f"{note} [below min {min_o}]")}
    return {**d, "size_usdt": format(new, "f"), "llm_note": note, "llm_flag": "reduced"}


def review(decisions, market_snapshot, news_items, cfg, provider=None) -> list:
    """Kararları LLM ile gözden geçir. Girdi değişmez; yeni liste döner. İstisna fırlatmaz.

    decisions: engine payload["decisions"] (contracts/decision.md karar nesneleri).
    provider: callable(prompt: str, timeout_s: float) -> str (JSON metin) | None → atla.
    cfg (ops.): min_order_usdt, llm_timeout_s (varsayılan ve tavan 8).
    """
    if not isinstance(decisions, list):
        return []
    decisions = list(decisions)
    try:
        cfg = cfg if isinstance(cfg, dict) else {}
        if provider is None:
            return _mark(decisions, "skipped", "skipped: no_provider")
        orders = [d for d in decisions if _is_decision(d) and d["action"] != "HOLD"]
        if not orders:  # ücretsiz kotayı harcama: değiştirilecek risk yok
            return _mark(decisions, "skipped", "skipped: no_orders")
        t = _dec(cfg.get("llm_timeout_s"))
        timeout_s = float(min(t, Decimal(str(MAX_TIMEOUT_S)))) if t and t > 0 else MAX_TIMEOUT_S
        text, err = _call(provider, build_prompt(orders, market_snapshot, news_items), timeout_s)
        if err:
            return _mark(decisions, "skipped", f"skipped: {err}")
        parsed = _parse(text)
        if parsed is None:
            return _mark(decisions, "skipped", "skipped: bad_json")
        min_o = _dec(cfg.get("min_order_usdt")) or Decimal(0)
        return [_apply(d, parsed.get(d["inst_id"]), min_o) if _is_decision(d) else d for d in decisions]
    except Exception:
        return _mark(decisions, "skipped", "skipped: analyst_error")


def review_payload(payload, market_snapshot, news_items, cfg, provider=None):
    """engine payload'ı → decisions'ı gözden geçirilmiş yeni payload (hash'lenecek nesne). payload dict değilse None."""
    if not isinstance(payload, dict):
        return None
    return {**payload, "decisions": review(payload.get("decisions"), market_snapshot, news_items, cfg, provider)}
