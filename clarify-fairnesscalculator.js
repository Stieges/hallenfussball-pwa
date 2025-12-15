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
  console.log('🤔 Clarifying FairnessCalculator approach with adesso Agent...\n');

  // Read the actual fairScheduler.ts code
  const fairSchedulerPath = path.join(__dirname, 'src/utils/fairScheduler.ts');
  const fairSchedulerCode = fs.readFileSync(fairSchedulerPath, 'utf-8');

  // Read my analysis
  const myAnalysisPath = path.join(__dirname, 'docs/plan-response-to-adesso.md');
  const myAnalysis = fs.readFileSync(myAnalysisPath, 'utf-8');

  const prompt = `# KLÄRUNGSFRAGE: FairnessCalculator Implementation

## Kontext

Du hast in deiner früheren Analyse empfohlen, einen \`FairnessCalculator\` zu implementieren, der \`teamRestMap\` ersetzt.

Ich (Claude) habe den tatsächlichen Code untersucht und festgestellt:
- **\`teamRestMap\` existiert NICHT im Code**
- Der Code verwendet \`Map<string, TeamScheduleState>\` (teamStates)
- TeamScheduleState enthält: matchSlots, fieldCounts, lastSlot, homeCount, awayCount

## Deine ursprüngliche Analyse (aus mcp-adesso-analyzer/fairscheduler-analysis.md)

Du hast eine \`FairnessCache\` Klasse vorgeschlagen:

\`\`\`typescript
class FairnessCache {
  private readonly teamStates: Map<string, TeamScheduleState>;
  private readonly minRestSlots: number;
  private globalMinAvg = Infinity;
  private globalMaxAvg = -Infinity;
  private readonly avgRestByTeam = new Map<string, number>();

  constructor(teamStates: Map<string, TeamScheduleState>, minRestSlots: number) {
    this.teamStates = teamStates;
    this.minRestSlots = minRestSlots;
    teamStates.forEach((_, id) => this.avgRestByTeam.set(id, 0));
  }

  projectedAvgRest(teamId: string, slot: number): number { ... }
  updateGlobal(teamIds: string[]) { ... }
  getGlobalVariance(): number { ... }
}
\`\`\`

## Meine Verwirrung

Der ursprüngliche Implementierungsplan (giggly-tickling-lake.md) erwähnt:

> "Der Plan ersetzt \`teamRestMap\` nur in \`schedulePairingsGreedy\`"

Aber \`teamRestMap\` existiert nicht. Der Code hat nur \`teamStates\`.

## Der tatsächliche Code

Hier sind die relevanten Ausschnitte aus fairScheduler.ts:

\`\`\`typescript
// Line 24-31: TeamScheduleState Interface
interface TeamScheduleState {
  teamId: string;
  matchSlots: number[];
  fieldCounts: Map<number, number>;
  lastSlot: number;
  homeCount: number;
  awayCount: number;
}

// Line 169-265: calculateFairnessScore Funktion
function calculateFairnessScore(
  teamAId: string,
  teamBId: string,
  slot: number,
  field: number,
  teamStates: Map<string, TeamScheduleState>,
  minRestSlots: number
): number {
  const stateA = teamStates.get(teamAId)!;  // ← Non-null assertion
  const stateB = teamStates.get(teamBId)!;

  let score = 0;

  // Penalize if minimum rest is violated
  if (!canTeamPlayInSlot(teamAId, slot, minRestSlots, teamStates) ||
      !canTeamPlayInSlot(teamBId, slot, minRestSlots, teamStates)) {
    return Infinity;
  }

  // PRIORITY 1: Minimize global variance (maxAvgRest - minAvgRest)
  const avgRestByTeam = new Map<string, number>();

  teamStates.forEach((state, teamId) => {
    if (teamId === teamAId || teamId === teamBId) {
      const projectedSlots = [...state.matchSlots, slot].sort((a, b) => a - b);
      if (projectedSlots.length < 2) {
        avgRestByTeam.set(teamId, 0);
      } else {
        let restSum = 0;
        for (let i = 1; i < projectedSlots.length; i++) {
          restSum += projectedSlots[i] - projectedSlots[i - 1];
        }
        avgRestByTeam.set(teamId, restSum / (projectedSlots.length - 1));
      }
    } else {
      // ... existing avg calculation ...
    }
  });

  // Calculate variance
  const avgRests = Array.from(avgRestByTeam.values()).filter(v => v > 0);
  if (avgRests.length > 0) {
    const maxAvg = Math.max(...avgRests);
    const minAvg = Math.min(...avgRests);
    score += (maxAvg - minAvg) * 100;
  }

  // ... field distribution, home/away, etc ...
}
\`\`\`

## Meine Fragen an dich

1. **Was genau soll der FairnessCalculator verwalten?**
   - Soll er \`teamStates\` wrappen?
   - Oder nur Variance cachen?
   - Oder eine komplett neue Datenstruktur sein?

2. **Wo soll der FairnessCalculator instanziiert werden?**
   - In \`generateGroupPhaseSchedule\` (äußere Funktion)?
   - Als Parameter in \`calculateFairnessScore\`?
   - Als globales Singleton?

3. **Was genau soll gecached werden?**
   - Nur die globale Variance (maxAvg - minAvg)?
   - Die avgRestByTeam Map?
   - Die kompletten fairness scores für jede Pairing/Slot-Kombination?

4. **Muss \`TeamScheduleState\` Interface erweitert werden?**
   - Wie in deiner Analyse vorgeschlagen (restSum, restCount)?
   - Oder bleibt es unverändert?

## Was ich vorschlage

Basierend auf meiner Code-Analyse würde ich vorschlagen:

\`\`\`typescript
// Vereinfachter FairnessCalculator (nur Variance-Cache)
export class FairnessCalculator {
  private varianceCache = new Map<string, number>();

  getVariance(teamStates: Map<string, TeamScheduleState>): number {
    const cacheKey = this.serializeStates(teamStates);

    if (this.varianceCache.has(cacheKey)) {
      return this.varianceCache.get(cacheKey)!;
    }

    const variance = this.calculateVariance(teamStates);
    this.varianceCache.set(cacheKey, variance);
    return variance;
  }

  private calculateVariance(teamStates: Map<string, TeamScheduleState>): number {
    const avgRests: number[] = [];

    teamStates.forEach((state) => {
      if (state.matchSlots.length < 2) {
        avgRests.push(0);
        return;
      }

      let restSum = 0;
      for (let i = 1; i < state.matchSlots.length; i++) {
        restSum += state.matchSlots[i] - state.matchSlots[i - 1];
      }
      avgRests.push(restSum / (state.matchSlots.length - 1));
    });

    const filtered = avgRests.filter(v => v > 0);
    if (filtered.length === 0) return 0;

    return Math.max(...filtered) - Math.min(...filtered);
  }

  private serializeStates(states: Map<string, TeamScheduleState>): string {
    return Array.from(states.entries())
      .map(([id, state]) => \`\${id}:\${state.matchSlots.join(',')}\`)
      .join('|');
  }

  invalidateCache(): void {
    this.varianceCache.clear();
  }
}
\`\`\`

**Verwendung:**

\`\`\`typescript
// In generateGroupPhaseSchedule:
const fairnessCalculator = new FairnessCalculator();

// In calculateFairnessScore:
function calculateFairnessScore(
  teamAId: string,
  teamBId: string,
  slot: number,
  field: number,
  teamStates: Map<string, TeamScheduleState>,
  minRestSlots: number,
  fairnessCalculator: FairnessCalculator  // ← Neuer Parameter
): number {
  // ... existing checks ...

  // Statt die Variance neu zu berechnen:
  const variance = fairnessCalculator.getVariance(teamStates);
  score += variance * 100;

  // ... rest unchanged ...
}
\`\`\`

## Deine Antwort sollte enthalten

1. ✅ Ist mein vereinfachter Ansatz korrekt? Oder zu simpel?
2. ✅ Was genau meintest du mit "teamRestMap ersetzen"? (existiert nicht im Code)
3. ✅ Soll der FairnessCalculator mehr machen als nur Variance cachen?
4. ✅ Konkrete Code-Beispiele wie du es implementieren würdest

**Bitte sei präzise und gib Code-Beispiele mit exakten Signaturen.**
`;

  try {
    const clarification = await callAdessoAPI(prompt);

    console.log('✅ Clarification received!\n');
    console.log('='.repeat(80));
    console.log(clarification);
    console.log('='.repeat(80));

    // Save clarification to file
    const outputPath = path.join(__dirname, 'docs', 'fairnesscalculator-clarification.md');
    const fullOutput = `# FairnessCalculator Implementation - Klärung mit adesso Agent

> **Erstellt:** ${new Date().toISOString().split('T')[0]}
> **Model:** ${ADESSO_MODEL}
> **Kontext:** Diskrepanz zwischen Plan und tatsächlichem Code

---

## 🤔 Meine Frage

Der Plan erwähnt \`teamRestMap\`, aber dieser existiert nicht im Code.
Der Code verwendet \`Map<string, TeamScheduleState>\`.

Was genau soll der FairnessCalculator machen?

---

## 💡 adesso Agent Antwort

${clarification}

---

## Metadaten

- **Timestamp:** ${new Date().toISOString()}
- **Grund:** Plan-Implementierung vorbereiten
- **Nächster Schritt:** Plan entsprechend anpassen
`;

    fs.writeFileSync(outputPath, fullOutput, 'utf-8');
    console.log(`\n💾 Clarification saved to: ${outputPath}\n`);

  } catch (error) {
    console.error('❌ Error during clarification:', error.message);
    process.exit(1);
  }
}

main();
