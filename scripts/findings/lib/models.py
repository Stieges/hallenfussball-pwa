"""Pydantic models for the findings backlog system.

Sources of truth:
- Spec section 3.2 (YAML Frontmatter Schema)
- Spec section 4.0 (Sampling parameters per model)
- Spec section 4.2 (Routing decision logic)
"""
from __future__ import annotations
from datetime import date
from enum import Enum
from typing import List, Literal, Optional
from pydantic import BaseModel, Field, model_validator


class Severity(str, Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class Status(str, Enum):
    OPEN = "open"
    IN_PROGRESS = "in-progress"
    FIXED = "fixed"
    ARCHIVED = "archived"
    WONTFIX = "wontfix"


class Verdict(str, Enum):
    BESTAETIGT = "bestätigt"
    WIDERSPRICHT = "widerspricht"
    NICHT_PRUEFBAR = "nicht_prüfbar"


class ModelChoice(BaseModel):
    provider: Literal["aihub", "claude"]
    model: str
    require_human_review: bool = False


class Finding(BaseModel):
    """Pro-Finding-File frontmatter as a typed model."""
    id: str = Field(pattern=r"^F-\d{3,}$")
    severity: Severity
    area: str
    title: str
    file: str
    lines: Optional[str] = None
    effort: Optional[str] = None
    status: Status = Status.OPEN
    source: str
    detected: date
    fixed_at: Optional[date] = None
    fixed_in_commit: Optional[str] = None
    related: List[str] = Field(default_factory=list)
    parent: Optional[str] = None
    model_routing: Optional[str] = None
    acceptance_criteria: List[str] = Field(default_factory=list)
    stale: bool = False  # Phase 0a: file changed since review

    @model_validator(mode="after")
    def validate_acceptance_criteria(self) -> "Finding":
        """D3: AKs Pflicht ab medium."""
        if self.severity in (Severity.CRITICAL, Severity.HIGH, Severity.MEDIUM):
            if not self.acceptance_criteria:
                raise ValueError(
                    f"Finding {self.id} with severity={self.severity.value} "
                    "requires acceptance_criteria (D3)"
                )
        return self


class FindingFixState(BaseModel):
    """State passed between DAG nodes in finding_fix.py.

    Each node reads needed fields, writes its outputs, returns updated state.
    """
    finding: Finding
    routing: ModelChoice
    # verify_path output:
    path_resolved: Optional[str] = None  # actual path (after symbol_search fallback)
    path_resolution_method: Optional[Literal["exact", "symbol_search", "failed"]] = None
    # read_affected_files output:
    file_contents: dict = Field(default_factory=dict)  # path → content
    # judge_necessity output:
    is_still_valid: Optional[bool] = None
    judge_reasoning: Optional[str] = None
    # apply_fix output (legacy — kept for backward compat):
    fix_applied: bool = False
    fix_diff: Optional[str] = None
    # plan_changes output:
    planned_changes: list = Field(default_factory=list)   # raw aenderungen list
    plan_analyse: Optional[str] = None                     # human-readable summary
    # apply_patch output:
    patch_warnings: list = Field(default_factory=list)
    patch_errors: list = Field(default_factory=list)
    patched_content: Optional[str] = None                  # new file content (for review LLM)
    # review_patch output:
    review_verdict: Optional[Literal["APPROVED", "REJECTED", "NEEDS_HUMAN"]] = None
    review_reasoning: Optional[str] = None
    # run_tests output:
    tests_pass: Optional[bool] = None
    test_output: Optional[str] = None
    # tracking
    tool_call_errors: int = 0
    fallback_used: bool = False
    duration_ms: int = 0
