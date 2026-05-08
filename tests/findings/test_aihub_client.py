"""Tests for AI Hub client (LiteLLM-Proxy)."""
from __future__ import annotations
from unittest.mock import patch, MagicMock
import pytest
from findings.lib.aihub_client import AIHubClient, AIHubError


def test_client_uses_official_qwen3_thinking_params():
    """D16/Spec 4.0: Qwen3 thinking mode requires temp=0.6, top_p=0.95, top_k=20."""
    client = AIHubClient(api_key="sk-test")

    with patch("findings.lib.aihub_client.requests.post") as mock_post:
        mock_post.return_value.ok = True
        mock_post.return_value.json.return_value = {
            "choices": [{"message": {"content": "ok"}}],
            "usage": {"prompt_tokens": 10, "completion_tokens": 5, "total_tokens": 15},
        }

        client.chat(
            model="qwen-3.5-122b-sovereign",
            messages=[{"role": "user", "content": "test"}],
            max_tokens=100,
        )

        call_kwargs = mock_post.call_args.kwargs
        payload = call_kwargs["json"]
        assert payload["temperature"] == 0.6
        assert payload["top_p"] == 0.95
        assert payload["top_k"] == 20
        assert payload["extra_body"]["enable_thinking"] is True


def test_client_uses_qwen3_coder_higher_temp():
    """Spec 4.0: qwen3-coder uses temp=1.0."""
    client = AIHubClient(api_key="sk-test")

    with patch("findings.lib.aihub_client.requests.post") as mock_post:
        mock_post.return_value.ok = True
        mock_post.return_value.json.return_value = {
            "choices": [{"message": {"content": "ok"}}],
            "usage": {"prompt_tokens": 10, "completion_tokens": 5, "total_tokens": 15},
        }

        client.chat(
            model="qwen3-coder-480b",
            messages=[{"role": "user", "content": "test"}],
            max_tokens=100,
        )

        payload = mock_post.call_args.kwargs["json"]
        assert payload["temperature"] == 1.0


def test_client_raises_on_401():
    client = AIHubClient(api_key="sk-bad")

    with patch("findings.lib.aihub_client.requests.post") as mock_post:
        mock_post.return_value.ok = False
        mock_post.return_value.status_code = 401
        mock_post.return_value.text = "Unauthorized"

        with pytest.raises(AIHubError, match="401"):
            client.chat(
                model="qwen-3.5-122b-sovereign",
                messages=[{"role": "user", "content": "test"}],
                max_tokens=100,
            )


def test_client_returns_content_and_usage():
    client = AIHubClient(api_key="sk-test")

    with patch("findings.lib.aihub_client.requests.post") as mock_post:
        mock_post.return_value.ok = True
        mock_post.return_value.json.return_value = {
            "choices": [{"message": {"content": "Hello"}}],
            "usage": {"prompt_tokens": 5, "completion_tokens": 1, "total_tokens": 6},
        }

        result = client.chat(
            model="qwen-3.5-122b-sovereign",
            messages=[{"role": "user", "content": "test"}],
            max_tokens=10,
        )

        assert result["content"] == "Hello"
        assert result["tokens_in"] == 5
        assert result["tokens_out"] == 1


def test_chat_passes_response_format_when_set():
    """Phase A: response_format must be forwarded verbatim to the gateway when supplied."""
    client = AIHubClient(api_key="sk-test")
    schema = {
        "type": "json_schema",
        "json_schema": {
            "name": "test_schema",
            "schema": {"type": "object", "properties": {"x": {"type": "integer"}}},
        },
    }

    with patch("findings.lib.aihub_client.requests.post") as mock_post:
        mock_post.return_value.ok = True
        mock_post.return_value.json.return_value = {
            "choices": [{"message": {"content": "{\"x\":1}"}}],
            "usage": {"prompt_tokens": 1, "completion_tokens": 1, "total_tokens": 2},
        }

        client.chat(
            model="gpt-oss-120b-sovereign",
            messages=[{"role": "user", "content": "test"}],
            max_tokens=10,
            response_format=schema,
        )

        payload = mock_post.call_args.kwargs["json"]
        assert payload["response_format"] == schema


def test_chat_omits_response_format_when_not_set():
    """Phase A: response_format key must NOT appear in payload when caller omits it."""
    client = AIHubClient(api_key="sk-test")

    with patch("findings.lib.aihub_client.requests.post") as mock_post:
        mock_post.return_value.ok = True
        mock_post.return_value.json.return_value = {
            "choices": [{"message": {"content": "ok"}}],
            "usage": {"prompt_tokens": 1, "completion_tokens": 1, "total_tokens": 2},
        }

        client.chat(
            model="qwen-3.5-122b-sovereign",
            messages=[{"role": "user", "content": "test"}],
            max_tokens=10,
        )

        payload = mock_post.call_args.kwargs["json"]
        assert "response_format" not in payload
