"""Centralized JSON Schemas for response_format constraints.

LLM nodes pass these schemas to AIHubClient.chat(response_format=...) ONLY for
models that reliably honour the constraint. Qwen-Thinking variants
(qwen-3.5*, qwen-3.6*) have a known bug where the schema is applied to
reasoning_content instead of the final content stream, leaving content empty:
- https://github.com/lmstudio-ai/lmstudio-bug-tracker/issues/1773
- https://huggingface.co/Qwen/Qwen3.5-35B-A3B/discussions/18

For those models we skip response_format entirely and rely on the json_extract
parser. For OpenAI-family models (gpt-oss, gpt-4*) the schema works as expected.

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


def model_supports_response_format(model: str) -> bool:
    """Returns True iff `model` reliably honours response_format=json_schema.

    Known broken (skip response_format):
      - qwen-3.5* / qwen-3.6* (Qwen-Thinking variants)
      - qwen3-coder-480b (passes thinking-mode params, see aihub_client.py)

    Known working (apply response_format):
      - gpt-oss-* (OpenAI Open-Weights; structured output is native)
      - gpt-4* / gpt-3* / gpt-5* (OpenAI Azure)

    Conservative default for unknown models: False (skip schema, use parser).
    """
    if model.startswith("gpt-oss"):
        return True
    if model.startswith(("gpt-4", "gpt-3", "gpt-5", "o3-", "o4-")):
        return True
    return False


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
