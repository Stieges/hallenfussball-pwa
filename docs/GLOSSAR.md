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
