"""Deterministic code patcher — foundation layer for the plan/apply/review DAG.

LLM produces structured change operations; this module applies them atomically
to source file content (pure string-in / string-out, no I/O).

Supported operations (field "typ"):
  replace_text       — find exact unique substring and replace it
  replace_lines      — replace lines [line_from, line_to] (1-indexed, inclusive)
  insert_before_line — insert text before line N (1-indexed)
  insert_after_line  — insert text after line N (1-indexed)
  delete_lines       — delete lines [line_from, line_to] (1-indexed, inclusive)
  append_to_file     — append text at end of file
  prepend_to_file    — prepend text at start of file

Atomicity guarantee: if any single operation fails, the entire patch is
rejected and new_content is None.  No partial changes are returned.
"""

from __future__ import annotations

from dataclasses import dataclass, field


# ---------------------------------------------------------------------------
# Public data types
# ---------------------------------------------------------------------------

@dataclass
class PatchResult:
    success: bool
    new_content: str | None   # None when success is False
    applied: int              # number of operations successfully applied
    errors: list[str]         # human-readable failure messages
    warnings: list[str]       # non-fatal notes


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _split_lines(content: str) -> list[str]:
    """Split file content into lines, preserving line endings on each element.

    The last line may lack a trailing newline — that is intentional.
    Recombining with ''.join(lines) must reproduce the original content exactly.
    """
    # str.splitlines(keepends=True) handles \\n, \\r\\n, \\r correctly.
    # An empty string returns [], but we need to distinguish "" from "\\n":
    # for our purposes the round-trip property ''.join(splitlines(True)) == s
    # holds for all inputs, which is what we need.
    return content.splitlines(keepends=True)


def _join_lines(lines: list[str]) -> str:
    return "".join(lines)


def _check_line_bounds(
    op_name: str,
    line_from: int,
    line_to: int,
    total_lines: int,
    file_path: str,
) -> str | None:
    """Return an error string if the range is invalid, else None."""
    if line_from < 1:
        return (
            f"{op_name}: line_from={line_from} is below 1 "
            f"(file has {total_lines} lines) in {file_path}"
        )
    if line_to < line_from:
        return (
            f"{op_name}: line_to={line_to} < line_from={line_from} "
            f"(inverted range) in {file_path}"
        )
    if line_to > total_lines:
        return (
            f"{op_name}: line_to={line_to} exceeds file length "
            f"({total_lines} lines) in {file_path}"
        )
    return None


# ---------------------------------------------------------------------------
# Operation implementations — each returns (new_lines, warning | None)
# or raises ValueError on failure.
# ---------------------------------------------------------------------------

def _op_replace_text(
    lines: list[str],
    change: dict,
    file_path: str,
) -> tuple[list[str], str | None]:
    find_str: str = change.get("find", "")
    replace_str: str = change.get("replace", "")

    if not find_str:
        raise ValueError(
            f"replace_text: 'find' is empty or missing in {file_path}"
        )

    content = _join_lines(lines)
    count = content.count(find_str)

    if count == 0:
        raise ValueError(
            f"replace_text: '{find_str[:80]}' found 0 times in {file_path}"
        )
    if count > 1:
        raise ValueError(
            f"replace_text: '{find_str[:80]}' found {count} times in {file_path} "
            f"(must be unique)"
        )

    new_content = content.replace(find_str, replace_str, 1)
    return _split_lines(new_content), None


def _op_replace_lines(
    lines: list[str],
    change: dict,
    file_path: str,
) -> tuple[list[str], str | None]:
    line_from: int = change.get("line_from")
    line_to: int = change.get("line_to")
    new_text: str = change.get("new_text", "")

    if line_from is None or line_to is None:
        raise ValueError(
            f"replace_lines: 'line_from' or 'line_to' missing in {file_path}"
        )

    err = _check_line_bounds("replace_lines", line_from, line_to, len(lines), file_path)
    if err:
        raise ValueError(err)

    # Convert to 0-indexed
    replacement_lines = _split_lines(new_text)
    new_lines = lines[: line_from - 1] + replacement_lines + lines[line_to:]
    return new_lines, None


def _op_insert_before_line(
    lines: list[str],
    change: dict,
    file_path: str,
) -> tuple[list[str], str | None]:
    line: int = change.get("line")
    text: str = change.get("text", "")

    if line is None:
        raise ValueError(f"insert_before_line: 'line' missing in {file_path}")

    total = len(lines)
    # Valid range: 1 .. total  (inserting before line 1 = prepend)
    # Inserting before line total+1 would be append — disallow to keep semantics clear.
    if line < 1 or line > total:
        raise ValueError(
            f"insert_before_line: line={line} out of range "
            f"[1, {total}] in {file_path}"
        )

    insert_lines = _split_lines(text)
    new_lines = lines[: line - 1] + insert_lines + lines[line - 1 :]
    return new_lines, None


def _op_insert_after_line(
    lines: list[str],
    change: dict,
    file_path: str,
) -> tuple[list[str], str | None]:
    line: int = change.get("line")
    text: str = change.get("text", "")

    if line is None:
        raise ValueError(f"insert_after_line: 'line' missing in {file_path}")

    total = len(lines)
    # Valid range: 1 .. total
    if line < 1 or line > total:
        raise ValueError(
            f"insert_after_line: line={line} out of range "
            f"[1, {total}] in {file_path}"
        )

    insert_lines = _split_lines(text)
    new_lines = lines[:line] + insert_lines + lines[line:]
    return new_lines, None


def _op_delete_lines(
    lines: list[str],
    change: dict,
    file_path: str,
) -> tuple[list[str], str | None]:
    line_from: int = change.get("line_from")
    line_to: int = change.get("line_to")

    if line_from is None or line_to is None:
        raise ValueError(
            f"delete_lines: 'line_from' or 'line_to' missing in {file_path}"
        )

    err = _check_line_bounds("delete_lines", line_from, line_to, len(lines), file_path)
    if err:
        raise ValueError(err)

    new_lines = lines[: line_from - 1] + lines[line_to:]
    return new_lines, None


def _op_append_to_file(
    lines: list[str],
    change: dict,
    file_path: str,
) -> tuple[list[str], str | None]:
    text: str = change.get("text", "")
    warning: str | None = None

    if not lines:
        # Empty file — just set content
        return _split_lines(text), None

    # Ensure the last existing line ends with a newline before appending
    if lines and not lines[-1].endswith(("\n", "\r")):
        lines = lines[:-1] + [lines[-1] + "\n"]
        warning = (
            f"append_to_file: added missing trailing newline before appending in {file_path}"
        )

    append_lines = _split_lines(text)
    return lines + append_lines, warning


def _op_prepend_to_file(
    lines: list[str],
    change: dict,
    file_path: str,
) -> tuple[list[str], str | None]:
    text: str = change.get("text", "")
    prepend_lines = _split_lines(text)
    return prepend_lines + lines, None


# ---------------------------------------------------------------------------
# Dispatch table
# ---------------------------------------------------------------------------

_HANDLERS = {
    "replace_text": _op_replace_text,
    "replace_lines": _op_replace_lines,
    "insert_before_line": _op_insert_before_line,
    "insert_after_line": _op_insert_after_line,
    "delete_lines": _op_delete_lines,
    "append_to_file": _op_append_to_file,
    "prepend_to_file": _op_prepend_to_file,
}


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def apply_changes(
    file_content: str,
    changes: list[dict],
    *,
    file_path: str = "<file>",
) -> PatchResult:
    """Apply a list of change operations to a file's content (in-memory).

    Each change dict has shape: {"typ": "<op>", ...op-specific fields}.

    Operations are applied in sequence; each step receives the result of
    the previous.  If ANY operation fails the whole patch is rejected
    (atomic all-or-nothing): success=False, new_content=None.

    Args:
        file_content: Current file content as a string.
        changes:      List of change operation dicts.
        file_path:    Used only in error/warning messages.

    Returns:
        PatchResult with success flag, resulting content, counters, and messages.
    """
    if not changes:
        return PatchResult(
            success=True,
            new_content=file_content,
            applied=0,
            errors=[],
            warnings=[],
        )

    # Work on a mutable list of lines throughout; handlers return new lists.
    current_lines: list[str] = _split_lines(file_content)
    all_warnings: list[str] = []

    for idx, change in enumerate(changes):
        typ: str = change.get("typ", "")
        handler = _HANDLERS.get(typ)

        if handler is None:
            known = ", ".join(sorted(_HANDLERS))
            return PatchResult(
                success=False,
                new_content=None,
                applied=idx,
                errors=[
                    f"op #{idx + 1}: unknown operation type '{typ}' "
                    f"(known: {known}) in {file_path}"
                ],
                warnings=all_warnings,
            )

        try:
            new_lines, warning = handler(current_lines, change, file_path)
        except ValueError as exc:
            return PatchResult(
                success=False,
                new_content=None,
                applied=idx,
                errors=[f"op #{idx + 1} ({typ}): {exc}"],
                warnings=all_warnings,
            )

        current_lines = new_lines
        if warning:
            all_warnings.append(warning)

    return PatchResult(
        success=True,
        new_content=_join_lines(current_lines),
        applied=len(changes),
        errors=[],
        warnings=all_warnings,
    )
