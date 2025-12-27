# Turnierschema - Verbesserungen implementiert

## ✅ Umgesetzte Verbesserungen

### 1. **Erweiterte Inputs**
Neue Felder in `TournamentConfiguration`:
- `totalTeams` - Gesamtanzahl aller Teams
- `teamsPerGroup` - Anzahl Teams pro Gruppe
- `hasFifthSixth` - Spiel um Platz 5/6
- `hasSeventhEighth` - Spiel um Platz 7/8
- `useDFBKeys` - Verwendung des DFB-Schlüsselsystems
- `dfbKeyPattern` - z.B. "1T06M" für 6 Teams

### 2. **Erweiterte Constraints**
Neue Validierungen:
- ✅ `constraint_thirdplace_requires_semi` - Spiel um Platz 3 erfordert Halbfinale
- ✅ `constraint_placement_56_requires_quarterfinal` - Platz 5/6 erfordert Viertelfinale
- ✅ `constraint_placement_78_requires_quarterfinal` - Platz 7/8 erfordert Viertelfinale

### 3. **Shared Placement Match Templates**
Vermeidet Code-Duplikation:
```typescript
const SHARED_PLACEMENT_MATCHES = {
  thirdPlace: () => PlacementMatch,
  fifthSixth: () => PlacementMatch,
  seventhEighth: () => PlacementMatch,
};
```

**Verwendung in Cases:**
```typescript
placement: [
  SHARED_PLACEMENT_MATCHES.thirdPlace(),
  SHARED_PLACEMENT_MATCHES.fifthSixth('QF1', 'QF2'),
  SHARED_PLACEMENT_MATCHES.seventhEighth('QF3', 'QF4'),
]
```

### 4. **DFB-Schlüsselsystem Integration**
Neue Datei: `dfbMatchPatterns.ts`

**Enthaltene Patterns:**
- 1T02M - 2 Teams (1 Spiel)
- 1T03M - 3 Teams (3 Spiele)
- 1T04M - 4 Teams (6 Spiele)
- 1T05M - 5 Teams (10 Spiele)
- 1T06M - 6 Teams (15 Spiele)
- 1T07M - 7 Teams (21 Spiele)
- 1T08M - 8 Teams (28 Spiele)
- 1T09M - 9 Teams (36 Spiele)
- 1T10M - 10 Teams (45 Spiele)
- 1T11M - 11 Teams (55 Spiele)

**Funktionen:**
- `getDFBPattern(teamCount)` - Findet passendes Pattern
- `parseDFBMatches(pattern)` - Konvertiert zu Match-Objekten

**Beispiel:**
```typescript
const pattern = getDFBPattern(6); // 1T06M
const matches = parseDFBMatches(pattern);
// Ergibt: [
//   { round: 1, home: 1, away: 5 },
//   { round: 1, home: 4, away: 1 },
//   { round: 1, home: 1, away: 3 },
//   ...
// ]
```

---

## 📋 Noch zu implementieren

### 5. **UI-Komponente für DFB-Logik**
In `Step2_ModeAndSystem.tsx` ergänzen:

```typescript
{/* DFB Schlüsselsystem Option */}
{formData.groupSystem === 'roundRobin' && (
  <div style={{ marginTop: '24px' }}>
    <label>
      <input
        type="checkbox"
        checked={useDFBKeys}
        onChange={(e) => setUseDFBKeys(e.target.checked)}
      />
      DFB-Schlüsselsystem verwenden
    </label>

    {useDFBKeys && (
      <Select
        label="Muster"
        options={dfbPatternOptions}
        value={selectedPattern}
      />
    )}
  </div>
)}
```

### 6. **Dynamische Platzierungsspiele**
Placement-Matches sollten basierend auf Checkboxen dynamisch hinzugefügt werden:

```typescript
const getPlacementMatches = (config: TournamentConfiguration) => {
  const matches: PlacementMatch[] = [];

  if (config.hasThirdPlace) {
    matches.push(SHARED_PLACEMENT_MATCHES.thirdPlace());
  }

  if (config.hasFifthSixth) {
    matches.push(SHARED_PLACEMENT_MATCHES.fifthSixth());
  }

  if (config.hasSeventhEighth) {
    matches.push(SHARED_PLACEMENT_MATCHES.seventhEighth());
  }

  return matches;
};
```

### 7. **Team-Eingabe basierend auf Konfiguration**
In `Step4_Teams.tsx`:
- Anzahl Felder sollte automatisch generiert werden basierend auf `totalTeams` und `teamsPerGroup`
- Bei 2 Gruppen á 4 Teams → 8 Eingabefelder mit Gruppenzuweisung

---

## 🎯 Beispiel: Problem 6 erklärt

**Problem:** Was ist "bestSecond" Logik?

**Kontext:**
Bei 3 Gruppen gibt es 3 Gruppensieger, aber nur 4 Teams für HF (2 Spiele). Der "beste Zweite" wird benötigt.

**Aktuelle Lösung (case_3groups_semi_final):**
```typescript
{
  matchId: 'SF1',
  home: { source: 'groupStanding', groupId: 'A', position: 1 },
  away: { source: 'groupStanding', groupId: 'bestSecond', position: 2 }
}
```

**Problem:** `groupId: 'bestSecond'` ist ein Magic String ohne Definition.

**Lösungsvorschläge:**

**Option A:** Neue TeamSource
```typescript
{
  source: 'bestOfType',
  type: 'second',
  compareBy: ['points', 'goalDifference', 'goalsFor']
}
```

**Option B:** Runtime-Berechnung dokumentieren
```typescript
// In Schema Note:
note: 'Der beste Zweitplatzierte wird zur Laufzeit über die Platzierungslogik ermittelt'
```

**Option C:** Explizite Regel
```typescript
bestSecondLogic: {
  compareGroups: ['A', 'B', 'C'],
  position: 2,
  criteria: ['points', 'goalDifference', 'goalsFor']
}
```

---

## 📊 Zusammenfassung

**Abgeschlossen:**
- ✅ Inputs erweitert (hasFifthSixth, hasSeventhEighth, totalTeams, teamsPerGroup)
- ✅ Neue Constraints für Platzierungsspiele
- ✅ Shared Templates erstellt
- ✅ DFB-Schlüsselsystem aus PDF analysiert und implementiert

**In Arbeit:**
- 🔄 UI-Komponente für DFB-Auswahl
- 🔄 Dynamische Team-Eingabe

**Ausstehend:**
- ⏳ "bestSecond" Logik definieren
- ⏳ Priority/Fallback-System für Cases
- ⏳ Mehr Cases für 3+ Gruppen
