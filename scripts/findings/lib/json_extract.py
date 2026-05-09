"""Robust JSON extraction from LLM responses.

Handles the common wrappers that language models produce around JSON:
1. <think>...</think> blocks (Qwen-Thinking-Mode)
2. Prose-style thinking preambles (Qwen-3.6 leakage — see Recovery-2)
3. Markdown code fences: ```json ... ``` or ``` ... ```
4. Direct JSON object
5. First { to last } substring fallback

All callers (plan_changes, review_patch, apply_fix) should use this
helper to keep extraction logic in one place.
"""
from __future__ import annotations

import json
import re


def extract_json(raw: str) -> dict | None:
    """Extract the first JSON object from an LLM response string.

    Applies fallbacks in order:
    1. Strip <think>...</think> blocks (Qwen-Thinking).
    2. Strip prose-style thinking preambles (Qwen-3.6 leak; "Here's a thinking process:").
    3. Strip markdown code fences.
    4. Direct JSON parse of the cleaned string.
    5. Balanced-brace substring: scan for first '{' to matching '}'.

    Returns the parsed dict, or None if no valid JSON object could be found.
    """
    if not raw:
        return None

    s = raw.strip()

    # --- Step 0: strip Qwen-Thinking <think>...</think> blocks ---
    s = re.sub(r"<think>.*?</think>", "", s, flags=re.DOTALL).strip()

    # --- Step 0.5: strip prose-style thinking preambles ---
    # Qwen-3.6-35b-sovereign sometimes leaks chain-of-thought as plain prose
    # in the content field (HuggingFace Qwen3.5-35B-A3B Discussion #18).
    # Common starts: "Here's a thinking process:", "Let me think...", "Okay, so..."
    # Strategy: if content doesn't begin with `{`, `[`, or a markdown fence,
    # clip everything before the first `{` or `[`. Subsequent steps will then
    # try to parse the remainder.
    if s and s[0] not in "{[`":
        first_obj = s.find("{")
        first_arr = s.find("[")
        candidates = [c for c in (first_obj, first_arr) if c >= 0]
        if candidates:
            s = s[min(candidates):]

    # --- Step 1: strip markdown code fences ---
    # Handles ```json ... ```, ```JSON ... ```, ``` ... ```
    s = re.sub(r"^```[a-zA-Z]*\s*", "", s)
    s = re.sub(r"\s*```$", "", s).strip()

    # --- Step 2: try direct parse ---
    try:
        result = json.loads(s)
        if isinstance(result, dict):
            return result
    except json.JSONDecodeError:
        pass

    # --- Step 3: balanced-brace substring ---
    start = s.find("{")
    if start < 0:
        return None

    depth = 0
    for i in range(start, len(s)):
        c = s[i]
        if c == "{":
            depth += 1
        elif c == "}":
            depth -= 1
            if depth == 0:
                try:
                    result = json.loads(s[start : i + 1])
                    if isinstance(result, dict):
                        return result
                except json.JSONDecodeError:
                    return None

    return None
