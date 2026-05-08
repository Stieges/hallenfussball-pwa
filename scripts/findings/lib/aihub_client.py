"""AI Hub client (LiteLLM-Proxy) with model-specific sampling parameters.

Sampling defaults (Spec 4.0, validated 2026-05-07):
- qwen-3.5-122b-sovereign / qwen-3.6-35b-sovereign: temp=0.6, top_p=0.95, top_k=20, enable_thinking=True
- qwen3-coder-480b: temp=1.0, top_p=0.95, top_k=20, enable_thinking=True
- gpt-oss-120b-sovereign: temp=0.7, top_p=0.8, top_k=20 (to verify on first use)
"""
from __future__ import annotations
import os
from typing import List
import requests


DEFAULT_BASE_URL = "https://adesso-ai-hub.3asabc.de/v1"
DEFAULT_TIMEOUT = 600  # 10 min for thinking-mode

QWEN_THINKING_PARAMS = {"temperature": 0.6, "top_p": 0.95, "top_k": 20, "presence_penalty": 0.0}
QWEN_CODER_PARAMS = {"temperature": 1.0, "top_p": 0.95, "top_k": 20, "presence_penalty": 0.0}
GPT_OSS_PARAMS = {"temperature": 0.7, "top_p": 0.8, "top_k": 20, "presence_penalty": 0.0}


class AIHubError(Exception):
    """Raised when AI Hub returns non-2xx response."""


class AIHubClient:
    def __init__(self, api_key: str | None = None, base_url: str | None = None):
        self.api_key = api_key or os.environ.get("ADESSO_API_KEY") or os.environ.get("ADESSO_AI_HUB_API_KEY")
        if not self.api_key:
            raise ValueError("ADESSO_API_KEY environment variable not set")
        self.base_url = base_url or os.environ.get("ADESSO_AI_HUB_BASE_URL", DEFAULT_BASE_URL)

    def _params_for_model(self, model: str) -> dict:
        if model.startswith("qwen3-coder"):
            return {**QWEN_CODER_PARAMS, "extra_body": {"enable_thinking": True, "min_p": 0}}
        if model.startswith("qwen-3"):
            return {**QWEN_THINKING_PARAMS, "extra_body": {"enable_thinking": True, "min_p": 0}}
        if model.startswith("gpt-oss"):
            return {**GPT_OSS_PARAMS}
        # Conservative default
        return {"temperature": 0.6, "top_p": 0.95}

    def chat(self, model: str, messages: List[dict], max_tokens: int = 32000, timeout: int = DEFAULT_TIMEOUT) -> dict:
        """Send a chat completion request. Returns {content, tokens_in, tokens_out, raw}."""
        params = self._params_for_model(model)
        payload = {
            "model": model,
            "messages": messages,
            "max_tokens": max_tokens,
            **params,
        }
        resp = requests.post(
            f"{self.base_url}/chat/completions",
            headers={"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"},
            json=payload,
            timeout=timeout,
        )
        if not resp.ok:
            raise AIHubError(f"HTTP {resp.status_code}: {resp.text[:300]}")
        data = resp.json()
        msg = data["choices"][0]["message"]
        usage = data.get("usage", {})
        # Qwen-Thinking-Mode quirk: `content` may be None when the entire
        # response is a reasoning block. Normalise so callers always see a string,
        # and fall back to reasoning_content if content is empty/None.
        content = msg.get("content") or msg.get("reasoning_content") or ""
        thinking = msg.get("reasoning_content") or ""
        return {
            "content": content,
            "thinking": thinking,
            "tokens_in": usage.get("prompt_tokens", 0),
            "tokens_out": usage.get("completion_tokens", 0),
            "raw": data,
        }
