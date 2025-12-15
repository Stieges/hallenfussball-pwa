#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ADESSO_API_URL = "https://adesso-ai-hub.3asabc.de/v1";
const ADESSO_API_KEY = "sk-dkjig151OXftdlLOYkwBeA";
const ADESSO_MODEL = "gpt-oss-120b-sovereign";

async function callAdessoAPI(prompt) {
  const response = await fetch(`${ADESSO_API_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${ADESSO_API_KEY}`
    },
    body: JSON.stringify({
      model: ADESSO_MODEL,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 16000,
      temperature: 0.3
    })
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(`API Error: ${data.error?.message || 'Unknown error'}`);
  }

  const content = data.choices[0].message.content || '';
  const finishReason = data.choices[0].finish_reason;

  if (finishReason === 'length') {
    console.warn('\n⚠️  WARNING: Response was truncated due to token limit\n');
  }

  return content;
}

async function main() {
  console.log('🎯 Asking adesso Agent to search for specific blockers in the plan...\n');

  // Read the plan
  const planPath = '/Users/daniel.stiegler/.claude/plans/giggly-tickling-lake.md';
  const plan = fs.readFileSync(planPath, 'utf-8');

  // Read the code context
  const contextPath = path.join(__dirname, 'docs', 'index-code.md');
  const context = fs.readFileSync(contextPath, 'utf-8');

  const prompt = `# GEZIELTE BLOCKER-SUCHE im Implementierungsplan

## Kontext

Ich (Claude) habe den tatsächlichen Code systematisch analysiert und die Code-Zusammenhänge dokumentiert.

Von deinen ursprünglichen 7 kritischen Blockern sind **4 validiert**, **2 widerlegt** (Missverständnisse), **1 unklar**.

## Deine Aufgabe

**Suche GEZIELT** nach diesen 4 validierten Blockern im Plan und prüfe, ob sie korrekt adressiert werden.

---

## 🔍 BLOCKER #1: BYE-Handling Endless Loop

**Problem:**
\`\`\`typescript
// fairScheduler.ts Line 94
const teamsWithBye = n % 2 === 0 ? [...teams] : [...teams, null];

// Line 105 - BYE-Pairings werden gefiltert:
if (teamA && teamB) {
  validPairings.push({ teamA, teamB });
}
// ← Pairing mit null wird NICHT zu validPairings hinzugefügt

// ABER: Im Scheduler-Loop wird über remainingPairings iteriert
// Wenn ein BYE-Pairing in einem Slot landet, wird kein Match erzeugt
// UND das Pairing wird NICHT aus remainingPairings entfernt
// → Endlosschleife, weil remainingPairings.length nie 0 wird
\`\`\`

**Deine Aufgabe:**
1. **Suche** im Plan nach der Stelle, wo der Scheduler-Loop BYE-Pairings behandelt
2. **Prüfe:** Wird das BYE-Pairing aus \`remainingPairings\` entfernt?
3. **Bewerte:** Ist das Problem im Plan gelöst? Oder fehlt eine explizite BYE-Behandlung?

---

## 🔍 BLOCKER #2: TeamScheduleState Export fehlt

**Problem:**
\`\`\`typescript
// fairScheduler.ts Line 25-32 - NICHT exportiert!
interface TeamScheduleState {
  teamId: string;
  matchSlots: number[];
  fieldCounts: Map<number, number>;
  lastSlot: number;
  homeCount: number;
  awayCount: number;
}

// FairnessCalculator.ts braucht dieses Interface
// ABER: TypeScript kann es nicht importieren
// → Build-Fehler
\`\`\`

**Deine Aufgabe:**
1. **Suche** im Plan nach der FairnessCalculator-Klasse (Session 2, Phase 1)
2. **Prüfe:** Wird \`export\` vor \`interface TeamScheduleState\` hinzugefügt?
3. **Prüfe:** Wird das Interface in FairnessCalculator.ts importiert?
4. **Bewerte:** Ist der Import-Pfad korrekt?

---

## 🔍 BLOCKER #4: Uncaught Error im Scheduler-Loop

**Problem:**
\`\`\`typescript
// Plan (Session 2): Stall Detection wirft Error
if (!progressThisSlot) {
  throw new Error(\`Spielplan konnte nicht vollständig erstellt werden...\`);
}

// Wizard (Session 3): Error-Handling
try {
  const matches = generateGroupPhaseSchedule({ ... });
} catch (error) {
  setScheduleError(error.message);
}

// ABER: Der Error wird im Scheduler-Loop geworfen (tief im Call-Stack)
// Kein ErrorBoundary vorhanden
// Frage: Wird der Error wirklich bis zum Wizard-try/catch propagiert?
\`\`\`

**Deine Aufgabe:**
1. **Suche** im Plan nach der Stall-Detection (Session 2, Phase 3)
2. **Suche** im Plan nach dem UI-Error-Handling (Session 3, Teil 2)
3. **Prüfe:** Gibt es eine Diskrepanz zwischen "wo der Error geworfen wird" und "wo er gefangen wird"?
4. **Bewerte:** Ist sichergestellt, dass der Error propagiert wird? Oder gibt es Zwischenschichten, die ihn schlucken könnten?

---

## 🔍 BLOCKER #7: Breaking Change Dokumentation

**Problem:**
\`\`\`typescript
// VORHER:
interface TeamPairing {
  teamA: Team;
  teamB: Team;  // ← NOT nullable
}

// NACHHER:
interface TeamPairing {
  teamA: Team;
  teamB: Team | null;  // ← Breaking Change!
}

// Jeder Consumer, der teamB ohne Null-Check verwendet, bricht:
const teamBName = pairing.teamB.name;  // ← Runtime Error wenn teamB === null
\`\`\`

**Deine Aufgabe:**
1. **Suche** im Plan nach einer Anweisung, Consumer-Komponenten zu finden
2. **Prüfe:** Gibt es einen Schritt "Suche nach \`teamB\`-Zugriffen und füge Null-Checks hinzu"?
3. **Prüfe:** Gibt es einen Changelog-Eintrag oder Breaking-Change-Warnung im Plan?
4. **Bewerte:** Ist das Risiko adressiert? Oder wird es ignoriert?

---

## 📚 Code-Kontext (zur Referenz)

Hier ist die vollständige Code-Analyse mit allen Zusammenhängen:

${context}

---

## 📋 Der zu prüfende Plan

${plan}

---

## 🎯 Deine Antwort sollte enthalten

Für jeden der 4 Blocker:

### Blocker #1: BYE-Handling

- **STATUS:** ✅ GELÖST / ⚠️ TEILWEISE GELÖST / ❌ NICHT GELÖST
- **Fundstelle im Plan:** [Session X, Zeile Y oder "nicht gefunden"]
- **Plan-Code-Zitat:** [Relevanter Code-Ausschnitt aus dem Plan]
- **Bewertung:** [Ist das Problem korrekt adressiert?]
- **Empfehlung:** [Was muss geändert werden?]

### Blocker #2: TeamScheduleState Export

- **STATUS:** ✅ GELÖST / ⚠️ TEILWEISE GELÖST / ❌ NICHT GELÖST
- **Fundstelle im Plan:** [...]
- **Plan-Code-Zitat:** [...]
- **Bewertung:** [...]
- **Empfehlung:** [...]

### Blocker #4: Uncaught Error

- **STATUS:** ✅ GELÖST / ⚠️ TEILWEISE GELÖST / ❌ NICHT GELÖST
- **Fundstelle im Plan:** [...]
- **Plan-Code-Zitat:** [...]
- **Bewertung:** [...]
- **Empfehlung:** [...]

### Blocker #7: Breaking Change Docs

- **STATUS:** ✅ GELÖST / ⚠️ TEILWEISE GELÖST / ❌ NICHT GELÖST
- **Fundstelle im Plan:** [...]
- **Plan-Code-Zitat:** [...]
- **Bewertung:** [...]
- **Empfehlung:** [...]

---

## ✅ Zusammenfassung

**Gelöste Blocker:** [Anzahl]
**Teilweise gelöste Blocker:** [Anzahl]
**Ungelöste Blocker:** [Anzahl]

**Gesamtbewertung:** [Kann der Plan so umgesetzt werden? Oder müssen kritische Änderungen vorgenommen werden?]

**Top 3 Änderungen am Plan:** [Priorisierte Liste der wichtigsten Fixes]

---

**WICHTIG:** Sei präzise! Zitiere exakte Zeilen aus dem Plan. Wenn etwas fehlt, sage "nicht gefunden" statt zu spekulieren.
`;

  try {
    const analysis = await callAdessoAPI(prompt);

    console.log('✅ Blocker analysis received!\n');
    console.log('='.repeat(80));
    console.log(analysis);
    console.log('='.repeat(80));

    // Save analysis to file
    const outputPath = path.join(__dirname, 'docs', 'blocker-validation.md');
    const fullOutput = `# Blocker-Validierung: Gezielte Plan-Suche

> **Erstellt:** ${new Date().toISOString().split('T')[0]}
> **Model:** ${ADESSO_MODEL}
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

${analysis}

---

## Metadaten

- **Timestamp:** ${new Date().toISOString()}
- **Plan-Datei:** .claude/plans/giggly-tickling-lake.md
- **Code-Kontext:** docs/index-code.md
- **Validierte Blocker:** 4 von 7 (2 widerlegt, 1 unklar)
`;

    fs.writeFileSync(outputPath, fullOutput, 'utf-8');
    console.log(`\n💾 Analysis saved to: ${outputPath}\n`);

  } catch (error) {
    console.error('❌ Error during blocker validation:', error.message);
    process.exit(1);
  }
}

main();
