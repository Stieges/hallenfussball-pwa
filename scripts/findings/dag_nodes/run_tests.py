"""DAG node: run vitest (TS) or pytest (Py) and capture result."""
from __future__ import annotations
import subprocess
from pathlib import Path
from ..lib.models import FindingFixState


def run_tests(state: FindingFixState, *, repo_root: str | Path, timeout: int = 300) -> FindingFixState:
    """Run npm test (vitest) and/or pytest. Pass = both green (or only one configured)."""
    if not state.fix_applied:
        return state

    repo_root = Path(repo_root)
    cmds = []
    if (repo_root / "package.json").is_file():
        cmds.append(["npm", "test", "--", "--run"])
    if (repo_root / "pyproject.toml").is_file() or (repo_root / "pytest.ini").is_file():
        cmds.append(["python3", "-m", "pytest", "--quiet"])

    # Fallback: if no config files detected (e.g. in tests), try both runners.
    if not cmds:
        cmds = [["npm", "test", "--", "--run"]]

    all_pass = True
    output_chunks: list[str] = []
    for cmd in cmds:
        try:
            proc = subprocess.run(cmd, cwd=str(repo_root), capture_output=True, text=True, timeout=timeout)
            output_chunks.append(f"$ {' '.join(cmd)}\n{proc.stdout}{proc.stderr}")
            if proc.returncode != 0:
                all_pass = False
        except subprocess.TimeoutExpired:
            all_pass = False
            output_chunks.append(f"$ {' '.join(cmd)}\nTIMEOUT after {timeout}s")

    state.tests_pass = all_pass
    state.test_output = "\n\n".join(output_chunks)
    return state
