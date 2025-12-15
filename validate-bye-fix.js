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
  console.log('🤔 Validating BYE-Handling fix with adesso Agent...\n');

  // Read the actual code
  const fairSchedulerPath = path.join(__dirname, 'src/utils/fairScheduler.ts');
  const fairSchedulerCode = fs.readFileSync(fairSchedulerPath, 'utf-8');

  // Read my analysis
  const analysisPath = path.join(__dirname, 'docs/analysis/fix1-bye-handling-validation.md');
  const myAnalysis = fs.readFileSync(analysisPath, 'utf-8');

  const prompt = `# KRITISCHE FRAGE: Ist der BYE-Handling-Fix korrekt?

## Kontext

Du (adesso Agent) hast in deiner Blocker-Analyse empfohlen:

> **Fix für Blocker #1:**
> Im Scheduler-Loop (Line 334-344) BYE-Pairings mit \`if (!pairing.teamB)\` prüfen und aus \`remainingPairings\` entfernen.

Ich (Claude) habe den tatsächlichen Code analysiert und einen **kritischen Widerspruch** gefunden.

---

## 🔍 Der tatsächliche Code

### generateRoundRobinPairings (Line 88-121)

\`\`\`typescript
function generateRoundRobinPairings(teams: Team[]): TeamPairing[] {
  const pairings: TeamPairing[] = [];
  const n = teams.length;

  if (n < 2) return pairings;

  // For odd number of teams, add a "bye" team
  const teamsWithBye = n % 2 === 0 ? [...teams] : [...teams, null as any];
  const totalTeams = teamsWithBye.length;

  // Circle method: fix one team, rotate others
  for (let round = 0; round < totalTeams - 1; round++) {
    for (let i = 0; i < totalTeams / 2; i++) {
      const teamA = teamsWithBye[i];
      const teamB = teamsWithBye[totalTeams - 1 - i];

      // ← HIER: Skip if either team is the "bye"
      if (teamA && teamB) {
        pairings.push({ teamA, teamB });  // ← NUR nicht-null Pairings!
      }
    }

    // Rotate teams...
  }

  return pairings;  // ← Enthält KEINE BYE-Pairings!
}
\`\`\`

### Scheduler-Loop (Line 304-409)

\`\`\`typescript
// Line 280-301: allPairings wird erstellt
const allPairings: Array<{ groupId: string; pairing: TeamPairing }> = [];
groups.forEach((groupTeams, groupId) => {
  const pairings = generateRoundRobinPairings(groupTeams);  // ← KEINE BYE-Pairings!
  pairings.forEach(pairing => {
    allPairings.push({ groupId, pairing });
  });
});

// Line 304: remainingPairings = allPairings
const remainingPairings = [...allPairings];

// Line 312-409: Scheduler-Loop
while (remainingPairings.length > 0) {
  for (let i = 0; i < remainingPairings.length; i++) {
    const { pairing } = remainingPairings[i];

    // Line 337-344: calculateFairnessScore
    const score = calculateFairnessScore(
      pairing.teamA.id,
      pairing.teamB.id,  // ← teamB ist NIEMALS null hier!
      currentSlotIndex,
      field,
      teamStates,
      minRestSlotsPerTeam
    );
  }

  // Line 409: Pairing wird nach Scheduling entfernt
  if (bestPairingIndex >= 0 && bestScore < Infinity) {
    // ... schedule match ...
    remainingPairings.splice(bestPairingIndex, 1);
  }
}
\`\`\`

---

## ⚠️ Mein Widerspruch

**Deine Annahme:**
> "BYE-Pairings werden nur aus \`validPairings\` gefiltert (Line 105), aber der Scheduler-Loop iteriert über \`remainingPairings\`, daher bleibt das BYE-Pairing drin."

**Meine Analyse:**
1. Line 105: \`if (teamA && teamB)\` filtert BYE-Pairings
2. Line 106: \`pairings.push()\` wird NUR für nicht-null Pairings aufgerufen
3. Line 120: \`return pairings\` gibt Array OHNE BYE-Pairings zurück
4. Line 280-301: \`allPairings\` wird aus diesem RETURN-Wert erstellt
5. Line 304: \`remainingPairings = [...allPairings]\`
6. **Fazit:** \`remainingPairings\` enthält NIEMALS BYE-Pairings!

**Es gibt KEIN separates Array \`validPairings\`!**

---

## 📚 Der vollständige Code (zur Referenz)

\`\`\`typescript
${fairSchedulerCode}
\`\`\`

---

## 🎯 Meine spezifischen Fragen an dich

### Frage 1: Habe ich den Code-Flow korrekt verstanden?

- ✅ Stimmt es, dass \`generateRoundRobinPairings()\` BYE-Pairings bei Line 105 filtert?
- ✅ Stimmt es, dass \`allPairings\` nur aus diesem gefilterten Return-Wert erstellt wird?
- ✅ Stimmt es, dass \`remainingPairings\` daher KEINE BYE-Pairings enthält?

### Frage 2: Wo ist der Fehler in deiner Analyse?

Du hast geschrieben:
> "Der Plan filtert BYE-Pairings nur beim Aufbau von \`validPairings\` (Zeile 105) – das hat **keine Auswirkung** auf \`remainingPairings\`."

**Aber:** Es gibt kein Array namens \`validPairings\`!

- Zeile 105 ist INNERHALB von \`generateRoundRobinPairings()\`
- Das \`pairings\` Array dort ist der RETURN-Wert
- \`remainingPairings\` wird aus diesem RETURN-Wert erstellt

**Hast du:**
- A) Den Code-Flow falsch verstanden?
- B) Angenommen, es gibt ein separates \`validPairings\` Array?
- C) Die Line-Nummern falsch zugeordnet?

### Frage 3: Ist dein Fix überhaupt nötig?

**Dein empfohlener Fix:**
\`\`\`typescript
for (let i = 0; i < remainingPairings.length; i++) {
  const { pairing } = remainingPairings[i];

  if (!pairing.teamB) {
    remainingPairings.splice(i, 1);
    i--;
    continue;
  }
  // ...
}
\`\`\`

**Meine Bewertung:**
- Wenn \`remainingPairings\` KEINE BYE-Pairings enthält, ist dieser Check **Dead Code**
- \`if (!pairing.teamB)\` wird NIEMALS true sein
- Der Code hat keinen Effekt

**Ist der Fix korrekt?** → Nein, scheint unnötig

### Frage 4: Was ist das ECHTE Problem dann?

Wenn BYE-Pairings bereits gefiltert werden, warum braucht der Plan dann einen Fix?

**Möglichkeiten:**
1. **Kein Problem** - Der aktuelle Code funktioniert bereits korrekt
2. **Type-Safety-Problem** - TypeScript beschwert sich über \`Team | null\` auch wenn gefiltert
3. **Zukünftiges Problem** - Wenn jemand später BYE-Pairings einführt, crasht der Code
4. **Ich habe etwas übersehen** - Es gibt einen versteckten Code-Pfad

**Welche Möglichkeit ist korrekt?**

---

## 🎯 Deine Antwort sollte enthalten

1. **✅ oder ❌ für jede meiner Annahmen**
   - Ist mein Verständnis des Code-Flows korrekt?

2. **Erklärung des Fehlers in deiner ursprünglichen Analyse**
   - Wo genau lag das Missverständnis?

3. **Revidierter Fix (falls nötig)**
   - Wenn dein Original-Fix falsch ist, was ist der richtige Fix?
   - Oder: Gibt es überhaupt ein Problem?

4. **Konkrete Code-Beispiele**
   - Zeige mir mit exakten Line-Nummern, wo BYE-Pairings ein Problem verursachen könnten

---

**WICHTIG:** Sei präzise und verwende exakte Line-Nummern aus dem obigen Code. Wenn du einen Fehler gemacht hast, gib es offen zu.
`;

  try {
    const validation = await callAdessoAPI(prompt);

    console.log('✅ Validation received!\n');
    console.log('='.repeat(80));
    console.log(validation);
    console.log('='.repeat(80));

    // Save validation to file
    const outputPath = path.join(__dirname, 'docs/analysis', 'agent-bye-fix-response.md');
    const fullOutput = `# Agent-Antwort: BYE-Handling Fix Validierung

> **Erstellt:** ${new Date().toISOString().split('T')[0]}
> **Model:** ${ADESSO_MODEL}
> **Kontext:** Claude hat Widerspruch im BYE-Handling-Fix gefunden

---

## 🤔 Claudes Kritik

Claude hat analysiert, dass BYE-Pairings bereits bei Line 105 in \`generateRoundRobinPairings()\` gefiltert werden und daher NIEMALS in \`remainingPairings\` landen.

Der empfohlene Fix im Scheduler-Loop wäre daher Dead Code.

---

## 💬 adesso Agent Antwort

${validation}

---

## Metadaten

- **Timestamp:** ${new Date().toISOString()}
- **Analysierte Datei:** src/utils/fairScheduler.ts
- **Kritik-Dokument:** docs/analysis/fix1-bye-handling-validation.md
`;

    fs.writeFileSync(outputPath, fullOutput, 'utf-8');
    console.log(`\n💾 Validation saved to: ${outputPath}\n`);

  } catch (error) {
    console.error('❌ Error during validation:', error.message);
    process.exit(1);
  }
}

main();
