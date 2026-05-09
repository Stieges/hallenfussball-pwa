"""Tests for severity → model routing logic (Spec 4.2)."""
from __future__ import annotations
import pytest
from findings.lib.models import Severity, Finding, ModelChoice
from findings.lib.routing import route_finding_fix, parse_model_override


def _make_finding(severity: Severity, model_routing: str | None = None) -> Finding:
    return Finding(
        id="F-001",
        severity=severity,
        area="test",
        title="Test",
        file="src/test.ts",
        status="open",
        source="reviews/test.md",
        detected="2026-05-07",
        related=[],
        acceptance_criteria=["AK1"] if severity != Severity.LOW else [],
        model_routing=model_routing,
    )


def test_critical_routes_to_opus_with_human_review():
    f = _make_finding(Severity.CRITICAL)
    mc = route_finding_fix(f)
    assert mc.provider == "claude"
    assert mc.model == "opus-4-6"
    assert mc.require_human_review is True


def test_high_routes_to_sonnet():
    f = _make_finding(Severity.HIGH)
    mc = route_finding_fix(f)
    assert mc.provider == "claude"
    assert mc.model == "sonnet-4-6"
    assert mc.require_human_review is False


def test_medium_routes_to_sovereign_qwen():
    f = _make_finding(Severity.MEDIUM)
    mc = route_finding_fix(f)
    assert mc.provider == "aihub"
    assert mc.model == "qwen-3.5-122b-sovereign"


def test_low_routes_to_sovereign_qwen():
    f = _make_finding(Severity.LOW)
    mc = route_finding_fix(f)
    assert mc.provider == "aihub"
    assert mc.model == "qwen-3.5-122b-sovereign"


def test_explicit_override_wins():
    f = _make_finding(Severity.LOW, model_routing="claude-sonnet-4-6")
    mc = route_finding_fix(f)
    assert mc.model == "sonnet-4-6"


def test_parse_model_override():
    assert parse_model_override("claude-opus-4-6").provider == "claude"
    assert parse_model_override("qwen-3.5-122b-sovereign").provider == "aihub"
