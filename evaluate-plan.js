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
  console.log('🔍 Loading implementation plan...\n');

  const planPath = '/Users/daniel.stiegler/.claude/plans/giggly-tickling-lake.md';
  const planContent = fs.readFileSync(planPath, 'utf-8');

  console.log(`📄 Plan loaded (${planContent.length} characters)\n`);
  console.log('🤖 Sending to adesso AI Hub for critical evaluation...\n');

  const prompt = `# CRITICAL PLAN REVIEW REQUEST

Du bist ein erfahrener Senior Software Architect und Code Reviewer. Ein Implementierungsplan für kritische Fixes in einer TypeScript Codebase wurde erstellt und benötigt deine **kritische Bewertung**.

## Deine Aufgabe

Führe eine **rigorose, kritische Analyse** des Plans durch und identifiziere:

1. **Kritische Risiken & Blocker**
   - Welche Schritte könnten fehlschlagen?
   - Wo fehlen wichtige Details?
   - Gibt es versteckte Abhängigkeiten?

2. **Technische Bedenken**
   - Sind die vorgeschlagenen Lösungen robust?
   - Gibt es bessere Alternativen?
   - Sind Performance-Annahmen realistisch?

3. **Fehlende Schritte**
   - Was wurde übersehen?
   - Welche Edge Cases sind nicht abgedeckt?
   - Sind Rollback-Strategien vorhanden?

4. **Testing-Lücken**
   - Sind die Tests ausreichend?
   - Welche Test-Cases fehlen?
   - Wie wird Regression verhindert?

5. **Breaking Changes & Kompatibilität**
   - Wurden alle Breaking Changes identifiziert?
   - Gibt es versteckte Breaking Changes?
   - Ist die Migration sicher?

## Der zu bewertende Plan

${planContent}

## Deine kritische Bewertung

Bitte strukturiere deine Antwort wie folgt:

### 🚨 KRITISCHE RISIKEN (Blocker)
[Punkte die SOFORT adressiert werden müssen]

### ⚠️ HOHE RISIKEN (Vor Implementation klären)
[Technische Bedenken, fehlende Details]

### 💡 VERBESSERUNGSVORSCHLÄGE
[Optionale Optimierungen, bessere Ansätze]

### ❓ RÜCKFRAGEN
[Spezifische Fragen zur Klärung]

### ✅ POSITIVE ASPEKTE
[Was ist gut am Plan?]

**Sei direkt, ehrlich und kritisch. Falsche Höflichkeit hilft nicht - ich brauche die Wahrheit.**`;

  try {
    const evaluation = await callAdessoAPI(prompt);

    console.log('✅ Evaluation received!\n');
    console.log('='.repeat(80));
    console.log(evaluation);
    console.log('='.repeat(80));

    // Save evaluation to file
    const outputPath = path.join(__dirname, 'docs', 'plan-evaluation-adesso.md');
    const fullOutput = `# Kritische Plan-Bewertung durch adesso AI Hub

> **Erstellt:** ${new Date().toISOString().split('T')[0]}
> **Model:** ${ADESSO_MODEL}
> **Plan:** giggly-tickling-lake.md

---

${evaluation}

---

## Metadaten

- **Plan-Datei:** \`.claude/plans/giggly-tickling-lake.md\`
- **Plan-Größe:** ${planContent.length} Zeichen
- **Evaluation-Timestamp:** ${new Date().toISOString()}
`;

    fs.writeFileSync(outputPath, fullOutput, 'utf-8');
    console.log(`\n💾 Evaluation saved to: ${outputPath}\n`);

  } catch (error) {
    console.error('❌ Error during evaluation:', error.message);
    process.exit(1);
  }
}

main();
