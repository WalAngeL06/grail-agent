# grail-analyst (T-007) — "LLM hayır diyebilir, asla daha fazla risk diyemez"

Saf Python (sadece stdlib). Test: `cd engine && uv run pytest -q` (analyst testleri dahil, ağsız).
agents'tan kullanım: `agents/pyproject.toml` → `grail-analyst = { path = "../analyst", editable = true }` (uv sources).

```python
import os
from grail_analyst import make_provider, review_payload
provider = make_provider(os.environ)            # LLM_API_KEY yoksa None → analist atlanır
payload2 = review_payload(res["payload"], snapshot, news_items, cfg, provider)  # istisna fırlatmaz, en çok 8 sn
# payload2 AYNEN hash'lenir (commit) — llm_note/llm_flag zincire mühürlenir.
```

**Kural (kod zorlar, LLM çıktısından bağımsız)**
- Sadece BUY'lar LLM'e gider. SELL pozisyonu kapatır (riski azaltır) → her durumda aynen, `llm_flag: "exempt"`,
  `llm_note: "exempt: sell reduces exposure"` (SELL'i veto etmek/küçültmek pozisyonu açık bırakır = daha fazla risk).
- BUY: `action'` ∈ {`BUY`, `HOLD`}, ters yön → HOLD; HOLD asla emre dönmez; listede olmayan coin yok sayılır.
- BUY: `size_usdt' <= size_usdt` (kuruşa aşağı); büyük miktar → orijinal miktar (`[clamp: ...]` notu); `min_order_usdt` altı → HOLD.
- Sağlayıcı yok / timeout (`llm_timeout_s`, tavan 8 sn, daemon thread) / bozuk JSON / sağlayıcı hatası → kararlar aynen,
  `llm_flag: "skipped"`, `llm_note: "skipped: <no_provider|timeout|bad_json|provider_error>"`. Hiç BUY yoksa LLM çağrılmaz (`no_buys`).
- Şema dışı tek öğe (bilinmeyen action, negatif/NaN/bool size) → o karar aynen, `skipped`.

**Karara eklenen alanlar** (hash'e girer): `llm_note` (ASCII, tek satır, ≤160) · `llm_flag` ∈ `skipped | approved | reduced | vetoed | exempt`.

**Sağlayıcı**: Gemini (`generateContent`, JSON yanıt modu, temperature 0). Ortam: `LLM_API_KEY` (zorunlu),
`LLM_MODEL` (varsayılan `gemini-flash-latest`), `LLM_PROVIDER` (sadece `gemini`). Anahtar header'da (`x-goog-api-key`), URL'de/logda değil.
Haber girdisi: `[{"title", "source"}]` ya da string listesi (en çok 10). Prompt enjeksiyonu en kötü ihtimalle emri küçültür/durdurur.
