"""Robust JSON extraction from LLM responses.

Handles the common wrappers that language models produce around JSON:
1. <think>...</think> blocks (Qwen-Thinking-Mode)
2. Markdown code fences: ```json ... ``` or ``` ... ```
3. Direct JSON object
4. First { to last } substring fallback

All callers (plan_changes, review_patch, apply_fix) should use this
helper to keep extraction logic in one place.
"""
from __future__ import annotations

import json
import re


def extract_json(raw: str) -> dict | None:
    """Extract the first JSON object from an LLM response string.

    Applies three fallbacks in order:
    1. Strip <think>...</think> blocks, then try markdown code-fence unwrap + direct parse.
    2. Direct JSON parse of the cleaned string.
    3. Balanced-brace substring: scan for first '{' to matching '}'.

    Returns the parsed dict, or None if no valid JSON object could be found.
    """
    if not raw:
        return None

    s = raw.strip()

    # --- Step 0: strip Qwen-Thinking <think>...</think> blocks ---
    s = re.sub(r"<think>.*?</think>", "", s, flags=re.DOTALL).strip()

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
