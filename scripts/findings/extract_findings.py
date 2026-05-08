"""Phase 1: Extract structured findings from bot review markdown.

Pattern: Map-Reduce-Manage (D13) — one bot-review = one batch of findings.
LLM extracts a JSON array, we validate and write per-finding files + update INDEX.

Sichtfeld-Klausel (D19): If the bot wrote 'fehlt komplett' or 'nicht im Code sichtbar',
the extractor must rewrite that as severity=low + tag 'requires_cross_check'.
"""
from __future__ import annotations
import json
import re
import sys
from datetime import date
from pathlib import Path
from typing import List

from .lib.aihub_client import AIHubClient
from .lib.frontmatter import write_frontmatter
from .lib.models import Finding, Severity, Status


_EXTRACTOR_SYSTEM_PROMPT = """Du bist ein Findings-Extractor. Aus einem Code-Review-Markdown
extrahierst du strukturierte Findings als JSON-Array.

PFLICHT: Antworte NUR mit einem JSON-Array, keine anderen Worte. Keine Erklärungen.

Pro Finding folgende Felder:
- severity: "critical" | "high" | "medium" | "low"
- area: "architecture" | "security" | "data" | "perf" | "ux" | "a11y" | "testing" | "doc" | "other"
- title: prägnanter Titel (max 80 Zeichen)
- file: Datei-Pfad relativ zum Repo-Root (z.B. "src/foo.ts")
- lines: optional, z.B. "42-58"
- effort: optional, z.B. "30m", "2h"
- problem: 1-2 Sätze
- reproduction: konkreter grep/test-Befehl
- fix_proposal: kurze Beschreibung
- acceptance_criteria: Liste von 2-4 prüfbaren Kriterien (Pflicht ab severity=medium)

KRITISCHE REGELN (D19, Sichtfeld):
- Wenn das Review schreibt "fehlt komplett" / "nicht im Code sichtbar" / "existiert nicht":
  setze severity="low" und füge ans Ende des problem-Feldes "[REQUIRES_CROSS_CHECK]" hinzu.
  Begründung: Bots haben begrenzte focus_dirs und können fälschlich "fehlt" sagen.

- Wenn das Review nur eine Score-Zahl liefert (z.B. "7.5/10"): KEIN Finding extrahieren.
- Wenn der Pfad nur ein Verzeichnis ist (z.B. "src/core/generators/"): KEIN Finding,
  weil zu vage.

KONSERVATIV einstufen:
- Severity=critical NUR bei Security-Lücken oder Datenverlust-Risiken
- "useRef ohne offensichtlichen Cleanup" → high, NICHT critical

OUTPUT: Pure JSON, mit `[` beginnen und `]` enden.
"""


def _next_finding_id(existing_ids: List[str]) -> str:
    """Return next ID like F-042."""
    nums = [int(re.match(r"F-(\d+)", x).group(1)) for x in existing_ids if re.match(r"F-(\d+)", x)]
    nxt = (max(nums) + 1) if nums else 1
    return f"F-{nxt:03d}"


def _call_llm_extract(review_text: str) -> str:
    """Call AI Hub for extraction. Separate function for testability (mockable)."""
    client = AIHubClient()
    msg = [
        {"role": "system", "content": _EXTRACTOR_SYSTEM_PROMPT},
        {"role": "user", "content": f"# Review-Markdown\n\n{review_text}"},
    ]
    result = client.chat(model="qwen-3.5-122b-sovereign", messages=msg, max_tokens=8000)
    return result["content"]


def extract_from_review(review_text: str, *, source: str, existing_ids: List[str] | None = None) -> List[Finding]:
    """Extract Finding objects from a single bot-review markdown."""
    existing_ids = existing_ids or []
    raw = _call_llm_extract(review_text)
    raw = raw.strip()
    # Strip code fences if LLM wrapped output
    raw = re.sub(r"^```(?:json)?\s*", "", raw)
    raw = re.sub(r"\s*```$", "", raw)
    items = json.loads(raw)

    findings: List[Finding] = []
    for item in items:
        fid = _next_finding_id(existing_ids + [f.id for f in findings])
        findings.append(Finding(
            id=fid,
            severity=Severity(item["severity"]),
            area=item["area"],
            title=item["title"],
            file=item["file"],
            lines=item.get("lines"),
            effort=item.get("effort"),
            status=Status.OPEN,
            source=source,
            detected=date.today(),
            related=[],
            parent=None,
            model_routing=None,
            acceptance_criteria=item.get("acceptance_criteria", []),
        ))
    return findings


def existing_finding_ids(findings_dir: Path) -> List[str]:
    """Return all F-XXX IDs already on disk in findings_dir."""
    findings_dir = Path(findings_dir)
    return [fp.stem for fp in findings_dir.glob("F-*.md")]


def write_finding_files(findings: List[Finding], *, findings_dir: Path) -> None:
    """Write per-finding markdown files and rebuild INDEX.md from ALL files on disk.

    Idempotent: writes only the new findings (does NOT overwrite existing F-XXX),
    then rebuilds INDEX.md by reading every F-*.md present in findings_dir. This
    is safe under repeated --single invocations.
    """
    findings_dir = Path(findings_dir)
    findings_dir.mkdir(parents=True, exist_ok=True)

    for f in findings:
        target = findings_dir / f"{f.id}.md"
        if target.exists():
            # Defensive: a same-ID file already exists. Skip to avoid clobbering
            # an unrelated finding (race-safe under --single from multiple shells).
            print(f"  skipping {f.id}: {target} already exists", file=sys.stderr)
            continue
        fm = f.model_dump(mode="json")
        body = f"# {f.title}\n\n## Problem\n<extracted by extractor>\n\n## Akzeptanzkriterien\n"
        for ak in f.acceptance_criteria:
            body += f"- [ ] {ak}\n"
        target.write_text(write_frontmatter(fm, body), encoding="utf-8")

    # Rebuild INDEX.md from ALL F-*.md files on disk (not just the new ones)
    from .lib.frontmatter import parse_frontmatter as _parse_fm
    severity_icon = {"critical": "⚫", "high": "🔴", "medium": "🟠", "low": "🟡"}
    rows = ["| ID | Sev | Area | Title | File | Effort | Status |",
            "|----|-----|------|-------|------|--------|--------|"]
    for fp in sorted(findings_dir.glob("F-*.md")):
        fm, _ = _parse_fm(fp.read_text(errors="replace"))
        sev = fm.get("severity", "low")
        rows.append(
            f"| {fm.get('id', fp.stem)} | {severity_icon.get(sev, '?')} | "
            f"{fm.get('area', '?')} | {fm.get('title', '?')} | "
            f"{fm.get('file', '?')} | {fm.get('effort') or '-'} | {fm.get('status', 'open')} |"
        )
    (findings_dir / "INDEX.md").write_text("# Findings Backlog\n\n" + "\n".join(rows) + "\n")


def main(argv: list[str] | None = None) -> int:
    argv = argv or sys.argv[1:]
    if not argv:
        print(
            "Usage: extract_findings.py <reviews-dir> [--findings-dir docs/findings] [--single <review.md>]",
            file=sys.stderr,
        )
        return 2

    reviews_dir = Path(argv[0])

    # Parse optional flags
    findings_dir = Path("docs/findings")
    single_file: Path | None = None
    i = 1
    while i < len(argv):
        if argv[i] == "--findings-dir" and i + 1 < len(argv):
            findings_dir = Path(argv[i + 1])
            i += 2
        elif argv[i] == "--single" and i + 1 < len(argv):
            single_file = Path(argv[i + 1])
            i += 2
        else:
            i += 1

    if single_file:
        review_paths = [single_file]
    else:
        review_paths = [
            p for p in sorted(reviews_dir.glob("*.md"))
            if not p.name.endswith("SUMMARY.md") and not p.name.startswith("_")
        ]

    # Seed with IDs already on disk so --single calls don't collide with existing files.
    seed_ids = existing_finding_ids(findings_dir)

    all_findings: List[Finding] = []
    for review_path in review_paths:
        review_text = review_path.read_text(errors="replace")
        try:
            findings = extract_from_review(
                review_text,
                source=str(review_path),
                existing_ids=seed_ids + [f.id for f in all_findings],
            )
            all_findings.extend(findings)
            print(f"  {review_path.name}: extracted {len(findings)} findings")
        except Exception as e:
            print(f"  {review_path.name}: ERROR — {e}", file=sys.stderr)

    if all_findings:
        write_finding_files(all_findings, findings_dir=findings_dir)
    print(f"\nTotal findings: {len(all_findings)} written to {findings_dir}/")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
