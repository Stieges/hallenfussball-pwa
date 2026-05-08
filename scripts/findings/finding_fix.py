"""DAG orchestrator for /finding-fix.

Flow (Spec section 5.4):
  load_finding → verify_path → read_affected_files → judge_necessity
                                                      │
                                                      ▼
                                                 apply_fix
                                                      │
                                                      ▼
                                                 run_tests
                                                      │
                                                ┌─────┴─────┐
                                              pass         fail
                                                │           │
                                                ▼           ▼
                                          update_index   fallback?
                                                              │
                                                              ▼
                                                      retry with claude-haiku-4-5

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
from .dag_nodes.apply_fix import apply_fix
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
    state = apply_fix(state, repo_root=repo_root)
    if state.fix_applied:
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
                # Reset partial state and re-run from apply_fix
                state.fix_applied = False
                state.tests_pass = None
                state = apply_fix(state, repo_root=repo_root)
                if state.fix_applied:
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
    print(f"Fix applied: {result.fix_applied}")
    print(f"Tests pass: {result.tests_pass}")
    print(f"Fallback used: {result.fallback_used}")
    print(f"Duration: {result.duration_ms}ms")
    return 0 if result.tests_pass else 1


if __name__ == "__main__":
    raise SystemExit(main())
