/**
 * Display-Tokens der Listen-Folien (B-44b): Nächste Spiele, Spielplan, Tabellen.
 *
 * Alles relativ zur Bildhöhe (vh) oder zur Schrift (em), keine festen Pixel: bei 1280x720 und bei 3840x2160 ist der
 * Anteil an der Bildhöhe gleich (@ZM-125). Teamnamen mindestens 3 % der Bildhöhe. Dieselbe Token-Logik wie die
 * Live-Folie (displayFontSizes.teamName, liveInfo).
 */
export const displayList = {
  fontSizes: {
    /** Folien-Überschrift */
    heading: '5vh',
    /** Teamnamen und Zahlen in den Zeilen (mindestens 3 % der Bildhöhe, @ZM-125) */
    team: '3.6vh',
    /** Tabellenkopf und Seitenhinweis (mindestens 3 % der Bildhöhe) */
    head: '3vh',
    /** „(war hh:mm)“ neben und „voraussichtlich“ unter der Uhrzeit (B-27): Lesetext-Stufe der Zeile (nah-Untergrenze 3,6 %); @ZP-046 verlangt mehr, Befund C-MONITOR-URSPRUENGLICH-ZU-KLEIN */
    timeNote: '3.6vh',
    /** Uhrzeit der Zeile (gültige, neue Uhrzeit): deutlich größer als der Zusatz „(war hh:mm)“ (@ZM-188, @ZP-046) */
    time: '4.4vh',
    /** Zusatz unter dem Abzeichen („gewertet“) und unter dem Stand („(4:3 i. E.)“): wie Tabellenkopf, nie kleiner (@ZM-125) */
    note: '3vh',
  },
  /** Abstand zwischen Überschrift und Liste */
  headingGap: '2vh',
  /** Abstand zwischen zwei Zeilen */
  rowGap: '1vh',
  /** Zeilenpolster innen */
  rowPaddingY: '1.2vh',
  rowPaddingX: '2vh',
  /** Abstand zwischen den Zellen einer Zeile */
  cellGap: '2vh',
  /** Spalte Uhrzeit (daneben „(war hh:mm)“ in einer Zeile) über Feld: feste Breite in em der Zeilenschrift (@ZM-188) */
  timeFieldWidth: '9.6em',
  /** Abstand zwischen Uhrzeit und „(war hh:mm)“ in einer Zeile */
  timeNoteGap: '1vh',
  /** Trenner/Stand: feste Breite, damit die Spalte in jeder Zeile gleich breit ist (@ZM-187); „(4:3 i. E.)“ unter dem Stand ragt höchstens in den Zellenabstand */
  separatorWidth: '3.4em',
  /** Status-Punkt vor der Zeile im Spielplan */
  markerSize: '1.6vh',
  /** Tabelle: Platz | Team | S | U | N | Diff | Pkt (in em der Zeilenschrift) */
  standingsColumns: '1.6em minmax(0, 1fr) 1.6em 1.6em 1.6em 2.6em 2.2em',
  /** Überschrift-Symbol: Größe gleich der Schrift */
  headingIconSize: '1em',
  /** Abstand zwischen Überschrift-Symbol und Wort */
  headingIconGap: '1.2vh',
} as const;
