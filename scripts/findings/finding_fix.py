"""DAG orchestrator for /finding-fix.

Flow (Belegflow-pattern, Spec section 5.4):
  load_finding → verify_path → read_affected_files → judge_necessity
                                                      │
                                                      ▼
                                                 plan_changes  (LLM: structured operations)
                                                      │
                                                      ▼
                                                 apply_patch   (local, deterministic)
                                                      │
                                                      ▼
                                                 review_patch  (LLM: validate result)
                                                      │
                                              ┌───────┴───────┐
                                           APPROVED      REJECTED/NEEDS_HUMAN
                                              │                │
                                              ▼                ▼
                                         run_tests        (flag for human)
                                              │
                                         ┌───┴───┐
                                       pass     fail
                                         │       │
                                         ▼       ▼
                                   update_index  fallback?
                                                    │
                                                    ▼
                                            retry from plan_changes

Hard-Caps (R7): max_steps=10 internally, max_duration=300s (HARD_TIMEOUT_S).
The timeout is enforced via concurrent.futures.ThreadPoolExecutor — NOT signal.alarm,
because signal.alarm is Unix-only and interferes with pytest (which installs its own
SIGALRM handler). Python cannot forcibly kill a running thread, so a timed-out thread
will linger in the background until its LLM call returns; we abort the wait and move on.
"""
from __future__ import annotations
import concurrent.futures
import sys
import time
from pathlib import Path

from .lib.frontmatter import parse_frontmatter
from .lib.jsonl_logger import JsonlLogger
from .lib.models import Finding, FindingFixState, Severity, Status
from .lib.routing import route_finding_fix, fallback_for, ModelChoice
from .dag_nodes.verify_path import verify_path
from .dag_nodes.read_affected_files import read_affected_files
from .dag_nodes.judge_necessity import judge_necessity
from .dag_nodes.apply_fix import apply_fix  # kept for back-compat; no longer called from _run_dag
from .dag_nodes.plan_changes import plan_changes
from .dag_nodes.apply_patch import apply_patch
from .dag_nodes.review_patch import review_patch
from .dag_nodes.run_tests import run_tests
from .dag_nodes.update_index import update_finding_status, regenerate_index

LOG_PATH = Path(".claude/logs/finding-fixes.jsonl")
HARD_TIMEOUT_S = 300


def load_finding(finding_path: Path) -> Finding:
    fm, _body = parse_frontmatter(finding_path.read_text())
    return Finding(**fm)


def _run_dag(state: FindingFixState, *, repo_root: Path) -> FindingFixState:
    state = verify_path(state, repo_root=repo_root)
    if state.path_resolution_method == "failed":
        return state
    state = read_affected_files(state, repo_root=repo_root)
    state = judge_necessity(state)
    if not state.is_still_valid:
        return state
    # NEW: plan → patch → review (Belegflow-pattern, replaces single apply_fix call)
    state = plan_changes(state, repo_root=repo_root)
    if not state.planned_changes:
        return state  # plan failed
    state = apply_patch(state, repo_root=repo_root)
    if not state.fix_applied:
        return state  # patch ops failed (e.g., replace_text not unique)
    state = review_patch(state)
    if state.review_verdict != "APPROVED":
        # REJECTED or NEEDS_HUMAN: do NOT run tests, leave file as patched but flag for human
        return state
    state = run_tests(state, repo_root=repo_root)
    return state


def run_finding_fix(*, finding_id: str, findings_dir: Path, repo_root: Path) -> FindingFixState:
    finding_path = Path(findings_dir) / f"{finding_id}.md"
    finding = load_finding(finding_path)
    routing = route_finding_fix(finding)

    logger = JsonlLogger(repo_root / LOG_PATH)
    t0 = time.time()
    state = FindingFixState(finding=finding, routing=routing)

    timed_out = False
    try:
        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
            future = executor.submit(_run_dag, state, repo_root=repo_root)
            try:
                state = future.result(timeout=HARD_TIMEOUT_S)
            except concurrent.futures.TimeoutError:
                # Cannot kill the inner thread (Python limitation), but we abort the wait.
                # The lingering thread will eventually finish or be GCed when Python exits.
                timed_out = True
                state.tool_call_errors += 1
                state.is_still_valid = None
        # Auto-fallback on tool errors or red tests when sovereign was used.
        # Skip fallback entirely when the DAG timed out — a hard timeout means the LLM
        # is unresponsive; retrying immediately would just hang again.
        should_fallback = (
            not timed_out
            and (state.tool_call_errors > 0 or state.tests_pass is False)
            and routing.provider == "aihub"
        )
        if should_fallback:
            fb = fallback_for(routing)
            if fb:
                state.fallback_used = True
                state.routing = fb
                # Reset ALL partial state from the previous attempt so the
                # fallback log entry is clean and not misleadingly mixed with
                # stale values (e.g. review_verdict: APPROVED while fix_applied: False).
                state.planned_changes = []
                state.plan_analyse = None
                state.fix_applied = False
                state.tests_pass = None
                state.test_output = None
                state.tool_call_errors = 0  # reset for clean retry
                state.patched_content = None
                state.patch_errors = []
                state.patch_warnings = []
                state.review_verdict = None
                state.review_reasoning = None
                state = plan_changes(state, repo_root=repo_root)
                if state.planned_changes:
                    state = apply_patch(state, repo_root=repo_root)
                    if state.fix_applied:
                        state = review_patch(state)
                        if state.review_verdict == "APPROVED":
                            state = run_tests(state, repo_root=repo_root)

        # If finally green: mark fixed + commit (not done by DAG; user reviews and commits)
        if state.tests_pass:
            update_finding_status(finding_path, status=Status.FIXED)
            regenerate_index(findings_dir)
    finally:
        state.duration_ms = int((time.time() - t0) * 1000)
        logger.log({
            "finding_id": finding.id,
            "severity": finding.severity.value,
            "model": state.routing.model,
            "provider": state.routing.provider,
            "fix_applied": state.fix_applied,
            "tests_pass": state.tests_pass,
            "fallback_used": state.fallback_used,
            "tool_call_errors": state.tool_call_errors,
            "duration_ms": state.duration_ms,
            "path_resolution": state.path_resolution_method,
            # NEW: Belegflow-pattern fields
            "planned_changes_count": len(state.planned_changes),
            "patch_errors_count": len(state.patch_errors) if state.patch_errors else 0,
            "review_verdict": state.review_verdict,
        })

    return state


def main(argv: list[str] | None = None) -> int:
    argv = argv or sys.argv[1:]
    if len(argv) < 1:
        print("Usage: finding_fix.py F-001 [--findings-dir docs/findings]", file=sys.stderr)
        return 2
    fid = argv[0]
    findings_dir = Path(argv[2]) if len(argv) > 2 and argv[1] == "--findings-dir" else Path("docs/findings")
    repo_root = Path.cwd()

    result = run_finding_fix(finding_id=fid, findings_dir=findings_dir, repo_root=repo_root)
    print(f"\n--- Result for {fid} ---")
    print(f"Path-resolution: {result.path_resolution_method}")
    print(f"Judge says valid: {result.is_still_valid}")
    print(f"Planned changes count: {len(result.planned_changes)}")
    print(f"Patch errors: {result.patch_errors}")
    print(f"Review verdict: {result.review_verdict}")
    print(f"Fix applied: {result.fix_applied}")
    print(f"Tests pass: {result.tests_pass}")
    print(f"Fallback used: {result.fallback_used}")
    print(f"Duration: {result.duration_ms}ms")
    return 0 if result.tests_pass else 1


if __name__ == "__main__":
    raise SystemExit(main())
