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
  console.log('🔍 Searching for property name occurrences in fairScheduler.ts...\n');

  // Read the actual fairScheduler.ts code
  const fairSchedulerPath = path.join(__dirname, 'src/utils/fairScheduler.ts');
  const fairSchedulerCode = fs.readFileSync(fairSchedulerPath, 'utf-8');

  const prompt = `# CODE-ANALYSE: Property-Namen in fairScheduler.ts

## Aufgabe

Durchsuche den folgenden Code **systematisch** nach allen Vorkommen dieser Property-Namen:

1. \`team1\` (sollte eigentlich \`teamA\` sein)
2. \`team2\` (sollte eigentlich \`teamB\` sein)
3. \`Pairing\` als Interface-Name (sollte eigentlich \`TeamPairing\` sein)
4. \`waitingTime1\` (existiert vermutlich gar nicht)
5. \`waitingTime2\` (existiert vermutlich gar nicht)

## Der zu analysierende Code

\`\`\`typescript
${fairSchedulerCode}
\`\`\`

## Deine Antwort sollte enthalten

### 1. \`team1\` Vorkommen

- [ ] **GEFUNDEN** oder **NICHT GEFUNDEN**
- Falls gefunden: Exakte Zeilennummern und Kontext

### 2. \`team2\` Vorkommen

- [ ] **GEFUNDEN** oder **NICHT GEFUNDEN**
- Falls gefunden: Exakte Zeilennummern und Kontext

### 3. \`Pairing\` als Interface-Name

- [ ] **GEFUNDEN** oder **NICHT GEFUNDEN**
- Falls gefunden: Exakte Zeilennummern und Kontext
- **WICHTIG:** Unterscheide zwischen \`Pairing\` (falsch) und \`TeamPairing\` (richtig)

### 4. \`waitingTime1\` Vorkommen

- [ ] **GEFUNDEN** oder **NICHT GEFUNDEN**
- Falls gefunden: Exakte Zeilennummern und Kontext

### 5. \`waitingTime2\` Vorkommen

- [ ] **GEFUNDEN** oder **NICHT GEFUNDEN**
- Falls gefunden: Exakte Zeilennummern und Kontext

### 6. Zusammenfassung

**Verwendet der aktuelle Code:**
- \`teamA\` / \`teamB\`? ✅ oder ❌
- \`team1\` / \`team2\`? ✅ oder ❌
- \`TeamPairing\` Interface? ✅ oder ❌
- \`Pairing\` Interface? ✅ oder ❌
- \`waitingTime1\` / \`waitingTime2\`? ✅ oder ❌

**Fazit:** Ist der Implementierungsplan korrekt oder müssen die Property-Namen korrigiert werden?

## Beispiel einer guten Antwort

### 1. \`team1\` Vorkommen

**NICHT GEFUNDEN** - Der Code verwendet \`teamA\` stattdessen.

### 2. \`team2\` Vorkommen

**NICHT GEFUNDEN** - Der Code verwendet \`teamB\` stattdessen.

### 3. \`Pairing\` als Interface-Name

**NICHT GEFUNDEN** - Der Code definiert \`TeamPairing\` (Line 77):
\`\`\`typescript
interface TeamPairing {
  teamA: Team;
  teamB: Team;
}
\`\`\`

### 4-5. \`waitingTime1\` / \`waitingTime2\`

**NICHT GEFUNDEN** - Diese Properties existieren nicht im Code.

### 6. Zusammenfassung

**Verwendet der aktuelle Code:**
- \`teamA\` / \`teamB\`? ✅ JA (Line 78-79)
- \`team1\` / \`team2\`? ❌ NEIN
- \`TeamPairing\` Interface? ✅ JA (Line 77)
- \`Pairing\` Interface? ❌ NEIN
- \`waitingTime1\` / \`waitingTime2\`? ❌ NEIN

**Fazit:** Der Implementierungsplan verwendet die FALSCHEN Property-Namen (\`team1/team2\`, \`Pairing\`) und muss korrigiert werden.
`;

  try {
    const analysis = await callAdessoAPI(prompt);

    console.log('✅ Analysis received!\n');
    console.log('='.repeat(80));
    console.log(analysis);
    console.log('='.repeat(80));

    // Save analysis to file
    const outputPath = path.join(__dirname, 'docs', 'property-names-search.md');
    const fullOutput = `# Property-Namen Suche in fairScheduler.ts

> **Erstellt:** ${new Date().toISOString().split('T')[0]}
> **Model:** ${ADESSO_MODEL}
> **Zweck:** Validierung der Property-Namen im aktuellen Code

---

## 🔍 adesso Agent Analyse

${analysis}

---

## Metadaten

- **Timestamp:** ${new Date().toISOString()}
- **Datei:** src/utils/fairScheduler.ts
- **Gesuchte Terms:** team1, team2, Pairing, waitingTime1, waitingTime2
`;

    fs.writeFileSync(outputPath, fullOutput, 'utf-8');
    console.log(`\n💾 Analysis saved to: ${outputPath}\n`);

  } catch (error) {
    console.error('❌ Error during analysis:', error.message);
    process.exit(1);
  }
}

main();
