# Gemini Agent E2E Test Instructions

> **Ziel:** Vollständiger Turnier-Lifecycle-Test der Hallenfußball PWA
> **Basis-URL:** `https://hallenfussball-pwa.vercel.app`
> **Test-Daten:** `test-data/hkm-u11-inn-salzach.json`

---

## Übersicht

Du bist ein E2E-Test-Agent für die Hallenfußball PWA. Deine Aufgabe ist es, den kompletten Turnier-Lifecycle zu testen:

1. **Account-Erstellung** → Registrierung mit Code
2. **Turnier-Import** → JSON-Datei laden
3. **Match-Durchführung** → Spiele starten, Tore eintragen, beenden
4. **Public View** → Zuschauer-Ansicht via Share-Code
5. **Daten-Validierung** → Supabase-Prüfung

---

## Test-Umgebung

| Parameter | Wert |
|-----------|------|
| **URL** | `https://hallenfussball-pwa.vercel.app` |
| **Browser** | Chrome (empfohlen) |
| **Viewport** | 1280x720 (Desktop) oder 375x667 (Mobile) |
| **Test-Daten** | `test-data/hkm-u11-inn-salzach.json` |

---

## Phase 1: Account-Erstellung

### Schritt 1.1: Zur Registrierung navigieren

1. Öffne `https://hallenfussball-pwa.vercel.app`
2. Warte auf den Login-Screen
3. Klicke auf den Link "Registrieren"
4. Verifiziere: Element `#register-title` ist sichtbar

### Schritt 1.2: Registrierung ausfüllen

1. Fülle das Formular aus:
   - **Email** (`#email`): Generiere eine Test-Email, z.B. `gemini-test-{timestamp}@test.local`
   - **Passwort** (`#password`): `TestPassword123!`
   - **Registrierungscode** (`#registrationCode`): `BETA2024` (case-insensitive!)

2. Klicke auf "Registrieren" (`button[type="submit"]`)

3. Verifiziere: Weiterleitung zum Dashboard erfolgt

**Hinweis:** Der Registrierungscode ist **case-insensitive**. "BETA2024", "beta2024" und "Beta2024" sind alle gültig.

### Erwartetes Ergebnis Phase 1

- [ ] Registrierung erfolgreich
- [ ] Dashboard wird angezeigt
- [ ] Keine Fehlermeldungen

---

## Phase 2: Turnier-Import

### Schritt 2.1: Import-Dialog öffnen

1. Auf dem Dashboard, klicke auf "Importieren" oder das Import-Icon
2. Warte auf den Import-Dialog

### Schritt 2.2: JSON-Datei importieren

1. Wähle die Datei `test-data/hkm-u11-inn-salzach.json`
2. Klicke auf "Importieren"
3. Warte auf Success-Meldung

### Schritt 2.3: Import verifizieren

Erwartete Turnier-Daten:

| Feld | Erwarteter Wert |
|------|-----------------|
| Titel | "Hallenkreismeisterschaft U11 Inn/Salzach powered by Ballfreunde" |
| Teams | 7 Teams |
| Gruppen | 1 Gruppe (A) |
| Matches | 21 Gruppenspiele (Round Robin) |

1. Verifiziere: Turnier-Card erscheint auf Dashboard
2. Klicke auf die Turnier-Card
3. Verifiziere: Spielplan-Tab zeigt 21 Spiele

### Test-Teams (Referenz)

| ID | Name | Gruppe |
|----|------|--------|
| t1 | SV Wacker Burghausen | A |
| t2 | SV Bad Feilnbach | A |
| t3 | Fortuna Unterhaching/Juniors | A |
| t4 | TSV Siegsdorf | A |
| t5 | FT München Gern II | A |
| t6 | TSV 1880 Wasserburg am Inn | A |
| t7 | TSV 1860 Rosenheim | A |

### Erwartetes Ergebnis Phase 2

- [ ] Turnier erfolgreich importiert
- [ ] 7 Teams vorhanden
- [ ] 21 Spiele in Gruppe A
- [ ] Spielplan zeigt alle Runden

---

## Phase 3: Match-Durchführung

### Schritt 3.1: Erstes Spiel auswählen (Match m1)

**Match 1:** SV Wacker Burghausen vs SV Bad Feilnbach

1. Im Spielplan, finde Match 1 (Runde 1, Feld 1)
2. Klicke auf das Match, um das Cockpit zu öffnen
3. Verifiziere:
   - Team A Name (`[data-testid="team-name-A"]`): "SV Wacker Burghausen"
   - Team B Name (`[data-testid="team-name-B"]`): "SV Bad Feilnbach"
   - Status: "scheduled"

### Schritt 3.2: Spiel starten

1. Klicke auf "Spiel starten" (`[aria-label="Spiel starten"]`)
2. Verifiziere:
   - Timer startet (`[data-testid="match-timer-display"]`)
   - Status wechselt zu "running"

### Schritt 3.3: Tor eintragen (Team A)

1. Klicke auf den Tor-Button für Team A (`[data-testid="goal-button-A"]`)
2. GoalScorerDialog öffnet sich
3. Wähle Trikotnummer:
   - Option A: Klicke auf Quick-Select Button "10"
   - Option B: Gib "10" in das Nummern-Feld ein
4. Klicke auf "Bestätigen"
5. Verifiziere:
   - Score A (`[data-testid="score-A"]`): "1"
   - Score B (`[data-testid="score-B"]`): "0"

**Hinweis:** Der Dialog schließt sich nach 10 Sekunden automatisch. Wenn keine Nummer gewählt wird, wird das Tor ohne Trikotnummer erfasst.

### Schritt 3.4: Weiteres Tor eintragen (Team B)

1. Klicke auf den Tor-Button für Team B (`[data-testid="goal-button-B"]`)
2. Wähle Trikotnummer "7"
3. Bestätigen
4. Verifiziere: Score ist nun 1:1

### Schritt 3.5: Spiel beenden

1. Klicke auf "Spiel beenden" (`[aria-label="Spiel beenden"]`)
2. Bestätige im Dialog
3. Verifiziere:
   - Status wechselt zu "finished"
   - Endstand: 1:1

### Schritt 3.6: Zweites Spiel durchführen (Match m2)

**Match 2:** TSV 1880 Wasserburg am Inn vs TSV 1860 Rosenheim

Wiederhole Schritte 3.1-3.5 mit:
- 2 Tore für Team A (Wasserburg): Nummern 9, 11
- 1 Tor für Team B (Rosenheim): Nummer 10
- Endstand: 2:1

### Erwartetes Ergebnis Phase 3

- [ ] Match 1: SV Wacker Burghausen 1:1 SV Bad Feilnbach ✅
- [ ] Match 2: TSV 1880 Wasserburg 2:1 TSV 1860 Rosenheim ✅
- [ ] Beide Matches Status "finished"
- [ ] Tabelle aktualisiert (Punkte, Tore)

---

## Phase 4: Public View Testen

### Schritt 4.1: Share-Code abrufen

1. Navigiere zu Turnier-Settings
2. Finde den "Share-Code" (6-stelliger Code, z.B. "ABC123")
3. Notiere den Code

### Schritt 4.2: Public View öffnen

1. Öffne neuen Browser-Tab (oder Inkognito)
2. Navigiere zu: `https://hallenfussball-pwa.vercel.app/live/{shareCode}`
3. Verifiziere: Public View lädt ohne Login

### Schritt 4.3: Daten verifizieren

1. Prüfe Turnier-Titel
2. Prüfe Spielplan-Tab:
   - Match 1 zeigt 1:1
   - Match 2 zeigt 2:1
3. Prüfe Tabellen-Tab:
   - Wasserburg hat 3 Punkte
   - Burghausen und Feilnbach haben je 1 Punkt

**Hinweis:** Public View ist **readonly**. Keine Interaktion möglich.

### Erwartetes Ergebnis Phase 4

- [ ] Public View ohne Login erreichbar
- [ ] Spielergebnisse korrekt angezeigt
- [ ] Tabelle zeigt richtige Punkteverteilung
- [ ] Keine Edit-Buttons sichtbar (readonly)

---

## Phase 5: Supabase-Validierung

### Option A: Via Script (empfohlen)

```bash
# Mit Tournament-ID
npx ts-node scripts/validate-gemini-test.ts \
  --tournament-id <TOURNAMENT_ID> \
  --verbose

# Mit Share-Code
npx ts-node scripts/validate-gemini-test.ts \
  --share-code <SHARE_CODE> \
  --verbose
```

### Option B: Manuelle SQL-Prüfung

```sql
-- 1. Turnier prüfen
SELECT id, title, status, share_code
FROM tournaments
WHERE title ILIKE '%Hallenkreismeisterschaft U11%';

-- 2. Teams prüfen (sollte 7 sein)
SELECT COUNT(*) FROM teams
WHERE tournament_id = '<TOURNAMENT_ID>';

-- 3. Matches prüfen
SELECT
  m.id,
  ta.name AS team_a,
  tb.name AS team_b,
  m.score_a,
  m.score_b,
  m.match_status
FROM matches m
LEFT JOIN teams ta ON m.team_a_id = ta.id
LEFT JOIN teams tb ON m.team_b_id = tb.id
WHERE m.tournament_id = '<TOURNAMENT_ID>'
AND m.match_status = 'finished';

-- 4. Events prüfen
SELECT type, score_home, score_away
FROM match_events
WHERE match_id = '<MATCH_ID>'
ORDER BY timestamp_seconds;
```

### Erwartete Validierungsergebnisse

| Check | Erwartet |
|-------|----------|
| Tournament exists | ✅ |
| Teams count | 7 |
| Finished matches | 2 |
| Match 1 Score | 1:1 |
| Match 2 Score | 2:1 |
| Goal events | 4 total |

---

## Fehlerbehandlung

### Häufige Fehler

| Fehler | Ursache | Lösung |
|--------|---------|--------|
| "Registrierungscode ungültig" | Falscher Code | Verwende "BETA2024" |
| Timer startet nicht | Match bereits gestartet | Seite neu laden |
| Tor-Button reagiert nicht | Match nicht "running" | Erst "Spiel starten" klicken |
| Public View 404 | Falscher Share-Code | Code aus Settings prüfen |
| Supabase-Fehler | Keine Verbindung | Environment Variables prüfen |

### Debug-Tipps

1. **Console öffnen** (F12) für JavaScript-Fehler
2. **Network-Tab** für API-Requests prüfen
3. **localStorage** prüfen: `hallenfussball_tournaments`

---

## Checkliste für vollständigen Test

```
Phase 1: Account
  [ ] Registrierung mit Code erfolgreich
  [ ] Dashboard wird angezeigt

Phase 2: Import
  [ ] JSON-Import erfolgreich
  [ ] 7 Teams vorhanden
  [ ] 21 Spiele generiert

Phase 3: Matches
  [ ] Match 1 durchgeführt (1:1)
  [ ] Match 2 durchgeführt (2:1)
  [ ] Tabelle aktualisiert

Phase 4: Public View
  [ ] Share-Code funktioniert
  [ ] Ergebnisse sichtbar
  [ ] Readonly-Modus aktiv

Phase 5: Validation
  [ ] Supabase-Daten korrekt
  [ ] Events erfasst
  [ ] Scores konsistent
```

---

## Referenz-Dokumente

- [UI Selectors](selectors/gemini-selectors.md) - Alle CSS-Selektoren
- [Supabase Schema](supabase-schema.md) - Datenbankstruktur
- [Validation Script](../scripts/validate-gemini-test.ts) - Automatische Prüfung

---

## Kontakt

Bei Problemen oder Fragen:
- GitHub Issues: https://github.com/Stieges/hallenfussball-pwa/issues
- Test-Daten: `test-data/hkm-u11-inn-salzach.json`
