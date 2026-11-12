# Glossar

Verbindliche deutsche Fachterminologie für die Hallenfußball-PWA. Maschinenlesbare Quelle:
[`src/i18n/glossary.json`](../src/i18n/glossary.json). Dieses Dokument erklärt dieselben Begriffe
in Prosa — bei Widerspruch gilt `glossary.json`.

Hintergrund: Die App hatte bisher keine verbindliche Terminologie. Dieselbe Sache wurde je nach
Codepfad unterschiedlich benannt — sichtbar zum Beispiel in `TiebreakerBanner.tsx`, wo ein und
derselbe Bildschirm „Elfmeterschießen" und „Strafstoßschießen" nebeneinander zeigte. Die folgenden
Begriffe legen das fest.

## Strafstoßschießen

**Bevorzugt:** Strafstoßschießen
**Verboten:** Elfmeterschießen, Neunmeterschießen, Siebenmeterschießen

Die Entscheidungsrunde nach einem Unentschieden heißt „Strafstoßschießen", nicht
„Elfmeterschießen". Der Grund ist sachlich, nicht stilistisch: In der Halle wird nicht vom
Elfmeterpunkt geschossen — die tatsächliche Marke hängt von Hallengröße und Altersklasse ab und
liegt oft bei neun oder sieben Metern. „Elfmeter" behauptet eine Distanz, die es in der Halle so
nicht gibt. „Neunmeterschießen" oder „Siebenmeterschießen" wären zwar näher an der Realität,
legen sich aber ihrerseits auf eine feste Distanz fest, die von Turnier zu Turnier variiert.
„Strafstoßschießen" ist der neutrale, regelkonforme Begriff, der ohne Distanzangabe auskommt und
für jede Altersklasse und Hallengröße gleichermaßen stimmt.

## Strafstoß

**Bevorzugt:** Strafstoß
**Verboten:** Elfmeter

Die einzelne Aktion während des Strafstoßschießens (oder ein regulärer Strafstoß im laufenden
Spiel) heißt „Strafstoß", nicht „Elfmeter" — aus demselben Grund wie oben: Die Elfmeter-Marke
existiert in der Halle nicht in dieser Form.

## Gruppenphase

**Bevorzugt:** Gruppenphase
**Verboten:** Vorrunde

Die erste Turnierstufe, in der Teams innerhalb von Gruppen gegeneinander spielen, heißt
„Gruppenphase". „Vorrunde" meint im bestehenden Code dasselbe — die Begriffe sind reine
Synonyme, keine unterschiedlichen Turnierstufen. Die Wahl fiel auf „Gruppenphase", weil der
i18n-Namespace (`sport.json`, Schlüssel `tournament.groupStage`) diesen Begriff bereits führt und
die Bezeichner im Datenmodell danach benannt sind (z. B. `groupPhaseGameDuration` in
`src/types/tournament.ts`). Es ist günstiger, die verbleibenden UI-Texte und Labels an das
Datenmodell anzupassen als umgekehrt.

Sollte an anderer Stelle ein „Vorrunde" auftauchen, die tatsächlich eine Stufe *vor* der
Gruppenphase bezeichnet (z. B. eine Qualifikation), ist das kein Anwendungsfall dieses Eintrags —
ein solcher Fund wurde bei der Erhebung für dieses Glossar nicht gefunden; die überprüften Stellen
(`src/types/scheduleFilters.ts`, `src/lib/pdfExporter.ts`) verwenden „Vorrunde" durchgehend als
Synonym für „Gruppenphase".

## Golden Goal

**Bevorzugt:** Golden Goal
**Verboten:** Golden-Goal

Der Verlängerungsmodus, bei dem das erste Tor das Spiel sofort entscheidet, heißt „Golden Goal" —
ohne Bindestrich. Es ist ein etablierter englischer Fachbegriff ohne gebräuchliche deutsche
Entsprechung; die Schreibweise folgt `sport.json` (`phases.goldenGoal`).

## Zeitstrafe

**Bevorzugt:** Zeitstrafe
**Verboten:** Hinausstellung

Die zeitlich befristete Sperre eines Spielers heißt „Zeitstrafe". Der Code verwendet diesen
Begriff bereits einheitlich — dieser Eintrag schreibt den Ist-Zustand fest, damit er nicht
unbemerkt abweicht.

## Abzeichen-Wörter eines Spiels

**Gilt für:** Monitor, Zuschauer-Seite, Spielkarte und Cockpit-Tafel (Aufgabe 1.1 Spielanzeige, @OB-066).

| Zustand | Deutsch | Englisch |
|---|---|---|
| läuft | Live | Live |
| Pause (Uhr angehalten, Pause vor Verlängerung oder Strafstoßschießen) | Pause | Paused |
| Halbzeit (zwei Abschnitte, nach dem ersten) | Halbzeit | Half-time |
| Verlängerung | Verlängerung | Extra time |
| Strafstoßschießen | Strafstoßschießen | Penalties |
| beendet, gewertet | Ende | Full time |
| ausgefallen | ausgefallen | Cancelled |

Die englischen Wörter sind eine Controller-Entscheidung (18.10.2026), das Gherkin legt nur die deutschen fest. Die Wörter stehen bewusst nicht in `glossary.json`: die Lint-Regel `no-hardcoded-sport-terms-preferred` meldete dann jedes
„live“ und „Ende“ im Code. Quelle im Code: `matchBadge.*` in `tournament.json` (Test `badge.glossary.test.ts` hält Tabelle und Texte gleich).

**Abweichung zu `glossary.json`:** Das Abzeichen sagt auf Englisch „Penalties“ (Kurzform, Controller bestätigt 18.10.2026); `glossary.json` führt für das
Strafstoßschießen „penalty shootout“ (`events.penaltyShootout`) und gilt für alle Fließtexte weiter.

**ausgefallen** – Bedeutung (Daniel 2026-11-05): „ausgefallen“ meint ein Spiel, das nicht stattgefunden hat und gewertet wird
(Nichtantritts-Wertung; fehlen beide Teams: je 0 Punkte, Gegentore nach der eingestellten Wertung). Ein Spiel, das ohne Wertung entfällt,
ist begrifflich etwas anderes; dafür gibt es noch keinen eigenen Begriff (Befund C-AUSGEFALLEN-OHNE-WERTUNG). Glossar-Eintrag: `cancelledMatch`.

## Veranstaltung

**Bevorzugt:** Veranstaltung (Englisch „event“)
**Nicht verwechseln mit:** Veranstalter

Eine Veranstaltung fasst mehrere Turniere eines Kontos unter einem Link und einem QR-Code zusammen, etwa die sechs
Jugendturniere eines Wochenendes in derselben Halle (Adresse `/veranstaltung/<Code>`). Sie ist eine eigene Ebene über den
Turnieren; eine spätere Turnierserie fasst mehrere Veranstaltungen zusammen. Der „Veranstalter“ dagegen ist die Person oder
der Verein, der ein einzelnes Turnier ausrichtet (Feld `organizer`). In Datenbank und Code heißt die Veranstaltung
`gathering` (Tabelle `gatherings`, Feld `tournaments.gathering_id`, i18n-Namensraum `gathering`), weil „event“ im Bestand
das Ereignis im Spiel bezeichnet (`match_events`, Recht `correctEvents`). Glossar-Eintrag: `gathering`.

## Leibchen

**Bevorzugt:** Leibchen (Englisch „bib“, Mehrzahl „bibs“)
**Gleichbedeutend, erlaubt:** Markierungshemd

Das farbige Überziehhemd, das die Spieler einer Seite über dem Trikot tragen, wenn zwei Mannschaften in gleicher oder sehr
ähnlicher Farbe spielen, heißt in der App „Leibchen“. „Markierungshemd“ meint dasselbe und ist im Verein ebenso gebräuchlich; es ist
ein Synonym und kein verbotenes Wort (Daniel 2026-11-09, „Leibchen + Synonym“), die App schreibt in Karte, Zeile, Tasten und
Meldungen aber „Leibchen“ – wie die Verbandsregeln, die die Recherche zu den Hallenregeln herangezogen hat. Leibchen sind in der App
immer freiwillig. „Weste“ ist nur der interne Name der Darstellung im Ergebniskasten (Mitte in Leibchenfarbe, Streifen links und
rechts in Trikotfarbe, dazu das Leibchen-Zeichen) und steht in keinem sichtbaren Text; ein Text „in Leibchen“ unter dem Teamnamen
entfällt. Nicht verwechseln mit dem Trikot (dem Spielhemd, dessen Farbe je Team im Assistenten steht) und mit dem „Ausweichtrikot“
(einer zweiten Trikotfarbe je Team, MVP+). Glossar-Eintrag: `bib` (de „Leibchen“, en „bib“, Schlüssel `equipment.bib` in `sport.json`); bei Widerspruch gilt `glossary.json`.
