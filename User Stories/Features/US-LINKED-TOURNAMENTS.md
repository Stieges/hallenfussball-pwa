# US-LINKED-TOURNAMENTS: Verbundene Turniere

## Übersicht

| Feld | Wert |
|------|------|
| **ID** | US-LINKED-TOURNAMENTS |
| **Priorität** | Low |
| **Status** | Draft |
| **Erstellt** | 2025-12-22 |
| **Kategorie** | Turnier-Management |
| **Aufwand** | Sehr Hoch (20-40h) |
| **Impact** | Sehr Niedrig |

---

## User Story

**Als** Turnierleiter einer Turnierserie (z.B. Stadtmeisterschaft mit Vorrunden)
**möchte ich** mehrere Turniere miteinander verknüpfen können
**damit** Teams automatisch basierend auf Platzierungen in Folge-Turniere übernommen werden

---

## Kontext

Große Turnierserien bestehen oft aus mehreren Stufen:
- **Qualifikationsrunden** in verschiedenen Hallen → Beste qualifizieren sich
- **Endrunde** mit den Qualifizierten aus allen Vorrunden
- **Beispiel:** Stadtmeisterschaft mit 4 Vorrunden-Turnieren → 1 Finalturnier

### Komplexität

Dieses Feature ist **hochkomplex** weil es erfordert:
1. Daten-Synchronisation zwischen Turnieren
2. Regel-Engine für Qualifikation
3. UI für Turnier-Verknüpfung
4. Konflikt-Handling wenn Turniere noch laufen

---

## Acceptance Criteria

### AC1-4: Turnier-Verknüpfung erstellen

1. Given ich habe mehrere Turniere, When ich ein neues "Verbundenes Turnier" erstelle, Then kann ich Quell-Turniere auswählen.

2. Given ich verknüpfe Turniere, Then definiere ich Qualifikationsregeln:
   - "Platz 1-2 jeder Gruppe qualifiziert sich"
   - "Beste 8 Teams insgesamt"
   - "Alle Teams mit mind. 4 Punkten"

3. Given ein Quell-Turnier ist abgeschlossen, Then werden die qualifizierten Teams automatisch ins Ziel-Turnier übernommen.

4. Given ein Quell-Turnier wurde nachträglich geändert, Then erhalte ich eine Warnung im Ziel-Turnier.

### AC5-8: Ansicht und Navigation

5. Given ich bin in einem verknüpften Turnier, Then sehe ich einen Hinweis "Teil der Serie: Stadtmeisterschaft 2025".

6. Given ich klicke auf die Serie, Then sehe ich alle verknüpften Turniere und deren Status.

7. Given ich bin in der Serien-Übersicht, Then sehe ich welche Teams sich bereits qualifiziert haben.

8. Given alle Quell-Turniere sind abgeschlossen, Then kann ich das Ziel-Turnier mit einem Klick "starten".

### AC9-12: Daten-Konsistenz

9. Given ein Team ist in mehreren Quell-Turnieren, Then werden die Ergebnisse zusammengeführt (Gesamtpunkte, Tordifferenz).

10. Given ein Quell-Turnier wird gelöscht, Then erhalte ich eine Warnung mit Auswirkungen auf die Serie.

11. Given ich möchte manuell ein Team zur Endrunde hinzufügen (Wildcard), Then ist das möglich mit Kennzeichnung.

12. Given die Qualifikationsregeln ändern sich, Then werden die qualifizierten Teams neu berechnet.

---

## Architektur-Optionen

### Option A: Lokale Verknüpfung (Nur localStorage)

**Vorteile:**
- Kein Backend nötig
- Funktioniert offline

**Nachteile:**
- Alle Turniere müssen auf EINEM Gerät sein
- Keine verteilte Turnier-Verwaltung

```typescript
interface TournamentSeries {
  id: string;
  name: string;
  sourceTournamentIds: string[];
  targetTournamentId: string;
  qualificationRules: QualificationRule[];
}

interface QualificationRule {
  type: 'top-n-per-group' | 'top-n-overall' | 'min-points';
  value: number;
}
```

### Option B: Cloud-Synchronisation (Supabase/Firebase)

**Vorteile:**
- Mehrere Geräte können Turniere verwalten
- Echte verteilte Turnier-Serie

**Nachteile:**
- Backend erforderlich
- Authentifizierung nötig
- Komplexität steigt enorm

### Option C: Export/Import (Pragmatisch)

**Vorteile:**
- Einfach umzusetzen
- Keine Echtzeit-Sync nötig

**Nachteile:**
- Manueller Export/Import
- Keine automatische Aktualisierung

```typescript
// Turnier A exportiert qualifizierte Teams als JSON
function exportQualifiedTeams(
  tournament: Tournament,
  rules: QualificationRule[]
): ExportedTeams {
  const qualified = calculateQualifiedTeams(tournament, rules);
  return {
    sourceTournamentId: tournament.id,
    sourceTournamentName: tournament.title,
    exportedAt: new Date().toISOString(),
    teams: qualified,
  };
}

// Turnier B importiert
function importTeams(data: ExportedTeams): Team[] {
  // ...
}
```

---

## Empfehlung: Phasenweise Umsetzung

### Phase 1: Export/Import (4-6h)
- [ ] "Qualifizierte Teams exportieren" Button
- [ ] Export als JSON oder CSV
- [ ] "Teams importieren" im Ziel-Turnier
- [ ] Markierung als "Importiert von: [Turnier]"

### Phase 2: Lokale Verknüpfung (8-12h)
- [ ] TournamentSeries Datenmodell
- [ ] UI zur Serien-Erstellung
- [ ] Automatische Team-Übernahme
- [ ] Serien-Übersicht

### Phase 3: Cloud-Sync (20-40h)
- [ ] Backend-Integration (Supabase?)
- [ ] Authentifizierung
- [ ] Echtzeit-Synchronisation
- [ ] Multi-Device Support

---

## UI-Konzept

### Serien-Übersicht

```
┌─────────────────────────────────────────────────────────────┐
│ Stadtmeisterschaft 2025                                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Vorrunden:                                                 │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ ✅ Halle Nord         │ 8 Teams │ Abgeschlossen     │   │
│  │    → 2 qualifiziert: FC Nord, SC Blau              │   │
│  ├─────────────────────────────────────────────────────┤   │
│  │ ✅ Halle Süd          │ 8 Teams │ Abgeschlossen     │   │
│  │    → 2 qualifiziert: SV Süd, TSV Gelb              │   │
│  ├─────────────────────────────────────────────────────┤   │
│  │ 🔄 Halle Ost          │ 8 Teams │ Läuft noch...     │   │
│  │    → Qualifikation ausstehend                       │   │
│  ├─────────────────────────────────────────────────────┤   │
│  │ ⏳ Halle West         │ 8 Teams │ Nicht gestartet   │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Endrunde:                                                  │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ ⏳ Finale             │ 4/8 Teams │ Wartet auf      │   │
│  │                       │           │ Vorrunden       │   │
│  │    Bereits qualifiziert:                            │   │
│  │    • FC Nord (Halle Nord, Platz 1)                  │   │
│  │    • SC Blau (Halle Nord, Platz 2)                  │   │
│  │    • SV Süd (Halle Süd, Platz 1)                    │   │
│  │    • TSV Gelb (Halle Süd, Platz 2)                  │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  [Alle Vorrunden abwarten] [Finale starten]                │
└─────────────────────────────────────────────────────────────┘
```

---

## Risiken

| Risiko | Impact | Wahrscheinlichkeit | Mitigation |
|--------|--------|-------------------|------------|
| Daten-Inkonsistenz | Hoch | Mittel | Validierung + Warnungen |
| Überkomplexität | Hoch | Hoch | Phasenweise Umsetzung |
| User-Verwirrung | Mittel | Mittel | Klare UI-Führung |
| Performance | Mittel | Niedrig | Lazy Loading |

---

## Alternativen

Wenn die vollständige Umsetzung zu aufwändig ist:

1. **Manueller Workflow dokumentieren:**
   - Anleitung "Wie übertrage ich Teams zwischen Turnieren?"
   - CSV-Export der Platzierungen

2. **Einfache Turnier-Kopie mit Teams:**
   - "Turnier kopieren" mit Option "Teams beibehalten"
   - Manuelles Entfernen nicht-qualifizierter Teams

---

## Verwandte User Stories

- **US-TOURNAMENT-COPY:** Basis für Team-Übernahme
- **RANKING:** Platzierungsberechnung
- **US-INVITE:** Teilen von Turnier-Links
