# Hallenfussball-PWA - Manuelle Testfälle

**Erstellt am:** 15. Dezember 2025
**Aktualisiert am:** 22. Dezember 2025
**Version:** 1.1.0

---

## Inhaltsverzeichnis

1. [Turnier-Erstellung](#1-turnier-erstellung)
2. [Team-Verwaltung](#2-team-verwaltung)
3. [Spielplan-Generierung](#3-spielplan-generierung)
4. [Ergebnis-Eingabe](#4-ergebnis-eingabe)
5. [Tabellen-Berechnung](#5-tabellen-berechnung)
6. [Playoff-Auflösung](#6-playoff-auflösung)
7. [Live-Match-Management](#7-live-match-management)
8. [PDF-Export](#8-pdf-export)
9. [Edge Cases & Fehlerszenarien](#9-edge-cases--fehlerszenarien)
10. [Menschliche Fehler](#10-menschliche-fehler)
11. [Bug-Fix Validierung](#11-bug-fix-validierung)

---

## 1. Turnier-Erstellung

### TC-1.1: Minimales Turnier erstellen
**Vorbedingung:** App ist gestartet, Dashboard wird angezeigt
**Schritte:**
1. Klicke auf "Neues Turnier erstellen"
2. Step 1: Wähle Sportart "Hallenfußball", Typ "Hallenturnier"
3. Step 2: Wähle Modus "Jeder gegen Jeden" (Round Robin)
4. Step 3: Gib Titel "Testturnier" ein, Datum heute, Startzeit 10:00
5. Step 4: Erstelle 4 Teams (Team 1-4)
6. Step 5: Prüfe Vorschau, klicke "Turnier veröffentlichen"

**Erwartetes Ergebnis:**
- Turnier wird erstellt
- Spielplan zeigt 6 Spiele (4 Teams = 4×3/2 = 6 Paarungen)
- Weiterleitung zum Dashboard

### TC-1.2: Turnier mit Gruppen + Finale
**Schritte:**
1. Erstelle neues Turnier
2. Step 2: Wähle "Gruppen + Finale"
3. Wähle 2 Gruppen, 8 Teams
4. Step 4: Erstelle 8 Teams, weise je 4 zu Gruppe A/B
5. Step 5: Wähle Finals-Preset "Top 4"

**Erwartetes Ergebnis:**
- 12 Gruppenspiele (6 pro Gruppe)
- 4 Playoff-Spiele (2 HF + Platz 3 + Finale)
- Playoff-Teams zeigen Platzhalter ("Gruppe A - 1. Platz")

### TC-1.3: Turnier mit ungerader Teamanzahl
**Schritte:**
1. Erstelle Round-Robin-Turnier mit 5 Teams

**Erwartetes Ergebnis:**
- 10 Spiele werden generiert (5×4/2)
- Jedes Team spielt 4 Spiele
- Keine "BYE"-Spiele in der Anzeige

### TC-1.4: Turnier mit vielen Teams (Stress-Test)
**Schritte:**
1. Erstelle Round-Robin-Turnier mit 16 Teams, 2 Felder

**Erwartetes Ergebnis:**
- 120 Spiele werden generiert
- Spielplan wird innerhalb von 10 Sekunden angezeigt
- Keine Timeout-Fehler

---

## 2. Team-Verwaltung

### TC-2.1: Teams manuell hinzufügen
**Schritte:**
1. In Step 4: Klicke "Team hinzufügen"
2. Gib Namen "FC Bayern" ein
3. Wiederhole für weitere Teams

**Erwartetes Ergebnis:**
- Teams werden der Liste hinzugefügt
- Nummerierung ist korrekt (1, 2, 3, ...)

### TC-2.2: Teams automatisch generieren
**Schritte:**
1. Setze "Anzahl Teams" auf 8
2. Klicke "8 Teams generieren"

**Erwartetes Ergebnis:**
- 8 Teams mit Namen "Team 1" bis "Team 8" werden erstellt

### TC-2.3: Gruppen automatisch zuweisen
**Vorbedingung:** 8 Teams erstellt, Modus "Gruppen + Finale" mit 2 Gruppen
**Schritte:**
1. Klicke "Gruppen automatisch zuweisen"

**Erwartetes Ergebnis:**
- Teams 1,3,5,7 → Gruppe A
- Teams 2,4,6,8 → Gruppe B

### TC-2.4: Team entfernen
**Schritte:**
1. Erstelle 5 Teams
2. Klicke auf X-Button bei Team 3

**Erwartetes Ergebnis:**
- Team 3 wird entfernt
- 4 Teams bleiben übrig
- Nummerierung passt sich an

### TC-2.5: Doppelte Team-Namen
**Schritte:**
1. Erstelle Team "FC Bayern"
2. Erstelle weiteres Team mit Namen "FC Bayern"

**Erwartetes Ergebnis:**
- ⚠️ **Aktuelles Verhalten:** Beide Teams werden akzeptiert (kein Fehler)
- **Empfohlen:** Warnung oder Validierung

---

## 3. Spielplan-Generierung

### TC-3.1: Zeitslots korrekt berechnet
**Vorbedingung:** Turnier mit 4 Teams, 1 Feld, Spielzeit 10 Min, Pause 2 Min
**Erwartetes Ergebnis:**
- Spiel 1: 10:00-10:10
- Spiel 2: 10:12-10:22
- Spiel 3: 10:24-10:34
- ...

### TC-3.2: Mehrere Felder parallel
**Vorbedingung:** 8 Teams, 2 Felder
**Erwartetes Ergebnis:**
- Jeweils 2 Spiele pro Zeitslot
- Spiele auf Feld 1 und Feld 2 alternieren

### TC-3.3: Mindest-Ruhezeit eingehalten
**Vorbedingung:** 8 Teams, 2 Felder, minRest = 1 Slot
**Erwartetes Ergebnis:**
- Kein Team spielt in aufeinanderfolgenden Slots
- Fairness-Verteilung ist ausgeglichen

### TC-3.4: Schiedsrichter-Zuweisung (Organizer-Modus)
**Vorbedingung:** SR-Modus = "Veranstalter", 2 Schiedsrichter
**Erwartetes Ergebnis:**
- SR1 und SR2 wechseln sich ab
- Maximal aufeinanderfolgende Spiele werden eingehalten

---

## 4. Ergebnis-Eingabe

### TC-4.1: Ergebnis eingeben (laufendes Spiel)
**Vorbedingung:** Turnier aktiv, Spielplan angezeigt
**Schritte:**
1. Öffne Tab "Spielplan"
2. Klicke auf Ergebnis-Feld von Spiel 1
3. Gib "3:1" ein

**Erwartetes Ergebnis:**
- Ergebnis wird gespeichert
- Tabelle aktualisiert sich
- Keine Warnung (Spiel noch nicht beendet)

### TC-4.2: Ergebnis eines beendeten Spiels ändern
**Vorbedingung:** Spiel wurde über Turnierleitung beendet
**Schritte:**
1. Versuche Ergebnis direkt zu ändern

**Erwartetes Ergebnis:**
- Warnung: "Dieses Spiel ist bereits beendet"
- Button "Ergebnis korrigieren" erscheint

### TC-4.3: Ergebnis korrigieren (Korrekturmodus)
**Schritte:**
1. Klicke "Ergebnis korrigieren"
2. Bestätige Warnung
3. Ändere von 3:1 auf 2:2
4. Bestätige Speichern

**Erwartetes Ergebnis:**
- Tabelle wird neu berechnet
- Korrigiertes Ergebnis wird gespeichert
- Confirmation-Dialog zeigt Auswirkungen

### TC-4.4: Nullergebnis eingeben
**Schritte:**
1. Gib "0:0" als Ergebnis ein

**Erwartetes Ergebnis:**
- Wird korrekt als Unentschieden gewertet
- Beide Teams erhalten Unentschieden-Punkte

### TC-4.5: Hohe Ergebnisse
**Schritte:**
1. Gib "15:0" als Ergebnis ein

**Erwartetes Ergebnis:**
- Wird akzeptiert
- Tordifferenz wird korrekt berechnet (+15 / -15)

---

## 5. Tabellen-Berechnung

### TC-5.1: Punkte korrekt vergeben
**Vorbedingung:** 3-1-0 Punktesystem
**Testdaten:**
- Team A vs Team B: 2:1 (Sieg A)
- Team A vs Team C: 1:1 (Unentschieden)

**Erwartetes Ergebnis:**
- Team A: 4 Punkte (3+1)
- Team B: 0 Punkte
- Team C: 1 Punkt

### TC-5.2: Tordifferenz-Sortierung
**Testdaten:** (alle 3 Punkte)
- Team A: 5:2 (Diff +3)
- Team B: 4:1 (Diff +3)
- Team C: 3:0 (Diff +3)

**Erwartetes Ergebnis:**
- Rangfolge nach Tore: A (5), B (4), C (3)

### TC-5.3: Direkter Vergleich
**Testdaten:** (gleiche Punkte, gleiche Tordifferenz)
- Team A vs Team B: 1:0
- Team A vs Team C: 0:1
- Team B vs Team C: 1:0

**Erwartetes Ergebnis:**
- Bei Punktgleichheit A-B: A gewinnt direkten Vergleich
- Rangfolge: C, A, B (je 3 Punkte, direkter Vergleich entscheidet)

### TC-5.4: Gruppenübergreifende Berechnung
**Vorbedingung:** 2 Gruppen mit je 4 Teams
**Erwartetes Ergebnis:**
- Gruppe A und Gruppe B haben separate Tabellen
- Gruppen-Matches beeinflussen nur eigene Tabelle

---

## 6. Playoff-Auflösung

### TC-6.1: Automatische Auflösung nach Gruppenphase
**Vorbedingung:** Alle Gruppenspiele haben Ergebnisse
**Schritte:**
1. Gib letztes Gruppenergebnis ein

**Erwartetes Ergebnis:**
- Playoff-Paarungen werden automatisch aufgelöst
- "Gruppe A - 1. Platz" → tatsächlicher Teamname
- Halbfinale zeigt echte Teams

### TC-6.2: Teilweise Gruppenphase
**Vorbedingung:** Nicht alle Gruppenspiele haben Ergebnisse
**Erwartetes Ergebnis:**
- Playoffs zeigen weiterhin Platzhalter
- Keine automatische Auflösung

### TC-6.3: Playoff-Ergebnisse eingeben
**Schritte:**
1. Gib Halbfinal-Ergebnisse ein
2. Prüfe Finale

**Erwartetes Ergebnis:**
- Finale zeigt Sieger der Halbfinals
- Platz-3-Spiel zeigt Verlierer

### TC-6.4: Finale ohne Halbfinale
**Vorbedingung:** Preset "final-only"
**Erwartetes Ergebnis:**
- Nur Finale wird generiert
- Direkt 1A vs 1B

---

## 7. Live-Match-Management

### TC-7.1: Spiel starten
**Schritte:**
1. Öffne Tab "Turnierleitung"
2. Wähle aktuelles Spiel
3. Klicke "Start"

**Erwartetes Ergebnis:**
- Timer startet
- Status wechselt zu "Läuft"

### TC-7.2: Tor erfassen
**Schritte:**
1. Spiel läuft
2. Klicke auf Team A "+1"

**Erwartetes Ergebnis:**
- Score erhöht sich
- Event wird im Log erfasst
- Spielzeit wird notiert

### TC-7.3: Tor zurücknehmen
**Schritte:**
1. Klicke "Undo"

**Erwartetes Ergebnis:**
- Letztes Event wird rückgängig
- Score passt sich an

### TC-7.4: Spiel pausieren und fortsetzen
**Schritte:**
1. Klicke "Pause"
2. Warte 30 Sekunden
3. Klicke "Fortsetzen"

**Erwartetes Ergebnis:**
- Timer pausiert
- Timer setzt an pausierter Stelle fort

### TC-7.5: Spiel beenden
**Schritte:**
1. Klicke "Beenden"

**Erwartetes Ergebnis:**
- Status wechselt zu "Beendet"
- Ergebnis wird in Spielplan übernommen
- Tabelle aktualisiert sich

### TC-7.6: Nächstes Spiel laden
**Schritte:**
1. Nach Beenden: Klicke "Nächstes Spiel"

**Erwartetes Ergebnis:**
- Nächstes geplantes Spiel wird geladen
- Timer steht auf 0:00

---

## 8. PDF-Export

### TC-8.1: Spielplan exportieren
**Schritte:**
1. Klicke "Als PDF exportieren"

**Erwartetes Ergebnis:**
- PDF wird generiert
- Enthält alle Spiele mit Zeiten
- Gruppen-Header sind sichtbar

### TC-8.2: Tabelle exportieren
**Erwartetes Ergebnis:**
- Aktuelle Tabelle ist im PDF
- Punkte, Tore, Differenz korrekt

### TC-8.3: Leere Ergebnisfelder
**Vorbedingung:** Noch keine Ergebnisse eingegeben
**Erwartetes Ergebnis:**
- PDF zeigt "__ : __" für ausstehende Spiele

---

## 9. Edge Cases & Fehlerszenarien

### TC-9.1: Browser-Refresh während Turnier
**Schritte:**
1. Turnier ist aktiv
2. Drücke F5

**Erwartetes Ergebnis:**
- Turnier wird aus localStorage geladen
- Alle Daten bleiben erhalten

### TC-9.2: LocalStorage voll
**Vorbedingung:** localStorage nahe am Limit (5MB)
**Erwartetes Ergebnis:**
- ⚠️ **Aktuell:** Keine Fehlerbehandlung
- **Empfohlen:** Graceful Error mit Hinweis

### TC-9.3: Gleichzeitige Bearbeitung (2 Tabs)
**Schritte:**
1. Öffne Turnier in Tab 1
2. Öffne dasselbe Turnier in Tab 2
3. Ändere Ergebnis in Tab 1
4. Ändere anderes Ergebnis in Tab 2

**Erwartetes Ergebnis:**
- ⚠️ **Aktuell:** Letzter Schreibvorgang gewinnt (Race Condition)
- **Empfohlen:** Optimistic Locking oder Warnung

### TC-9.4: Turnier ohne Teams veröffentlichen
**Schritte:**
1. Erstelle Turnier ohne Teams
2. Versuche zu veröffentlichen

**Erwartetes Ergebnis:**
- Validierungsfehler
- Button deaktiviert oder Warnung

### TC-9.5: Sehr langer Teamname
**Schritte:**
1. Gib Teamnamen mit 100+ Zeichen ein

**Erwartetes Ergebnis:**
- ⚠️ **Aktuell:** Wird akzeptiert, kann Layout brechen
- **Empfohlen:** Max-Length Validierung

### TC-9.6: Sonderzeichen in Namen
**Testdaten:** Team "FC <script>alert('XSS')</script>"
**Erwartetes Ergebnis:**
- Name wird escaped
- Kein XSS möglich

### TC-9.7: Unicode/Emojis in Namen
**Testdaten:** Team "FC Bayern 🇩🇪⚽"
**Erwartetes Ergebnis:**
- Wird korrekt angezeigt
- PDF-Export funktioniert

---

## 10. Menschliche Fehler

### TC-10.1: Falsches Ergebnis eingegeben
**Szenario:** User gibt 3:1 statt 1:3 ein
**Schritte:**
1. Bemerke Fehler nach Spielende
2. Nutze "Ergebnis korrigieren"
3. Korrigiere zu 1:3

**Erwartetes Ergebnis:**
- Korrektur möglich
- Tabelle wird neu berechnet
- Warnung über Auswirkungen

### TC-10.2: Falsches Team zugewiesen
**Szenario:** Team 3 sollte in Gruppe B, ist aber in Gruppe A
**Schritte:**
1. Bemerke Fehler nach Turnier-Start

**Erwartetes Ergebnis:**
- ⚠️ **Aktuell:** Nicht korrigierbar nach Veröffentlichung
- **Empfohlen:** Admin-Funktion zum Bearbeiten

### TC-10.3: Spiel versehentlich beendet
**Szenario:** User klickt "Beenden" statt "Pause"
**Schritte:**
1. Versuche Spiel wieder zu öffnen

**Erwartetes Ergebnis:**
- "Letztes Spiel wieder öffnen" Button
- Spiel kann fortgesetzt werden

### TC-10.4: Ergebnis für falsches Spiel eingegeben
**Szenario:** User gibt Ergebnis bei Spiel 5 statt Spiel 3 ein
**Schritte:**
1. Korrigiere Spiel 5 auf kein Ergebnis (wenn möglich)
2. Gib Ergebnis bei Spiel 3 ein

**Erwartetes Ergebnis:**
- Ergebnisse können geleert werden
- Tabelle aktualisiert sich entsprechend

### TC-10.5: Browser geschlossen während Spiel läuft
**Szenario:** Browser-Crash oder versehentliches Schließen
**Schritte:**
1. Starte Spiel
2. Schließe Browser
3. Öffne App erneut

**Erwartetes Ergebnis:**
- ⚠️ **Aktuell:** Timer-State kann verloren gehen
- **Empfohlen:** Timer-State in localStorage persistieren

### TC-10.6: Doppelklick auf Tor-Button
**Szenario:** User klickt schnell zweimal auf "+1"
**Erwartetes Ergebnis:**
- Nur ein Tor wird gezählt (Debounce)
- ODER: Zwei Tore werden korrekt erfasst

### TC-10.7: Negative Eingaben
**Schritte:**
1. Versuche "-1" als Torergebnis einzugeben

**Erwartetes Ergebnis:**
- Wird nicht akzeptiert
- Input erlaubt nur positive Zahlen

### TC-10.8: Buchstaben statt Zahlen
**Schritte:**
1. Versuche "abc" als Ergebnis einzugeben

**Erwartetes Ergebnis:**
- Wird nicht akzeptiert
- Input-Validierung greift

### TC-10.9: Turnier versehentlich gelöscht
**Schritte:**
1. Lösche Turnier vom Dashboard

**Erwartetes Ergebnis:**
- Bestätigungsdialog erscheint
- "Rückgängig" für 10 Sekunden möglich (optional)

### TC-10.10: Falsches Datum gewählt
**Szenario:** Turnier für gestern erstellt
**Erwartetes Ergebnis:**
- ⚠️ **Aktuell:** Wird akzeptiert
- **Empfohlen:** Warnung bei Datum in Vergangenheit

---

## Testabdeckung Matrix

| Bereich | Kritisch | Getestet | Automatisiert |
|---------|----------|----------|---------------|
| Turnier-Erstellung | ✅ | ✅ | ❌ |
| Team-Verwaltung | ✅ | ✅ | ❌ |
| Spielplan-Generierung | ✅ | ✅ | ✅ (teilweise) |
| Ergebnis-Eingabe | ✅ | ✅ | ❌ |
| Tabellen-Berechnung | ✅ | ✅ | ❌ |
| Playoff-Auflösung | ✅ | ✅ | ✅ |
| Live-Match | ✅ | ⚠️ | ❌ |
| PDF-Export | ⚠️ | ⚠️ | ❌ |
| Edge Cases | ✅ | ⚠️ | ❌ |
| Menschliche Fehler | ✅ | ⚠️ | ❌ |

**Legende:**
- ✅ Vollständig
- ⚠️ Teilweise
- ❌ Nicht vorhanden

---

## Empfehlungen für automatisierte Tests

### Unit Tests (Vitest)
```typescript
// Priorität 1: calculations.ts
describe('calculateStandings', () => {
  it('calculates points correctly for wins/draws/losses')
  it('handles team ID and team name matching')
  it('applies direct comparison correctly')
  it('handles empty matches array')
})

// Priorität 2: playoffResolver.ts
describe('resolvePlayoffPairings', () => {
  it('resolves placeholders with group key "A"')
  it('resolves placeholders with group key "Gruppe A"')
  it('handles incomplete group phase')
})
```

### E2E Tests (Playwright)
```typescript
// Kritischer Pfad: Turnier-Erstellung bis Ergebnis
test('complete tournament flow', async ({ page }) => {
  await page.goto('/');
  // 1. Turnier erstellen
  // 2. Teams hinzufügen
  // 3. Veröffentlichen
  // 4. Ergebnisse eingeben
  // 5. Tabelle prüfen
});
```

---

## 11. Bug-Fix Validierung

### TC-11.1: Match ID Synchronisierung (BUG-001)
**Vorbedingung:** Turnier mit Gruppen + Finale erstellt
**Schritte:**
1. Erstelle Turnier mit 4 Teams, 2 Gruppen, Top-4 Finals
2. Gib erstes Gruppenergebnis ein (z.B. 0:1)
3. Prüfe Finalspiele im Spielplan

**Erwartetes Ergebnis:**
- Finalspiele zeigen NICHT das gleiche Ergebnis wie das erste Gruppenspiel
- Finalspiele zeigen Platzhalter ("1. Gruppe A vs 1. Gruppe B")
- Jedes Spiel hat eine eindeutige ID

**Regression-Test für:** `scheduleGenerator.ts` slot-Property Fix

---

### TC-11.2: CorrectionDialog Teamnamen (BUG-002)
**Vorbedingung:** Turnier mit eingegebenem Ergebnis
**Schritte:**
1. Öffne Spielplan-Tab
2. Klicke "Ergebnis korrigieren" bei einem beendeten Spiel
3. Prüfe die Anzeige im Dialog

**Erwartetes Ergebnis:**
- Dialog zeigt Teamnamen (z.B. "FC Bayern vs TSV 1860")
- Dialog zeigt NICHT Team-IDs (z.B. "team-1 vs team-3")

**Regression-Test für:** `ScheduleTab.tsx` getTeamName() Helper

---

### TC-11.3: Ergebnis-Bearbeitung gesperrt (BUG-003)
**Vorbedingung:** Turnier mit beendetem Spiel
**Schritte:**
1. Öffne Spielplan-Tab
2. Versuche das beendete Spiel direkt zu bearbeiten (Klick auf Ergebnisfeld)

**Erwartetes Ergebnis:**
- Direktes Bearbeiten ist NICHT möglich
- Nur Button "Ergebnis korrigieren" ist verfügbar
- Bei Klick auf "Ergebnis korrigieren" öffnet sich der CorrectionDialog

**Regression-Test für:** `MatchScoreCell.tsx` read-only Mode für beendete Spiele

---

### TC-11.4: Dashboard Echtzeit-Update (BUG-004)
**Schritte:**
1. Öffne Dashboard
2. Öffne Turnier in neuem Tab
3. Ändere Turnierdatum in den Metadaten
4. Wechsle zurück zum Dashboard-Tab

**Erwartetes Ergebnis:**
- Dashboard zeigt sofort das neue Datum
- Kein manuelles Neuladen erforderlich

**Regression-Test für:** `useTournaments.ts` Event Listener

---

### TC-11.5: Default Feldanzahl
**Schritte:**
1. Erstelle neues Turnier
2. Wähle Sportart "Hallenfußball"
3. Prüfe voreingestellte Feldanzahl

**Erwartetes Ergebnis:**
- Feldanzahl ist auf 1 voreingestellt (nicht 2)

**Regression-Test für:** `football.ts` typicalFieldCount

---

## Changelog

| Version | Datum | Änderungen |
|---------|-------|------------|
| 1.1.0 | 22.12.2025 | Bug-Fix Testfälle hinzugefügt (TC-11.x) |
| 1.0.0 | 15.12.2025 | Initiale Erstellung |
