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
    /** „ursprünglich hh:mm“ und „voraussichtlich“ unter der Uhrzeit (B-27, @ZP-046; mindestens 3 % der Bildhöhe) */
    timeNote: '3vh',
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
  /** Spaltenbreiten in em der Zeilenschrift: Uhrzeit, Feld, Trenner/Stand */
  timeWidth: '3.4em',
  /** Breite der Uhrzeit-Spalte, wenn eine Zeile „ursprünglich hh:mm“ trägt (alle Zeilen der Seite gleich, B-27) */
  timeNoteWidth: '9.5em',
  fieldWidth: '5em',
  separatorWidth: '2.6em',
  /** Status-Punkt vor der Zeile im Spielplan */
  markerSize: '1.6vh',
  /** Tabelle: Platz | Team | S | U | N | Diff | Pkt (in em der Zeilenschrift) */
  standingsColumns: '1.6em minmax(0, 1fr) 1.6em 1.6em 1.6em 2.6em 2.2em',
  /** Überschrift-Symbol: Größe gleich der Schrift */
  headingIconSize: '1em',
  /** Abstand zwischen Überschrift-Symbol und Wort */
  headingIconGap: '1.2vh',
  /** Bezeichnung einer Zeile (Spielbezeichnung) höchstens so breit */
  labelMaxWidth: '25%',
} as const;
