"""İnce LLM sağlayıcı adaptörü (stdlib urllib). Ağa sadece agent çalışırken, review() içinden çıkılır.

Sağlayıcı sözleşmesi: callable(prompt: str, timeout_s: float) -> str (modelin JSON metni); hata → istisna.
Anahtar sadece ortamdan (`.env` → LLM_API_KEY); URL'ye/loga yazılmaz.
"""
from __future__ import annotations

import json
import urllib.request

DEFAULT_MODEL = "gemini-flash-latest"
GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"


class GeminiProvider:
    def __init__(self, api_key: str, model: str = DEFAULT_MODEL):
        self._key = api_key
        self.model = model

    def __repr__(self):
        return f"GeminiProvider(model={self.model!r})"

    def __call__(self, prompt: str, timeout_s: float) -> str:
        body = {
            "contents": [{"role": "user", "parts": [{"text": prompt}]}],
            "generationConfig": {"responseMimeType": "application/json", "temperature": 0, "maxOutputTokens": 1024},
        }
        req = urllib.request.Request(
            GEMINI_URL.format(model=self.model),
            data=json.dumps(body).encode("utf-8"),
            headers={"Content-Type": "application/json", "x-goog-api-key": self._key},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=timeout_s) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        parts = data["candidates"][0]["content"]["parts"]
        return "".join(p.get("text", "") for p in parts)


def make_provider(env) -> GeminiProvider | None:
    """Ortamdan sağlayıcı; anahtar yoksa ya da LLM_PROVIDER bilinmiyorsa None (analist atlanır)."""
    key = (env.get("LLM_API_KEY") or "").strip()
    if not key:
        return None
    kind = (env.get("LLM_PROVIDER") or "gemini").strip().lower()
    if kind != "gemini":
        return None
    return GeminiProvider(key, (env.get("LLM_MODEL") or "").strip() or DEFAULT_MODEL)
