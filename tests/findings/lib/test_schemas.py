"""Tests for centralized JSON Schemas.

Validates structural correctness of every schema (jsonschema lib if available,
otherwise basic structural assertions). These tests catch invalid schema
definitions before they reach production LLM calls.
"""
from __future__ import annotations

from findings.lib.schemas import (
    PLAN_CHANGES_SCHEMA,
    REVIEW_PATCH_SCHEMA,
    JUDGE_NECESSITY_SCHEMA,
    EXTRACT_FINDINGS_SCHEMA_DRAFT,
    model_supports_response_format,
)


def _assert_response_format_envelope(schema: dict) -> None:
    """Each schema must follow the OpenAI response_format envelope."""
    assert schema["type"] == "json_schema"
    inner = schema["json_schema"]
    assert "name" in inner
    assert "schema" in inner
    inner_schema = inner["schema"]
    assert inner_schema["type"] == "object", "Top-level must be type=object"
    assert "properties" in inner_schema
    assert "required" in inner_schema


def test_plan_changes_schema_envelope():
    _assert_response_format_envelope(PLAN_CHANGES_SCHEMA)


def test_plan_changes_schema_has_required_fields():
    inner = PLAN_CHANGES_SCHEMA["json_schema"]["schema"]
    assert set(inner["required"]) == {"analyse", "aenderungen"}
    assert inner["properties"]["aenderungen"]["type"] == "array"


def test_plan_changes_operation_typ_enum_matches_code_patcher():
    """The typ enum in the schema must match the operations supported by code_patcher.py."""
    op = PLAN_CHANGES_SCHEMA["json_schema"]["schema"]["properties"]["aenderungen"]["items"]
    typ_values = set(op["properties"]["typ"]["enum"])
    expected = {
        "replace_text",
        "replace_lines",
        "insert_before_line",
        "insert_after_line",
        "delete_lines",
        "append_to_file",
        "prepend_to_file",
    }
    assert typ_values == expected


def test_review_patch_schema_envelope():
    _assert_response_format_envelope(REVIEW_PATCH_SCHEMA)


def test_review_patch_verdict_enum():
    inner = REVIEW_PATCH_SCHEMA["json_schema"]["schema"]
    verdicts = set(inner["properties"]["verdict"]["enum"])
    assert verdicts == {"APPROVED", "REJECTED", "NEEDS_HUMAN"}


def test_review_patch_required_fields():
    inner = REVIEW_PATCH_SCHEMA["json_schema"]["schema"]
    assert set(inner["required"]) == {"verdict", "reasoning", "concerns"}


def test_judge_necessity_schema_envelope():
    _assert_response_format_envelope(JUDGE_NECESSITY_SCHEMA)


def test_judge_necessity_required_fields():
    inner = JUDGE_NECESSITY_SCHEMA["json_schema"]["schema"]
    assert set(inner["required"]) == {"is_still_valid", "reasoning"}
    assert inner["properties"]["is_still_valid"]["type"] == "boolean"


def test_extract_findings_draft_envelope():
    """Draft schema isn't wired up yet, but must still be valid in case we enable it later."""
    _assert_response_format_envelope(EXTRACT_FINDINGS_SCHEMA_DRAFT)


def test_extract_findings_severity_enum_matches_models():
    """Severity enum in extract schema must match Severity enum values in lib/models.py."""
    from findings.lib.models import Severity
    op = EXTRACT_FINDINGS_SCHEMA_DRAFT["json_schema"]["schema"]["properties"]["findings"]["items"]
    severities = set(op["properties"]["severity"]["enum"])
    expected = {s.value for s in Severity}
    assert severities == expected


def test_model_supports_response_format_for_known_working():
    """OpenAI-family models (gpt-oss, gpt-4*, gpt-5*) reliably honour json_schema."""
    assert model_supports_response_format("gpt-oss-120b-sovereign") is True
    assert model_supports_response_format("gpt-4.1-mini") is True
    assert model_supports_response_format("gpt-4.1") is True
    assert model_supports_response_format("gpt-5") is True
    assert model_supports_response_format("gpt-5-mini") is True


def test_model_supports_response_format_skips_qwen_thinking():
    """Qwen-Thinking variants apply schema to reasoning_content (lmstudio#1773); skip."""
    assert model_supports_response_format("qwen-3.5-122b-sovereign") is False
    assert model_supports_response_format("qwen-3.6-35b-sovereign") is False
    assert model_supports_response_format("qwen3-coder-480b") is False


def test_model_supports_response_format_unknown_defaults_false():
    """Conservative default: unknown models skip schema enforcement."""
    assert model_supports_response_format("some-future-model") is False
    assert model_supports_response_format("") is False


def test_extract_findings_area_enum_is_complete():
    """area enum must cover all areas the extractor prompt instructs the LLM to use."""
    op = EXTRACT_FINDINGS_SCHEMA_DRAFT["json_schema"]["schema"]["properties"]["findings"]["items"]
    areas = set(op["properties"]["area"]["enum"])
    expected = {
        "architecture",
        "security",
        "data",
        "perf",
        "ux",
        "a11y",
        "testing",
        "doc",
        "other",
    }
    assert areas == expected
