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
# qwen3-coder-480b is AWS Bedrock-hosted (not sovereign). Bedrock rejects
# presence_penalty with HTTP 400 ("UnsupportedParamsError"). Sovereign-hosted
# Qwens accept presence_penalty natively but tolerate its absence too — so we
# just keep this set Bedrock-compatible.
QWEN_CODER_PARAMS = {"temperature": 1.0, "top_p": 0.95, "top_k": 20}
GPT_OSS_PARAMS = {"temperature": 0.7, "top_p": 0.8, "top_k": 20, "presence_penalty": 0.0}
GPT_OPENAI_PARAMS = {"temperature": 0.5, "top_p": 0.95, "presence_penalty": 0.0}


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
        if model.startswith("gpt-4") or model.startswith("gpt-3"):
            # OpenAI-style models (e.g. gpt-4.1-mini): no Qwen extra_body params
            return {**GPT_OPENAI_PARAMS}
        # Conservative default (no provider-specific extra_body)
        return {"temperature": 0.6, "top_p": 0.95}

    def chat(
        self,
        model: str,
        messages: List[dict],
        max_tokens: int = 32000,
        timeout: int = DEFAULT_TIMEOUT,
        temperature_override: float | None = None,
        response_format: dict | None = None,
    ) -> dict:
        """Send a chat completion request. Returns {content, tokens_in, tokens_out, raw}.

        Args:
            model:               Model identifier.
            messages:            Chat messages list.
            max_tokens:          Token budget for the response.
            timeout:             HTTP request timeout in seconds.
            temperature_override: When set, replaces the model-default temperature.
                                  Use for nodes that require deterministic output
                                  (e.g. plan_changes at 0.3 instead of coder-default 1.0).
            response_format:     Optional structured-output constraint forwarded as-is to
                                 the LiteLLM gateway. Models that support it (qwen3-coder,
                                 gpt-oss, OpenAI gpt-4*) will enforce the schema; models
                                 without support fall back to free-form text and the
                                 caller's json_extract parser handles the output.
                                 Typical value: {"type": "json_schema", "json_schema": {...}}.
        """
        params = self._params_for_model(model)
        if temperature_override is not None:
            params = {**params, "temperature": temperature_override}
        payload = {
            "model": model,
            "messages": messages,
            "max_tokens": max_tokens,
            **params,
        }
        if response_format is not None:
            payload["response_format"] = response_format
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
