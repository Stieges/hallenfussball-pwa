# Umsetzungsplan: Deprecated API Migration

**Datum:** 2026-01-05
**Ziel:** Saubere Entfernung der deprecated Event-Felder ohne Legacy-Mapping

---

## Übersicht

Die deprecated Felder (`assistPlayerNumber`, `playerOutNumber`, `playerInNumber`) sind **nur in Type-Definitionen** vorhanden und werden **nirgends im Code verwendet**. Die neuen Array-Felder (`assists`, `playersOut`, `playersIn`) sind bereits durchgängig im Einsatz.

---

## Phase 1: Type Cleanup

### 1.1 Haupt-Types bereinigen (tournament.ts)

**Datei:** `src/types/tournament.ts`

**Änderungen:**

1. **MatchEvent Interface (Zeile 605-638)**
   - Entfernen: `assistPlayerNumber?: number;` (Zeile 614)
   - Entfernen: `playerOutNumber?: number;` (Zeile 621)
   - Entfernen: `playerInNumber?: number;` (Zeile 622)
   - Hinzufügen: `assists?: number[];`
   - Hinzufügen: `playersOut?: number[];`
   - Hinzufügen: `playersIn?: number[];`

2. **RuntimeMatchEvent.payload (Zeile 652-677)**
   - Entfernen: `assistPlayerNumber?: number;` + @deprecated Kommentar (Zeile 662-663)
   - Entfernen: `playerOutNumber?: number;` + @deprecated Kommentar (Zeile 668-669)
   - Entfernen: `playerInNumber?: number;` + @deprecated Kommentar (Zeile 670-671)

---

### 1.2 Duplizierte Type-Definitionen entfernen

**Problem:** `MatchEvent` wird in 3 Dateien identisch definiert statt importiert.

**Dateien:**
- `src/components/match-cockpit/MatchCockpit.tsx` (Zeile 44-69)
- `src/hooks/useLiveMatches.ts` (Zeile 38-66)

**Lösung:** Lokale Type-Definitionen durch Import ersetzen:

```typescript
// Vorher (in MatchCockpit.tsx und useLiveMatches.ts):
interface MatchEvent {
  id: string;
  // ... 25 Zeilen duplizierter Code
}

// Nachher:
import type { RuntimeMatchEvent } from '../../types/tournament';
// Alias für Kompatibilität falls nötig:
type MatchEvent = RuntimeMatchEvent;
```

---

### 1.3 Inkonsistente Benennung korrigieren

**Datei:** `src/components/schedule/MatchExpand/DetailExpand.tsx`

**Änderung:**
```typescript
// Zeile 45 - Vorher:
assistPlayerNumbers?: number[];

// Nachher:
assists?: number[];
```

---

## Phase 2: Komponenten aktualisieren

### 2.1 EventsList Panel

**Datei:** `src/components/match-cockpit/panels/EventsList.tsx`

Type-Definition bereits korrekt (`assists`, `playersOut`, `playersIn`). Keine Änderung nötig.

### 2.2 GoalList Komponenten

**Dateien:**
- `src/components/schedule/GoalList/GoalList.tsx`
- `src/components/schedule/GoalList/GoalListItem.tsx`

Bereits korrekt mit `assists?: number[]`. Keine Änderung nötig.

### 2.3 Live-Cockpit Types

**Datei:** `src/components/live-cockpit/types.ts`

Bereits korrekt. Keine Änderung nötig.

---

## Phase 3: Migration für bestehende Daten

### 3.1 Event Migration Funktion

**Datei:** `src/utils/tournamentMigration.ts`

Neue Funktion hinzufügen:

```typescript
/**
 * Migriert Events von deprecated single-value zu array Format
 * Idempotent - kann mehrfach ausgeführt werden
 */
export function migrateMatchEvents(events: RuntimeMatchEvent[]): RuntimeMatchEvent[] {
  return events.map(event => {
    const { payload } = event;
    if (!payload) return event;

    // Bereits migriert oder keine deprecated Felder
    const hasDeprecated =
      'assistPlayerNumber' in payload ||
      'playerOutNumber' in payload ||
      'playerInNumber' in payload;

    if (!hasDeprecated) return event;

    // Migration durchführen
    const migratedPayload = { ...payload };

    // assistPlayerNumber -> assists
    if ('assistPlayerNumber' in payload && payload.assistPlayerNumber !== undefined) {
      migratedPayload.assists = migratedPayload.assists ?? [payload.assistPlayerNumber];
      delete (migratedPayload as Record<string, unknown>).assistPlayerNumber;
    }

    // playerOutNumber -> playersOut
    if ('playerOutNumber' in payload && payload.playerOutNumber !== undefined) {
      migratedPayload.playersOut = migratedPayload.playersOut ?? [payload.playerOutNumber];
      delete (migratedPayload as Record<string, unknown>).playerOutNumber;
    }

    // playerInNumber -> playersIn
    if ('playerInNumber' in payload && payload.playerInNumber !== undefined) {
      migratedPayload.playersIn = migratedPayload.playersIn ?? [payload.playerInNumber];
      delete (migratedPayload as Record<string, unknown>).playerInNumber;
    }

    return { ...event, payload: migratedPayload };
  });
}
```

### 3.2 Migration in Tournament-Load integrieren

In `migrateTournament()` die Event-Migration für alle Matches aufrufen.

---

## Phase 4: Schema Version Update

**Datei:** `src/utils/tournamentMigration.ts`

```typescript
// Vorher:
export const CURRENT_SCHEMA_VERSION = 2;

// Nachher:
export const CURRENT_SCHEMA_VERSION = 3;

/**
 * Schema-Version-Mapping:
 * - 1: Original-Schema (vor Monitor-Konfigurator)
 * - 2: Monitor-Konfigurator (monitors[], sponsors[], monitorTemplates[])
 * - 3: Event-Felder Migration (deprecated single -> arrays)
 */
```

---

## Priorisierte Reihenfolge

| # | Task | Dateien | Risiko |
|---|------|---------|--------|
| 1 | Type Cleanup in tournament.ts | 1 | Niedrig |
| 2 | Duplizierte Types durch Imports ersetzen | 2 | Mittel |
| 3 | DetailExpand.tsx Feldname korrigieren | 1 | Niedrig |
| 4 | Event Migration Funktion | 1 | Niedrig |
| 5 | Schema Version erhöhen | 1 | Niedrig |
| 6 | Build & Test | - | - |

---

## Betroffene Dateien (Zusammenfassung)

**Änderungen:**
- `src/types/tournament.ts` - Deprecated Felder entfernen
- `src/components/match-cockpit/MatchCockpit.tsx` - Import statt lokaler Type
- `src/hooks/useLiveMatches.ts` - Import statt lokaler Type
- `src/components/schedule/MatchExpand/DetailExpand.tsx` - Feldname korrigieren
- `src/utils/tournamentMigration.ts` - Event Migration + Schema Version

**Keine Änderung nötig:**
- `src/components/match-cockpit/panels/EventsList.tsx`
- `src/components/schedule/GoalList/GoalList.tsx`
- `src/components/schedule/GoalList/GoalListItem.tsx`
- `src/components/live-cockpit/types.ts`
- `src/hooks/useLiveMatchManagement.ts`

---

## Rollback-Strategie

Da die deprecated Felder nirgends verwendet werden, ist ein Rollback durch einfaches Wiederherstellen der Type-Definitionen möglich. Die Migration-Funktion ist additiv und ändert keine Daten destruktiv.
