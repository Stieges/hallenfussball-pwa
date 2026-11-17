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
    /** Eine Stufe für „(war hh:mm)“ neben der Uhrzeit und die Bezeichnung als Zwischenzeile über der Zeilenkarte („Halbfinale 1“): Lesetext-Stufe der Zeile (nah-Untergrenze 3,6 %, @ZP-046: mindestens die kleinste erlaubte Monitor-Schrift) */
    timeNote: '3.6vh',
    /** Uhrzeit der Zeile (gültige, neue Uhrzeit): deutlich größer als der Zusatz „(war hh:mm)“ (@ZM-188, @ZP-046) */
    time: '4.4vh',
    /** Stand in der Zeile (1,5 × Teamname, VISUAL-DESIGN § 8; mindestens so groß wie die Uhrzeit) */
    score: '5.4vh',
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
  /** Abstand der Zwischenzeile (Spielbezeichnung) von der Zeilenkarte darunter (MonitorMatchRow, Zeilenhöhe in listRows) */
  labelGap: '0.4vh',
  /** Trenner/Stand: feste Breite in em der Namensschrift (nicht der Standschrift), damit die Spalte in jeder Zeile gleich breit ist (@ZM-187); „(4:3 i. E.)“ unter dem Stand ragt höchstens in den Zellenabstand */
  separatorWidth: '4.6em',
  /** Status-Punkt vor der Zeile im Spielplan */
  markerSize: '1.6vh',
  /** Tabelle: Platz | Team | S | U | N | Diff | Pkt (in em der Zeilenschrift) */
  standingsColumns: '1.6em minmax(0, 1fr) 1.6em 1.6em 1.6em 2.6em 2.2em',
  /**
   * Anpassung an die freie Bildhöhe (@ZM-125, @ZM-129): Die Schriftstufen oben sind die Untergrenze. Hat die Folie Platz (wenige Zeilen),
   * wachsen Zeilen und Schrift gemeinsam um einen Maßstab bis `maxScale`; bei vielen Zeilen bleibt es bei der Untergrenze.
   */
  fit: {
    /** Größter Maßstab der Spiellisten (Nächste Spiele, Spielplan) gegenüber den Stufen oben */
    maxScale: 1.6,
    /** Schrittweite der Suche nach dem größten passenden Maßstab */
    scaleStep: 0.02,
  },
  /**
   * Tabelle (Gesamttabelle, Gruppentabelle): Die Zeilenschrift richtet sich nach der freien Höhe und der Zahl der Zeilen (`standingsFit.ts`);
   * alle Abstände stehen in em dieser Schrift, damit sie mitwachsen. Die Zeilenschrift liegt zwischen `fontMin` (HART 3 % der Bildhöhe,
   * @ZM-125) und `fontMax`; der Tabellenkopf nie unter 3 % (`head`).
   */
  standings: {
    fontMax: '6.5vh',
    fontMin: '3vh',
    /** Tabellenkopf im Verhältnis zur Zeilenschrift (die Untergrenze `fontSizes.head` gilt immer) */
    headRatio: 0.84,
    /** Zeilenhöhe der Schrift (unitlos): das Höhenmodell rechnet mit demselben Wert */
    lineHeight: 1.2,
    rowPaddingY: '0.25em',
    rowPaddingX: '0.5em',
    cardPadding: '0.3em 0.5em',
    cellGap: '0.5em',
  },
  /** Überschrift-Symbol: Größe gleich der Schrift */
  headingIconSize: '1em',
  /** Abstand zwischen Überschrift-Symbol und Wort */
  headingIconGap: '1.2vh',
} as const;
