"""Sağlayıcı adaptörü: ağsız (urlopen sahte)."""
import io
import json

import pytest

from grail_analyst import providers
from grail_analyst.providers import GeminiProvider, make_provider


def test_make_provider_without_key_is_none():
    assert make_provider({}) is None
    assert make_provider({"LLM_API_KEY": "   "}) is None


def test_make_provider_with_key():
    p = make_provider({"LLM_API_KEY": "k123", "LLM_MODEL": "gemini-x"})
    assert isinstance(p, GeminiProvider) and p.model == "gemini-x"
    assert "k123" not in repr(p)


def test_make_provider_unknown_kind_is_none():
    assert make_provider({"LLM_API_KEY": "k", "LLM_PROVIDER": "nope"}) is None


class FakeResp(io.BytesIO):
    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False


def test_gemini_request_and_parse(monkeypatch):
    seen = {}

    def fake_urlopen(req, timeout):
        seen["url"], seen["timeout"] = req.full_url, timeout
        seen["headers"] = {k.lower(): v for k, v in req.header_items()}
        seen["body"] = json.loads(req.data)
        body = {"candidates": [{"content": {"parts": [{"text": '{"reviews": '}, {"text": "[]}"}]}}]}
        return FakeResp(json.dumps(body).encode())

    monkeypatch.setattr(providers.urllib.request, "urlopen", fake_urlopen)
    out = GeminiProvider("k123", model="gemini-x")("PROMPT", 5.0)
    assert out == '{"reviews": []}'
    assert "gemini-x:generateContent" in seen["url"] and "k123" not in seen["url"]
    assert seen["headers"]["x-goog-api-key"] == "k123"
    assert seen["timeout"] == 5.0
    assert seen["body"]["contents"][0]["parts"][0]["text"] == "PROMPT"
    assert seen["body"]["generationConfig"]["responseMimeType"] == "application/json"


def test_gemini_bad_response_raises(monkeypatch):
    monkeypatch.setattr(providers.urllib.request, "urlopen", lambda req, timeout: FakeResp(b'{"error": 1}'))
    with pytest.raises(Exception):
        GeminiProvider("k")("p", 1.0)
