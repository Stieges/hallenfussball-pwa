# Testfälle: Turnierleitung & Spielverwaltung

## Übersicht
Diese Testfälle dokumentieren die Schritte zum Testen der implementierten Funktionen in der Turnierleitung (Match Cockpit).

---

## Testfall 1: Beenden-Button Funktionalität

### Ziel
Prüfen, dass der "Beenden" Button ein laufendes Spiel korrekt beendet und die Ergebnisse speichert.

### Voraussetzungen
- Ein Turnier ist erstellt und hat mehrere Spiele im Spielplan
- Die Anwendung läuft auf http://localhost:3001

### Schritte

1. **Turnier öffnen**
   - Gehe zur Turnierliste
   - Öffne ein bestehendes Turnier
   - Wechsle zum Tab "Turnierleitung"

2. **Spiel auswählen und starten**
   - Wähle ein Spiel aus dem Dropdown-Menü (z.B. "Spiel #1: Team A vs Team B")
   - Klicke auf den "Start" Button (▶️)
   - **Erwartetes Ergebnis**:
     - Der Timer beginnt zu laufen
     - Status wechselt zu "RUNNING"
     - In der Ereignisliste erscheint: "▶️ Spiel gestartet"
     - Der "Start" Button wird deaktiviert
     - "Pause" und "Beenden" Buttons werden aktiv

3. **Tore erfassen**
   - Klicke beim Heim-Team auf "+1" Button
   - Klicke beim Auswärts-Team auf "+1" Button
   - **Erwartetes Ergebnis**:
     - Score wird aktualisiert (z.B. 1:1)
     - In der Ereignisliste erscheinen jeweils: "⚽ Tor für [Teamname]"
     - Nach jedem Tor wird der aktuelle Stand angezeigt

4. **Spiel beenden**
   - Klicke auf den "Beenden" Button (🏁)
   - **Erwartetes Ergebnis**:
     - Es erscheint KEINE Bestätigungsdialog (wurde entfernt)
     - Status wechselt zu "FINISHED"
     - Timer stoppt bei der vollen Spielzeit
     - In der Ereignisliste erscheint: "🏁 Spiel beendet"
     - Das Spiel wird aus dem Dropdown entfernt
     - Alle Control-Buttons werden deaktiviert

5. **Ergebnis überprüfen in anderen Tabs**
   - Wechsle zum Tab "Spielplan"
   - **Erwartetes Ergebnis**: Das Ergebnis des gerade beendeten Spiels wird korrekt angezeigt

   - Wechsle zum Tab "Tabelle"
   - **Erwartetes Ergebnis**: Die Tabelle wurde mit den Punkten/Toren aktualisiert

   - Wechsle zum Tab "Finale Platzierung"
   - **Erwartetes Ergebnis**: Die Platzierung berücksichtigt das neue Ergebnis

### Fehlerfälle zu prüfen

- **Fall A**: Beenden ohne Tore
  - Spiel starten → sofort beenden → Ergebnis sollte 0:0 sein

- **Fall B**: Beenden bei pausiertem Spiel
  - Spiel starten → Pause → Beenden → sollte funktionieren

---

## Testfall 2: Match-Wechsel Warnung bei laufendem Spiel

### Ziel
Prüfen, dass beim Wechsel zu einem anderen Spiel eine Warnung erscheint, wenn noch ein Spiel läuft, und dass das laufende Spiel automatisch beendet wird.

### Voraussetzungen
- Ein Turnier mit mindestens 3 Spielen im Spielplan
- Die Anwendung läuft auf http://localhost:3001

### Schritte

1. **Erstes Spiel starten**
   - Gehe zur Turnierleitung
   - Wähle "Spiel #1" aus dem Dropdown
   - Klicke "Start"
   - Erfasse mindestens 1 Tor (z.B. Heim-Team: 2, Auswärts-Team: 1)
   - **Erwartetes Ergebnis**: Spiel läuft, Timer läuft, Status ist "RUNNING"

2. **Versuch, zu anderem Spiel zu wechseln**
   - Öffne das Dropdown-Menü
   - Wähle "Spiel #2" (ein anderes Spiel)
   - **Erwartetes Ergebnis**: Es erscheint ein Warn-Dialog mit folgendem Inhalt:
     ```
     ⚠️ WARNUNG: Spiel #1 läuft noch!

     [Heim-Team] vs [Auswärts-Team]
     Aktueller Stand: 2:1

     Wenn Sie zu einem anderen Spiel wechseln, wird das laufende Spiel automatisch beendet.

     Möchten Sie trotzdem wechseln?
     ```

3. **Wechsel abbrechen**
   - Klicke im Dialog auf "Abbrechen" (oder "Cancel")
   - **Erwartetes Ergebnis**:
     - Dialog schließt sich
     - Das ursprüngliche Spiel #1 bleibt ausgewählt
     - Das Spiel läuft weiter
     - Timer läuft weiter

4. **Wechsel bestätigen**
   - Öffne erneut das Dropdown
   - Wähle wieder "Spiel #2"
   - Klicke im Dialog auf "OK"
   - **Erwartetes Ergebnis**:
     - Dialog schließt sich
     - Spiel #1 wird automatisch beendet (Status: FINISHED)
     - In Spiel #1 erscheint das Ereignis "🏁 Spiel beendet"
     - Spiel #2 wird geladen und angezeigt
     - Spiel #2 hat Status "NOT_STARTED"

5. **Überprüfung des automatisch beendeten Spiels**
   - Wechsle zum Tab "Spielplan"
   - Finde Spiel #1 in der Liste
   - **Erwartetes Ergebnis**:
     - Das Ergebnis von Spiel #1 ist gespeichert (2:1)
     - Das Spiel wird als beendet markiert

6. **Überprüfung in localStorage**
   - Öffne Browser DevTools (F12)
   - Gehe zu "Application" → "Local Storage"
   - Finde den Key `liveMatches-[tournament-id]`
   - **Erwartetes Ergebnis**:
     - Spiel #1 hat `status: "FINISHED"`
     - `homeScore: 2`, `awayScore: 1`

### Fehlerfälle zu prüfen

- **Fall A**: Wechsel bei pausiertem Spiel
  - Spiel starten → Pause → Wechsel versuchen → Warnung sollte trotzdem erscheinen (Status ist nicht RUNNING, daher keine Warnung - dies ist aktuelles Verhalten, könnte angepasst werden)

- **Fall B**: Mehrfacher Wechsel
  - Spiel 1 starten → zu Spiel 2 wechseln (mit OK bestätigen) → Spiel 2 starten → zu Spiel 3 wechseln
  - **Erwartetes Ergebnis**: Beide Male erscheint die Warnung

---

## Testfall 3: Live-Match Warnung im Spielplan-Tab

### Ziel
Prüfen, dass eine Warnung erscheint, wenn im Tab "Spielplan" ein Ergebnis zu einem Spiel erfasst wird, das gerade LIVE in der Turnierleitung läuft.

### Voraussetzungen
- Ein Turnier mit mehreren Spielen
- Die Anwendung läuft auf http://localhost:3001

### Schritte

1. **Spiel in Turnierleitung starten**
   - Gehe zur Turnierleitung
   - Wähle "Spiel #3: Team C vs Team D"
   - Klicke "Start"
   - Erfasse 1-2 Tore
   - **Erwartetes Ergebnis**: Spiel läuft mit Status "RUNNING"

2. **Zum Spielplan-Tab wechseln (ohne das Spiel zu beenden)**
   - Klicke auf den Tab "Spielplan"
   - **Erwartetes Ergebnis**: Die Spielplan-Übersicht wird angezeigt

3. **Ergebnis für das laufende Spiel ändern**
   - Finde Spiel #3 in der Spielplan-Liste
   - Ändere das Ergebnis (z.B. von 1:0 auf 3:2)
   - Klicke auf "Speichern" oder verlasse das Eingabefeld
   - **Erwartetes Ergebnis**: Es erscheint ein Warn-Dialog:
     ```
     ⚠️ WARNUNG: Dieses Spiel läuft gerade LIVE in der Turnierleitung!

     Wenn Sie hier das Ergebnis ändern, wird es die Live-Verwaltung überschreiben.

     Möchten Sie trotzdem fortfahren?
     ```

4. **Änderung abbrechen**
   - Klicke auf "Abbrechen"
   - **Erwartetes Ergebnis**:
     - Dialog schließt sich
     - Das Ergebnis wird NICHT geändert
     - Es bleibt beim alten Wert (1:0)

5. **Änderung bestätigen**
   - Ändere erneut das Ergebnis auf 3:2
   - Klicke im Dialog auf "OK"
   - **Erwartetes Ergebnis**:
     - Dialog schließt sich
     - Das Ergebnis wird auf 3:2 gespeichert
     - Das neue Ergebnis wird auch in tournament.matches gespeichert

6. **Zurück zur Turnierleitung**
   - Wechsle zum Tab "Turnierleitung"
   - **Erwartetes Ergebnis**:
     - Das Spiel läuft immer noch (Status: RUNNING)
     - ABER: Das Ergebnis wurde überschrieben auf 3:2
     - Die Event-Liste zeigt jetzt "✏️ Ergebnis manuell korrigiert" (möglicherweise nicht, da Änderung aus anderem Tab kam)

### Fehlerfälle zu prüfen

- **Fall A**: Ergebnis ändern für beendetes Spiel
  - Spiel beenden in Turnierleitung → zu Spielplan wechseln → Ergebnis ändern
  - **Erwartetes Ergebnis**: KEINE Warnung, da Spiel nicht mehr RUNNING ist

- **Fall B**: Ergebnis ändern für nicht gestartetes Spiel
  - Spiel noch nicht gestartet → in Spielplan Ergebnis erfassen
  - **Erwartetes Ergebnis**: KEINE Warnung, da Spiel nie gestartet wurde

---

## Testfall 4: Ereignisliste (Spielereignisse) Darstellung

### Ziel
Prüfen, dass die Ereignisliste im Match Cockpit alle Events korrekt und übersichtlich darstellt.

### Voraussetzungen
- Ein Turnier mit Spielen
- Die Anwendung läuft auf http://localhost:3001

### Schritte

1. **Spiel mit verschiedenen Ereignissen erstellen**
   - Gehe zur Turnierleitung
   - Wähle ein Spiel aus
   - Klicke "Start"
   - **Erwartetes Ereignis**: "▶️ Spiel gestartet" erscheint mit Zeitstempel (0:00)

2. **Tor erfassen**
   - Klicke beim Heim-Team auf "+1"
   - **Erwartetes Ereignis**:
     - "⚽ Tor für [Heim-Team Name]" erscheint
     - Zeitstempel zeigt die aktuelle Spielzeit (z.B. 2:15)
     - Stand nach dem Tor wird angezeigt (z.B. 1:0)
     - Hintergrund ist leicht grün gefärbt

3. **Spiel pausieren**
   - Klicke "Pause"
   - **Erwartetes Ereignis**:
     - "⏸️ Spiel pausiert" erscheint
     - Zeitstempel zeigt aktuelle Zeit
     - Hintergrund ist leicht blau gefärbt

4. **Spiel fortsetzen**
   - Klicke wieder auf "Start"
   - **Erwartetes Ereignis**: "▶️ Spiel gestartet" erscheint erneut
   - Blauer Hintergrund

5. **Tor zurücknehmen**
   - Klicke beim Heim-Team auf "-1"
   - **Erwartetes Ereignis**:
     - "↩️ Tor zurückgenommen bei [Heim-Team Name]" erscheint
     - Grüner Hintergrund
     - Stand nach Rücknahme wird angezeigt (0:0)

6. **Manuelles Ergebnis ändern**
   - Klicke "Ergebnis manuell anpassen"
   - Gib 4:3 ein und bestätige
   - **Erwartetes Ereignis**:
     - "✏️ Ergebnis manuell korrigiert" erscheint
     - Gelb/Amber Hintergrund
     - Neuer Stand: 4:3

7. **Spiel beenden**
   - Klicke "Beenden"
   - **Erwartetes Ereignis**:
     - "🏁 Spiel beendet" erscheint
     - Blauer Hintergrund
     - Zeitstempel zeigt Spielende (z.B. 10:00)

8. **Ereignisliste prüfen**
   - **Erwartete Darstellung**:
     - Ereignisse sind in umgekehrter chronologischer Reihenfolge (neueste oben)
     - Jedes Ereignis hat: Zeitstempel | Beschreibung | Stand
     - Farbcodierung: Grün (Tore), Blau (Status), Gelb (Manuelle Änderungen)
     - Icons sind sichtbar (⚽ ▶️ ⏸️ 🏁 ✏️ ↩️)
     - Liste ist scrollbar, wenn mehr als ~6 Ereignisse

9. **Letztes Ereignis zurücknehmen**
   - Klicke "Letztes Ereignis zurücknehmen"
   - **Erwartetes Ergebnis**:
     - Das oberste Ereignis verschwindet aus der Liste
     - Der Score wird auf den vorherigen Stand zurückgesetzt
     - Falls es "Spiel beendet" war, wechselt Status zurück zu RUNNING/PAUSED

---

## Testfall 5: Datensynchronisation zwischen Tabs

### Ziel
Sicherstellen, dass Änderungen in einem Tab in allen anderen Tabs sichtbar sind.

### Voraussetzungen
- Ein Turnier mit mehreren Spielen und Gruppen
- Die Anwendung läuft auf http://localhost:3001

### Schritte

1. **Spiel in Turnierleitung durchführen**
   - Tab "Turnierleitung" öffnen
   - Spiel starten, Tore erfassen (z.B. 3:2), Spiel beenden

2. **Spielplan-Tab prüfen**
   - Wechsle zu "Spielplan"
   - Suche das gerade beendete Spiel
   - **Erwartetes Ergebnis**: Ergebnis zeigt 3:2

3. **Tabelle-Tab prüfen**
   - Wechsle zu "Tabelle"
   - Finde die beteiligten Teams
   - **Erwartetes Ergebnis**:
     - Sieger-Team: +3 Punkte, +3 Tore erzielt, +2 Tore erhalten, +1 Sieg
     - Verlierer-Team: 0 Punkte, +2 Tore erzielt, +3 Tore erhalten, +1 Niederlage

4. **Platzierung-Tab prüfen**
   - Wechsle zu "Finale Platzierung"
   - **Erwartetes Ergebnis**:
     - Die Platzierung berücksichtigt das neue Ergebnis
     - Teams sind nach Platzierungslogik sortiert

5. **Zweites Spiel in Turnierleitung**
   - Zurück zu "Turnierleitung"
   - Führe ein zweites Spiel durch (z.B. 1:1)
   - **Erwartetes Ergebnis**: Alle Tabs aktualisieren sich erneut korrekt

---

## Erwartete Verbesserungen in der Ereignisliste

Die Ereignisliste wurde mit folgenden Verbesserungen ausgestattet:

### Emojis & Icons
- ⚽ = Tor
- ↩️ = Tor zurückgenommen
- ▶️ = Spiel gestartet
- ⏸️ = Spiel pausiert
- 🏁 = Spiel beendet
- ✏️ = Ergebnis manuell korrigiert

### Farbcodierung
- **Grün** (`rgba(0, 230, 118, 0.05)`) = Tore (GOAL events)
- **Blau** (`rgba(59, 130, 246, 0.05)`) = Status-Änderungen (STATUS_CHANGE)
- **Gelb/Amber** (`rgba(251, 191, 36, 0.05)`) = Manuelle Anpassungen (RESULT_EDIT)

### Beschreibungen
- Statt "Tor Team A (+1)" → "⚽ Tor für Team A"
- Statt "Tor Team B (-1)" → "↩️ Tor zurückgenommen bei Team B"
- Statt "Status: RUNNING" → "▶️ Spiel gestartet"
- Statt "Status: PAUSED" → "⏸️ Spiel pausiert"
- Statt "Status: FINISHED" → "🏁 Spiel beendet"
- Statt "Ergebnis manuell angepasst" → "✏️ Ergebnis manuell korrigiert"

---

## Bekannte Einschränkungen

1. **Pause-Status bei Match-Wechsel**: Die Warnung beim Match-Wechsel erscheint nur bei Status "RUNNING", nicht bei "PAUSED". Dies könnte als Feature oder Bug betrachtet werden.

2. **Ereignisse aus Spielplan-Tab**: Wenn ein Ergebnis im Spielplan-Tab manuell geändert wird, erscheint dies NICHT als Event in der Ereignisliste der Turnierleitung (da die Event-Liste nur lokale Live-Events trackt).

3. **Browser-Refresh**: Nach einem Browser-Refresh gehen die Live-Match-Daten aus `liveMatches` verloren (nur in localStorage, nicht in Tournament-Daten). Dies ist gewolltes Verhalten.

---

## Erfolg-Kriterien

✅ Alle Testfälle laufen ohne Fehler durch
✅ Keine JavaScript-Fehler in der Browser-Konsole
✅ Datensynchronisation funktioniert zwischen allen Tabs
✅ Warnungen erscheinen zur richtigen Zeit
✅ Ereignisliste ist gut lesbar und farblich unterscheidbar
✅ Beenden-Button funktioniert zuverlässig

