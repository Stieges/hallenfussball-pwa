# Blocker-Validierung: Gezielte Plan-Suche

> **Erstellt:** 2025-12-04
> **Model:** gpt-oss-120b-sovereign
> **Kontext:** 4 validierte Blocker gezielt im Plan gesucht

---

## 🎯 Aufgabenstellung

Der adesso Agent sollte gezielt nach 4 validierten Blockern im Plan suchen:

1. **Blocker #1:** BYE-Handling Endless Loop
2. **Blocker #2:** TeamScheduleState Export fehlt
3. **Blocker #4:** Uncaught Error im Scheduler-Loop
4. **Blocker #7:** Breaking Change Dokumentation fehlt

---

## 🔍 adesso Agent Analyse

## Überblick

| Blocker | Erwartete Lösung im Plan | Tatsächlicher Status |
|---------|--------------------------|----------------------|
| **#1 BYE‑Handling (endless loop)** | BYE‑Pairings müssen aus `remainingPairings` entfernt oder explizit ignoriert werden, damit die Schleife terminiert. | **❌ NICHT GELÖST** – Der Plan entfernt die BYE‑Pairings nicht. |
| **#2 `TeamScheduleState` Export** | `interface TeamScheduleState` muss mit `export` versehen werden, damit `FairnessCalculator.ts` es importieren kann. | **❌ NICHT GELÖST** – Der Plan importiert das Interface, fügt aber keinen Export hinzu. |
| **#4 Uncaught Error im Scheduler‑Loop** | Der Scheduler wirft einen Error, der im Wizard‑UI‑`try / catch` gefangen wird (oder über ein Error‑Boundary). | **✅ GELÖST** – Der Plan fügt sowohl eine **Stall‑Detection** (Error‑Throw) als auch ein **UI‑Error‑Handling** im Wizard hinzu. |
| **#7 Breaking‑Change‑Dokumentation** | Dokumentation des neuen Typs `teamB: Team | null`, Suche nach allen `teamB`‑Zugriffen und Ergänzung von Null‑Checks. | **❌ NICHT GELÖST** – Der Plan erwähnt das Typ‑Update, aber keine Dokumentation, keine Suche nach Consumer‑Code und keine Changelog‑Einträge. |

---

## Detail‑Analyse pro Blocker  

### Blocker #1 – BYE‑Handling (Endlosschleife)

| Prüfung | Ergebnis |
|--------|----------|
| **Fundstelle im Plan** | *Session 1 – Type‑Safety* (Zeilen 94 – 105) und *Session 2 – Performance‑Optimierung* (Scheduler‑Loop). |
| **Plan‑Code‑Zitat** | ```typescript\n// Session 1 – BYE‑Array\nconst teamsWithBye: (Team | null)[] = n % 2 === 0 ? [...teams] : [...teams, null];\n\n// Line 105 (unverändert)\nif (teamA && teamB) {\n  validPairings.push({ teamA, teamB });\n}\n```\n<br>```typescript\n// Session 2 – Scheduler‑Loop (Auszug)\nwhile (remainingPairings.length > 0) {\n  // …\n  for (let i = 0; i < remainingPairings.length; i++) {\n    const { pairing } = remainingPairings[i];\n    const score = calculateFairnessScore(\n      pairing.teamA.id,\n      pairing.teamB.id,   // <-- kann null sein!\n      currentSlotIndex,\n      field,\n      teamStates,\n      minRestSlotsPerTeam,\n      fairnessCalculator\n    );\n    // …\n  }\n  // …\n}\n``` |
| **Bewertung** | Der Plan **filtert** BYE‑Pairings nur beim Aufbau von `validPairings` (Zeile 105) – das hat **keine Auswirkung** auf `remainingPairings`, das im Scheduler‑Loop weiter iteriert wird. Da das Pairing nicht aus `remainingPairings` entfernt wird, bleibt die Länge > 0 und die Schleife kann nie terminieren. Außerdem wird `pairing.teamB.id` ohne Null‑Check aufgerufen, was zu einem **Runtime‑Error** führt, bevor überhaupt eine Endlosschleife entstehen könnte. |
| **Empfehlung** | 1. **Entferne** BYE‑Pairings sofort nach ihrer Erkennung, z. B. `remainingPairings = remainingPairings.filter(p => p.pairing.teamA && p.pairing.teamB);` <br>2. Alternativ **überspringe** BYE‑Pairings im Loop, indem du `if (!pairing.teamA || !pairing.teamB) continue;` einfügst. <br>3. Ergänze einen **Kommentar** im Plan, der erklärt, dass BYE‑Pairings nicht mehr Teil von `remainingPairings` sein dürfen. |

---

### Blocker #2 – `TeamScheduleState` Export

| Prüfung | Ergebnis |
|--------|----------|
| **Fundstelle im Plan** | *Session 2 – FairnessCalculator‑Klasse* (Import‑Zeile) |
| **Plan‑Code‑Zitat** | ```typescript\n// FairnessCalculator.ts (neu)\nimport { TeamScheduleState } from './fairScheduler';\n```\n<br>Im ursprünglichen `fairScheduler.ts` (Zeilen 25‑32) steht jedoch: <br>```typescript\ninterface TeamScheduleState {\n  teamId: string;\n  matchSlots: number[];\n  fieldCounts: Map<number, number>;\n  lastSlot: number;\n  homeCount: number;\n  awayCount: number;\n}\n``` (ohne `export`). |
| **Bewertung** | Der Plan **nutzt** das Interface in `FairnessCalculator.ts`, aber **fügt keinen `export`** vor der Interface‑Definition hinzu. Das führt zu einem **Build‑Fehler** (`TS2305: Module '"./fairScheduler"' has no exported member 'TeamScheduleState'`). |
| **Empfehlung** | Ergänze in `src/utils/fairScheduler.ts` direkt über der Interface‑Definition: <br>```typescript\nexport interface TeamScheduleState {\n  // …\n}\n``` <br>und stelle sicher, dass die Datei anschließend **kompiliert** (npm run build) ohne Fehlermeldungen. Dokumentiere diesen Schritt im Plan (z. B. „Export TeamScheduleState für FairnessCalculator“). |

---

### Blocker #4 – Uncaught Error im Scheduler‑Loop

| Prüfung | Ergebnis |
|--------|----------|
| **Fundstelle im Plan** | *Session 2 – Stall‑Detection* (Throw) und *Session 3 – UI‑Error‑Handling* (try/catch). |
| **Plan‑Code‑Zitat – Throw** | ```typescript\nif (!progressThisSlot) {\n  console.error('[FairScheduler] DEADLOCK: No match could be placed …');\n  throw new Error(\n    `Spielplan konnte nicht vollständig erstellt werden. ` +\n    `${remainingPairings.length} Matches fehlen. ` +\n    `Bitte mehr Felder hinzufügen …`\n  );\n}\n``` |
| **Plan‑Code‑Zitat – UI‑Catch** | ```typescript\nconst handleComplete = () => {\n  try {\n    const matches = generateGroupPhaseSchedule({ ... });\n    onComplete(name.trim(), matches);\n  } catch (error) {\n    const errorMessage = error instanceof Error ? error.message : 'Unbekannter Fehler …';\n    setScheduleError(errorMessage);\n  } finally {\n    setIsCompleting(false);\n  }\n};\n``` |
| **Bewertung** | Der Scheduler wirft jetzt **explizit** einen Error, sobald kein Fortschritt in einem Slot erzielt wird. Der Wizard‑Component fängt diesen Error über ein lokales `try / catch` ab und zeigt die Meldung im UI an. Da kein zusätzlicher Error‑Boundary im Komponenten‑Baum existiert, ist das **try / catch** die einzige Absicherung – und sie ist **direkt** um den Aufruf von `generateGroupPhaseSchedule`. Damit wird der Error zuverlässig bis zur UI propagiert. |
| **Empfehlung** | 1. Dokumentiere im Plan, dass das **Fail‑Fast‑Verhalten** bewusst gewählt wurde. <br>2. Optional: Ergänze einen **globalen ErrorBoundary** (z. B. `AppErrorBoundary`) für den Fall, dass zukünftige Änderungen den Error außerhalb des Wizards werfen. |

---

### Blocker #7 – Breaking‑Change‑Dokumentation (`teamB: Team | null`)

| Prüfung | Ergebnis |
|--------|----------|
| **Fundstelle im Plan** | *Session 1 – Type‑Safety* (TeamPairing‑Änderung) – **keine weitere Erwähnung** von Dokumentation, Changelog oder Consumer‑Suche. |
| **Plan‑Code‑Zitat** | ```typescript\n// TeamPairing (nach Änderung)\ninterface TeamPairing {\n  teamA: Team;\n  teamB: Team | null; // ← Breaking Change!\n}\n``` |
| **Bewertung** | Der Plan **implementiert** das Breaking‑Change (nullable `teamB`), aber **fehlende Schritte**: <br>• Keine Anweisung, alle Stellen zu suchen, an denen `pairing.teamB` ohne Null‑Check verwendet wird. <br>• Kein **Changelog‑Eintrag** oder **Release‑Note** im Plan. <br>• Keine **Migration‑Guidelines** für Consumer‑Komponenten. |
| **Empfehlung** | 1. Füge im Plan einen **„Breaking‑Change‑Check“**‑Schritt hinzu: <br>   - Skript/Manuelle Suche nach `pairing.teamB.` und `pairing.teamB!` und Ergänzung von `if (pairing.teamB) …` oder `pairing.teamB?.name`. <br>2. Ergänze einen **Changelog‑Eintrag** (z. B. `v2.3.0 – TeamPairing.teamB now nullable; update consumer code`). <br>3. Dokumentiere das **Risiko** im README und im API‑Spec. |

---

## Zusammenfassung

| Kategorie | Anzahl |
|-----------|--------|
| **Gelöste Blocker** | **1** (Blocker #4) |
| **Teilweise gelöste Blocker** | **0** |
| **Ungelöste Blocker** | **3** (Blocker #1, #2, #7) |

### Gesamtbewertung  
Der aktuelle Implementierungsplan deckt **nur einen** der vier validierten Blocker vollständig ab. Die drei übrigen Blocker bleiben entweder unbehandelt oder nur halb behandelt, was zu **kritischen Laufzeit‑ und Build‑Problemen** führen kann (Endlosschleife, fehlender Export, fehlende Dokumentation). Der Plan kann **so nicht** ohne weitere Anpassungen umgesetzt werden.

### Top‑3‑Änderungen, die sofort nötig sind

1. **BYE‑Pairings korrekt aus `remainingPairings` entfernen bzw. überspringen** (Blocker #1).  
2. **`TeamScheduleState` exportieren** und den Import in `FairnessCalculator.ts` anpassen (Blocker #2).  
3. **Breaking‑Change‑Dokumentation und Consumer‑Migration** für `teamB: Team | null` einführen (Blocker #7).

Nachdem diese Punkte im Plan ergänzt und umgesetzt wurden, kann das Projekt mit den verbleibenden (bereits gelösten) Änderungen stabil gebaut und ausgeführt werden.

---

## Metadaten

- **Timestamp:** 2025-12-04T10:23:58.815Z
- **Plan-Datei:** .claude/plans/giggly-tickling-lake.md
- **Code-Kontext:** docs/index-code.md
- **Validierte Blocker:** 4 von 7 (2 widerlegt, 1 unklar)
