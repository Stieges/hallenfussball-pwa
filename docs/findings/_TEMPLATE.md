---
id: F-XXX
severity: medium
area: architecture | security | data | perf | ux | a11y | testing | doc | other
title: <Kurzer Titel>
file: src/<path>
lines: <optional, e.g. 42-58>
effort: <optional, e.g. 30m, 2h>
status: open
source: reviews/<source-review-file>.md
detected: YYYY-MM-DD
fixed_at: null
fixed_in_commit: null
related: []
parent: null
model_routing: null  # optional override (e.g. claude-opus-4-6)
acceptance_criteria:
  - AK 1
  - AK 2
stale: false
---

# <Title>

## Problem
<1-2 sentences describing what's wrong>

## Reproduktion
<concrete grep/ls/test command to observe the issue>

## Vorgeschlagener Fix
<code-snippet or natural-language description>

## Akzeptanzkriterien
- [ ] AK 1
- [ ] AK 2
- [ ] Test schreibt explizit Anti-Regression
