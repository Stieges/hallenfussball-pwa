# User-Feedback Analyse - 23.12.2025

## Übersicht

| # | Feature-Request | Quelle | Komplexität | Passt zu PWA? |
|---|-----------------|--------|-------------|---------------|
| 1 | Folgeturniere / Liga-Stufen | User 1 | Sehr Hoch | Ja (Erweiterung) |
| 2 | Zwillingsspiele (BFV D-Junioren) | User 2 | Sehr Hoch | Nein (Outdoor) |
| 3 | Event-Timestamps für Video | User 3 | Niedrig | Ja |
| 4 | Torschützen-Erfassung | User 4 | Mittel | Ja |

---

## Feedback 1: Folgeturniere / Liga-Stufen

### Beschreibung

> "Bei Turnieren wie beim Olydorf-Cup spielen die hinteren Plätze ein eigenes Turnier (Gold-Silber-Bronze oder Champions-League / Europa-League / Hobby-League)"

### Analyse

**Referenz:** [meinturnierplan.de - U11 OLYDORF-CUP 2025](https://www.meinturnierplan.de/showit.php?id=1749312871)

**Konzept:**
- Nach der Vorrunde werden Teams basierend auf Platzierung in **separate Folgeturniere** aufgeteilt
- Beispiel bei 24 Teams (4 Gruppen à 6 Teams):
  - **Gold-Runde**: Plätze 1-2 jeder Gruppe → 8 Teams → eigenes KO-Turnier
  - **Silber-Runde**: Plätze 3-4 jeder Gruppe → 8 Teams → eigenes KO-Turnier
  - **Bronze-Runde**: Plätze 5-6 jeder Gruppe → 8 Teams → eigenes KO-Turnier

**Technische Struktur (meinturnierplan.de):**
```
Tournament {
  id: 269556 (Vorrunde)
  followups: [
    { id: 269571, slug: "hauptrunde" }
  ]
}
```

### Bewertung

| Aspekt | Bewertung |
|--------|-----------|
| **Use Case** | Große Hallenturniere mit 16+ Teams |
| **Aufwand** | Sehr Hoch (20-40h) |
| **Architektur-Impact** | Hoch - Turnier-Verkettung, neue Datenstruktur |
| **Priorität** | Niedrig (Nischen-Feature) |

### Was wäre nötig?

1. **Neues Konzept**: `TournamentChain` oder `FollowupTournament`
2. **Automatische Team-Verteilung** basierend auf Gruppenplatzierung
3. **Navigation** zwischen verketteten Turnieren
4. **Separate Tabellen** pro Folgeturnier

### Fazit

**Nicht für MVP geeignet.** Erfordert signifikante Architektur-Änderungen. Könnte als "Pro-Feature" für große Veranstalter später relevant sein.

---

## Feedback 2: Zwillingsspiele (BFV D-Junioren)

### Beschreibung

> "Zwei Mannschaften werden auf 2 Spielfelder aufgeteilt und spielen jeweils 6 Spiele parallel. Jedes gewonnene Spiel zählt als 'Tor' für die jeweilige Mannschaft."

### Analyse (aus BFV-Folien)

**Quelle:** [BFV D-Junioren Zwillingsspielbetrieb](https://www.bfv.de/bildung-und-foerderung/talente-und-auswahlteams/d-junioren-zwillingsspiel)

**Das Format im Detail:**

```
┌─────────────────────────────────────────────────────────────┐
│                    NORMALFELD (Großfeld)                     │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────┐    ┌─────────────────────┐         │
│  │    SPIELFELD 1      │    │    SPIELFELD 2      │         │
│  │      7 vs 7         │    │      7 vs 7         │         │
│  │   Team A vs B       │    │   Team A vs B       │         │
│  └─────────────────────┘    └─────────────────────┘         │
│                                                              │
│  28 Kinder spielen gleichzeitig (statt 18 bei 9vs9)         │
└─────────────────────────────────────────────────────────────┘
```

**Spielstruktur:**
- **6 Spielabschnitte** à 12 Minuten (= 72 Min Gesamtspielzeit)
- **Pausen:** 2-3 Min zwischen Abschnitten, 5-10 Min "Halbzeit"
- **Kein Abseits**, Rückpassregel gilt
- **Wechsel** nur zwischen Spielabschnitten

**Ergebnis-Aggregation:**

| Spielabschnitt | Feld 1 | Feld 2 | Gewonnen |
|----------------|--------|--------|----------|
| 1 | A 2:1 B | A 0:1 B | A=1, B=1 |
| 2 | A 1:0 B | A 2:0 B | A=2, B=0 |
| 3 | A 0:0 B | A 1:1 B | A=0, B=0 |
| 4 | A 3:1 B | A 0:2 B | A=1, B=1 |
| 5 | A 1:0 B | A 1:0 B | A=2, B=0 |
| 6 | A 0:1 B | A 2:1 B | A=1, B=1 |
| **GESAMT** | | | **A=7, B=3** |

**Endergebnis:** Team A gewinnt 7:3 → 3 Punkte für A

**Besonderheiten:**
- "Tore" in der Tabelle = Anzahl gewonnener Spielabschnitte (nicht echte Tore!)
- Unentschiedene Spielabschnitte werden NICHT gezählt
- **Keine Torschützenliste** (BFV-Regelung)

### Bewertung

| Aspekt | Bewertung |
|--------|-----------|
| **Use Case** | BFV D-Junioren Förderliga (draußen, nicht Halle!) |
| **Aufwand** | Sehr Hoch (30-50h) |
| **Architektur-Impact** | Extrem Hoch - komplett neues Spielmodell |
| **Priorität** | Sehr Niedrig |

### Was wäre nötig?

1. **Neuer Turniermodus**: `twinMatch` mit Multi-Feld-Support
2. **Spielabschnitt-Tracking** statt einfacher Tor-Erfassung
3. **Parallele Timer** für 2 Felder
4. **Aggregations-Logik** für Endergebnis
5. **Angepasste Tabellen-Berechnung**

### Fazit

**Außerhalb des Scope.** Dies ist ein Outdoor-Format für Vereins-Ligabetrieb, nicht für Hallenturniere. Die PWA fokussiert auf Hallenfußball-Turniere. Eventuell als separates Produkt/Modul in Zukunft.

---

## Feedback 3: Event-Timestamps für Video

### Beschreibung

> "Der Timestamp wäre praktisch, weil ich die Spiele filme und beim Hochladen in YouTube die Sprungmarken richtig setzen muss."

### Analyse

**Bestehende Infrastruktur:**

```typescript
// src/hooks/useLiveMatches.ts (Zeile 25-38)
export interface MatchEvent {
  id: string;
  matchId: string;
  timestampSeconds: number;  // ✅ Spielminute existiert!
  type: 'GOAL' | 'RESULT_EDIT' | 'STATUS_CHANGE';
  payload: {
    teamId?: string;
    teamName?: string;
    direction?: 'INC' | 'DEC';
    // ...
  };
  scoreAfter: { home: number; away: number };
}
```

**Was existiert:**
- ✅ `timestampSeconds` - Spielminute des Events
- ✅ Events werden pro Match gespeichert
- ✅ Event-Liste wird im UI angezeigt

**Was fehlt:**
- ❌ **Echtzeit-Timestamp** (Uhrzeit, nicht nur Spielminute)
- ❌ **Export-Funktion** für Events (CSV, JSON)
- ❌ **YouTube-Kapitel-Format** Export

### Lösungsvorschlag

**Erweiterung von MatchEvent:**

```typescript
export interface MatchEvent {
  // Bestehend
  id: string;
  matchId: string;
  timestampSeconds: number;  // Spielminute
  type: 'GOAL' | 'RESULT_EDIT' | 'STATUS_CHANGE';

  // NEU: Echtzeit für Video-Export
  realTimeISO?: string;  // "2025-12-23T14:32:15.000Z"
}
```

**Export-Formate:**

```
YouTube-Kapitel Format:
00:00 Anpfiff
03:45 Tor FC Bayern (1:0)
07:22 Tor TSV München (1:1)
12:00 Halbzeit
15:33 Tor FC Bayern (2:1)
24:00 Abpfiff

CSV:
Zeit;Event;Team;Stand
03:45;Tor;FC Bayern;1:0
07:22;Tor;TSV München;1:1
```

### Bewertung

| Aspekt | Bewertung |
|--------|-----------|
| **Use Case** | Video-Produktion, Statistik |
| **Aufwand** | Niedrig (2-4h) |
| **Architektur-Impact** | Minimal |
| **Priorität** | Mittel |

### Was wäre nötig?

1. **`realTimeISO` Feld** zu MatchEvent hinzufügen (1h)
2. **Export-Button** in Event-Liste (1h)
3. **YouTube-Kapitel-Format** Generator (1h)
4. **CSV-Export** (1h)

### Fazit

**Quick Win!** Minimaler Aufwand, hoher Nutzen für Content-Creator. Die Basis existiert bereits.

---

## Feedback 4: Torschützen-Erfassung

### Beschreibung

> "Wenn man erfassen kann, wann das Tor gefallen ist und die Rückennummer vom Torschützen, dann kann man viel leichter den Torschützenkönig ermitteln."

**Zusatz:** "Vielleicht nicht nur im Reiter Turnierleitung sondern auch auf Ebene der Zuschauer als Notiz."

### Analyse

**Bestehende Event-Struktur:**

```typescript
// Aktuell bei GOAL-Event:
payload: {
  teamId?: string;
  teamName?: string;
  direction?: 'INC' | 'DEC';
}
```

**Was fehlt:**
- ❌ `scorerId` - Spieler-ID
- ❌ `scorerNumber` - Rückennummer
- ❌ `scorerName` - Name des Torschützen
- ❌ Spieler-Kader pro Team

### Lösungsvorschlag

**Option A: Einfach (nur Nummer + Name)**

```typescript
payload: {
  // Bestehend
  teamId?: string;
  teamName?: string;
  direction?: 'INC' | 'DEC';

  // NEU: Torschütze
  scorerNumber?: number;  // Rückennummer (z.B. 10)
  scorerName?: string;    // Name (optional, z.B. "Max")
}
```

**Option B: Mit Kader-System**

```typescript
// Neues Interface
interface Player {
  id: string;
  number: number;
  name: string;
  teamId: string;
}

// Im Tournament
interface Team {
  id: string;
  name: string;
  roster?: Player[];  // Kader
}

// Im Event
payload: {
  scorerId?: string;  // Referenz auf Player
}
```

**Zuschauer-Notizen (Zusatz-Feature):**

```typescript
interface ViewerNote {
  id: string;
  matchId: string;
  timestampSeconds: number;
  text: string;
  createdBy: 'viewer';  // Unterscheidung von offiziellen Events
}
```

### Bewertung

| Aspekt | Bewertung |
|--------|-----------|
| **Use Case** | Torschützenkönig, Statistik, Highlights |
| **Aufwand** | Mittel (4-8h für Option A, 15-20h für Option B) |
| **Architektur-Impact** | Mittel |
| **Priorität** | Mittel |

### Empfehlung

**Option A zuerst** - Einfache Nummer+Name Erfassung ohne Kader-System:

1. **Quick-Input** beim Tor: Optionales Nummernfeld (1-2 Ziffern)
2. **Torschützenliste** als neue Ansicht
3. **Später** Kader-System für erweiterte Statistik

### Fazit

**Sinnvolles Feature** mit klarem Mehrwert. Option A als MVP, Option B als Erweiterung.

---

## Zusammenfassung & Empfehlung

### Priorisierung

| Priorität | Feature | Aufwand | Begründung |
|-----------|---------|---------|------------|
| **1** | Event-Timestamps Export | 2-4h | Quick Win, existierende Basis |
| **2** | Torschützen (einfach) | 4-8h | Klarer User-Value |
| **3** | Folgeturniere | 20-40h | Nischen-Feature |
| **-** | Zwillingsspiele | 30-50h | Out of Scope (Outdoor) |

### Nächste Schritte

1. **Kurzfristig:** US-EVENT-TIMESTAMPS als User Story anlegen
2. **Mittelfristig:** US-SCORER-TRACKING (Option A) als User Story
3. **Langfristig:** US-TOURNAMENT-LEAGUES evaluieren
4. **Nicht geplant:** Zwillingsspiele (separates Produkt)

---

## Quellen

- [meinturnierplan.de - OLYDORF-CUP](https://www.meinturnierplan.de/showit.php?id=1749312871)
- [BFV D-Junioren Zwillingsspielbetrieb](https://www.bfv.de/bildung-und-foerderung/talente-und-auswahlteams/d-junioren-zwillingsspiel)
- BFV Erklärfolien "D-Junioren im Zwillingsspielbetrieb" (PDF)
