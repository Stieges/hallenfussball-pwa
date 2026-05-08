"""Tests for findings Pydantic models."""
from __future__ import annotations
import pytest
from datetime import date
from findings.lib.models import (
    Severity, Status, Verdict, Finding, ModelChoice, FindingFixState
)


def test_severity_values():
    assert Severity.CRITICAL.value == "critical"
    assert Severity.HIGH.value == "high"
    assert Severity.MEDIUM.value == "medium"
    assert Severity.LOW.value == "low"


def test_status_values():
    assert Status.OPEN.value == "open"
    assert Status.IN_PROGRESS.value == "in-progress"
    assert Status.FIXED.value == "fixed"
    assert Status.ARCHIVED.value == "archived"
    assert Status.WONTFIX.value == "wontfix"


def test_finding_from_dict(sample_finding_dict):
    f = Finding(**sample_finding_dict)
    assert f.id == "F-001"
    assert f.severity == Severity.HIGH
    assert f.status == Status.OPEN
    assert f.related == []
    assert f.parent is None


def test_finding_severity_default_routing(sample_finding_dict):
    f = Finding(**sample_finding_dict)
    assert f.severity == Severity.HIGH


def test_finding_acceptance_criteria_required_for_medium(sample_finding_dict):
    """D3: AKs Pflicht ab medium."""
    sample_finding_dict["severity"] = "medium"
    sample_finding_dict["acceptance_criteria"] = []
    with pytest.raises(ValueError, match="acceptance_criteria"):
        Finding(**sample_finding_dict)


def test_finding_acceptance_criteria_optional_for_low(sample_finding_dict):
    """D3: AKs optional bei low."""
    sample_finding_dict["severity"] = "low"
    sample_finding_dict["acceptance_criteria"] = []
    f = Finding(**sample_finding_dict)
    assert f.acceptance_criteria == []


def test_model_choice_for_critical():
    mc = ModelChoice(provider="claude", model="opus-4-6", require_human_review=True)
    assert mc.require_human_review is True
