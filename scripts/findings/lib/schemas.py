"""Centralized JSON Schemas for response_format constraints.

LLM nodes pass these schemas to AIHubClient.chat(response_format=...) where the
underlying gateway/model supports it (gpt-oss-120b-sovereign, qwen3-coder, OpenAI
gpt-4*). Models without support (Qwen-Thinking variants in older vLLM configs)
fall back to free-form text and the json_extract parser handles the output.
This is the hybrid strategy: enforcement where possible, parser as safety net.

Reference: OpenAI Structured Outputs spec — response_format envelope is
    {"type": "json_schema", "json_schema": {"name": "...", "strict": True, "schema": {...}}}
The inner "schema" follows JSON Schema draft 2020-12 with restrictions:
- top-level must be type=object
- additionalProperties=false on every object
- all object properties listed under "required"

vLLM honours the same envelope via guided_json. For Qwen-Thinking models the
gateway needs --structured-outputs-config.enable_in_reasoning=True; if that
isn't set the gateway either honours response_format anyway, ignores it, or
returns 400. We accept all three: parser is the universal fallback.
"""
from __future__ import annotations


# ---------------------------------------------------------------------------
# Plan-Changes (DAG node: plan_changes)
# ---------------------------------------------------------------------------
# Output: {"analyse": str, "aenderungen": [{"typ": "<op>", ...op_fields}]}
# Operations follow code_patcher.py contract (7 atomic ops).

_PATCH_OPERATION = {
    "type": "object",
    "properties": {
        "typ": {
            "enum": [
                "replace_text",
                "replace_lines",
                "insert_before_line",
                "insert_after_line",
                "delete_lines",
                "append_to_file",
                "prepend_to_file",
            ],
        },
        # Optional fields used by various operation types — kept loose because
        # strict per-typ-discriminator (oneOf) breaks on some gateway impls.
        # The deterministic Python patcher validates per-typ at apply time.
        "find": {"type": "string"},
        "replace": {"type": "string"},
        "line": {"type": "integer"},
        "line_from": {"type": "integer"},
        "line_to": {"type": "integer"},
        "text": {"type": "string"},
        "new_text": {"type": "string"},
    },
    "required": ["typ"],
    "additionalProperties": False,
}

PLAN_CHANGES_SCHEMA = {
    "type": "json_schema",
    "json_schema": {
        "name": "plan_changes",
        "strict": False,
        "schema": {
            "type": "object",
            "properties": {
                "analyse": {"type": "string"},
                "aenderungen": {
                    "type": "array",
                    "items": _PATCH_OPERATION,
                },
            },
            "required": ["analyse", "aenderungen"],
            "additionalProperties": False,
        },
    },
}


# ---------------------------------------------------------------------------
# Review-Patch (DAG node: review_patch)
# ---------------------------------------------------------------------------
# Output: {"verdict": "APPROVED|REJECTED|NEEDS_HUMAN", "reasoning": str, "concerns": [str]}

REVIEW_PATCH_SCHEMA = {
    "type": "json_schema",
    "json_schema": {
        "name": "review_patch",
        "strict": True,
        "schema": {
            "type": "object",
            "properties": {
                "verdict": {"enum": ["APPROVED", "REJECTED", "NEEDS_HUMAN"]},
                "reasoning": {"type": "string"},
                "concerns": {
                    "type": "array",
                    "items": {"type": "string"},
                },
            },
            "required": ["verdict", "reasoning", "concerns"],
            "additionalProperties": False,
        },
    },
}


# ---------------------------------------------------------------------------
# Judge-Necessity (DAG node: judge_necessity)
# ---------------------------------------------------------------------------
# Output: {"is_still_valid": bool, "reasoning": str}

JUDGE_NECESSITY_SCHEMA = {
    "type": "json_schema",
    "json_schema": {
        "name": "judge_necessity",
        "strict": True,
        "schema": {
            "type": "object",
            "properties": {
                "is_still_valid": {"type": "boolean"},
                "reasoning": {"type": "string"},
            },
            "required": ["is_still_valid", "reasoning"],
            "additionalProperties": False,
        },
    },
}


# ---------------------------------------------------------------------------
# Extract-Findings (script: extract_findings.py)
# ---------------------------------------------------------------------------
# Output: array of finding objects.
#
# NOTE: OpenAI/vLLM structured-output requires top-level schema=object, not
# array. To enforce a schema here we'd have to wrap output in {findings: [...]}
# which is a behaviour change touching 160 existing findings on disk. Plus
# extract_findings uses qwen-3.5-122b-sovereign (Thinking-Mode) where
# response_format isn't reliably honoured anyway. Keep parser-only for now;
# the schema below is documentation of the expected shape only.

_FINDING_OBJECT = {
    "type": "object",
    "properties": {
        "severity": {"enum": ["critical", "high", "medium", "low"]},
        "area": {
            "enum": [
                "architecture",
                "security",
                "data",
                "perf",
                "ux",
                "a11y",
                "testing",
                "doc",
                "other",
            ],
        },
        "title": {"type": "string"},
        "file": {"type": "string"},
        "lines": {"type": "string"},
        "effort": {"type": "string"},
        "problem": {"type": "string"},
        "reproduction": {"type": "string"},
        "fix_proposal": {"type": "string"},
        "acceptance_criteria": {
            "type": "array",
            "items": {"type": "string"},
        },
    },
    "required": ["severity", "area", "title", "file", "problem"],
    "additionalProperties": False,
}

# Provided as a documentation/test artefact, not currently passed to AIHubClient.
EXTRACT_FINDINGS_SCHEMA_DRAFT = {
    "type": "json_schema",
    "json_schema": {
        "name": "extract_findings",
        "strict": False,
        "schema": {
            "type": "object",
            "properties": {
                "findings": {
                    "type": "array",
                    "items": _FINDING_OBJECT,
                },
            },
            "required": ["findings"],
            "additionalProperties": False,
        },
    },
}
