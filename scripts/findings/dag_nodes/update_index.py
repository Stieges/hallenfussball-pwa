"""DAG node: update INDEX.md and per-finding frontmatter after fix."""
from __future__ import annotations
import re
from datetime import date
from pathlib import Path
from ..lib.frontmatter import parse_frontmatter, write_frontmatter
from ..lib.models import Status


def update_finding_status(finding_path: str | Path, *, status: Status, commit_sha: str | None = None) -> None:
    """Rewrite a per-finding markdown file with new status + (optional) commit-sha."""
    p = Path(finding_path)
    fm, body = parse_frontmatter(p.read_text())
    fm["status"] = status.value
    if status == Status.FIXED:
        fm["fixed_at"] = date.today().isoformat()
        if commit_sha:
            fm["fixed_in_commit"] = commit_sha
    p.write_text(write_frontmatter(fm, body))


def regenerate_index(findings_dir: str | Path) -> None:
    """Rebuild INDEX.md from all F-*.md files in findings_dir."""
    findings_dir = Path(findings_dir)
    severity_icon = {"critical": "⚫", "high": "🔴", "medium": "🟠", "low": "🟡"}
    rows = ["| ID | Sev | Area | Title | File | Effort | Status |",
            "|----|-----|------|-------|------|--------|--------|"]
    for f_path in sorted(findings_dir.glob("F-*.md")):
        fm, _ = parse_frontmatter(f_path.read_text())
        rows.append(
            f"| {fm.get('id','?')} | {severity_icon.get(fm.get('severity','low'),'?')} | "
            f"{fm.get('area','?')} | {fm.get('title','?')} | {fm.get('file','?')} | "
            f"{fm.get('effort','-')} | {fm.get('status','open')} |"
        )
    (findings_dir / "INDEX.md").write_text("# Findings Backlog\n\n" + "\n".join(rows) + "\n")
