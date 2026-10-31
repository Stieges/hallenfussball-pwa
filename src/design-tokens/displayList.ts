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
    /** „ursprünglich hh:mm“ und „voraussichtlich“ unter der Uhrzeit (B-27): Lesetext-Stufe der Zeile (nah-Untergrenze 3,6 %); @ZP-046 verlangt mehr, Befund C-MONITOR-URSPRUENGLICH-ZU-KLEIN */
    timeNote: '3.6vh',
  },
  /** Logo/Initialen vor dem Namen in der Zeile (Spielanzeige S3, Daniel 30.10.): „WW“ bei 3 vh Schrift passt in den Kreis */
  avatarSize: '6.5vh',
  /**
   * Zeilen je Seite auf „Spielplan eines Felds“ (Daniel 31.10., @ZM-185): das Logo steht über dem Namen, die Zeile ist höher.
   * Nikolaus (15 Spiele) ergibt „Seite 1 / 4“. „Nächste Spiele“ bleibt bei `MONITOR_ROWS_PER_PAGE`.
   */
  scheduleRowsPerPage: 4,
  /** Abstand Logo/Initialen zu dem Namen darunter (Logo über dem Namen, @ZM-157, @ZM-185) */
  avatarStackGap: '0.6vh',
  /**
   * Breite der Abzeichen-Spalte in der Spielplan-Zeile (@ZM-151, @ZM-185), in em der Abzeichen-Schrift, ohne seitliches Polster:
   * so breit wie das längste Wort, das in diesem Turnier als Abzeichen vorkommen kann, in Deutsch und Englisch.
   * `badgeColumnGroup`: ohne K.-o.-Spiele (kein „Verlängerung“, kein „Strafstoßschießen“) | `badgeColumnKnockout`: mit K.-o.-Spielen.
   * Gemessen im Browser (längstes Wort samt Pausensymbol: ohne K.-o. „Half-time“ 6,2 em, mit K.-o. „Strafstoßschießen“ 9,1 em), nicht aus
   * der Zeichenzahl geschätzt; `zm185-zeilen.spec.ts` prüft, dass jedes mögliche Wort in beiden Sprachen hineinpasst.
   */
  badgeColumnGroup: '6.3em',
  badgeColumnKnockout: '9.2em',
  /** Abstand zwischen Überschrift und Liste */
  headingGap: '2vh',
  /** Abstand zwischen zwei Zeilen */
  rowGap: '1vh',
  /** Zeilenpolster innen */
  rowPaddingY: '1.2vh',
  rowPaddingX: '2vh',
  /** Abstand zwischen den Zellen einer Zeile */
  cellGap: '2vh',
  /** Spalte Uhrzeit über Feld (und Hinweisen, B-27): feste Breite in em der Zeilenschrift, früher Uhrzeit 3,4 em + Feld 5 em */
  timeFieldWidth: '8.4em',
  /** Trenner/Stand */
  separatorWidth: '2.6em',
  /** Doppelpunkt zwischen den zwei Kästen einer Zeile: feste Breite, damit Zeilen mit und ohne Kästen gleich breit sind (@ZM-151, @ZM-185) */
  colonWidth: '0.4em',
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
