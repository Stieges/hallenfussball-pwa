/**
 * Display-Tokens der Folien „Endstand“ und „Torschützen“ am Monitor (R3-7; Mockups `mon-end-*`, `mon-tor`).
 *
 * Alles relativ zur Bildhöhe (vh): bei 1280×720 und bei 3840×2160 ist der Anteil gleich (@ZM-125). Die Zeilen sind groß (Platz und
 * Team aus 10 m lesbar), Seitenhinweis und Untertitel in der Stufe der Listen-Folien. Gold nur für Platz 1, je Thema: dunkel das
 * Gold der Palette, hell das dunklere Gold (Kontrast ≥ 3 : 1 gegen Weiß, wie die Medaille in der App).
 */
import { palette } from './colors/palette';

export const displayFinal = {
  fontSizes: {
    /** Platz, Teamname, Zahl der Tore in einer Zeile: 9,5 % der Bildhöhe (mindestens 9,44 % nach Sehwinkel, @ZM-125, Profil „fern“: Teamnamen und Tabellenzeilen aus 10 m) */
    row: '9.5vh',
    /** „Tore“ hinter der Zahl */
    unit: '3.6vh',
    /** Turniername unter der Überschrift */
    subtitle: '3.2vh',
    /** Kindermodus: „Turnier beendet – danke fürs Mitspielen“ */
    kids: '9vh',
  },
  /** Zeilenpolster innen und Abstand zwischen den Zeilen: knapp, damit 6 große Zeilen mit Kopf in den Bildrand passen */
  rowPaddingY: '0.2vh',
  rowGap: '0.4vh',
  /** Zeilenhöhe der Zeilenschrift (unitlos) */
  rowLineHeight: 1.05,
  /** Spalte „Platz“ in em der Zeilenschrift */
  placeWidth: '1.3em',
  /** Rahmen der Siegerzeile (Platz 1) */
  winnerBorderWidth: '0.4vh',
  /** Pokal in der Siegerzeile: gleich der Schrift */
  cupSize: '1em',
  /** Abstand zwischen Überschrift und Turniername sowie zwischen Kopf und Liste: knapp, damit die Folie über den Positionspunkten unten endet */
  subtitleGap: '0.3vh',
  headingGapBelow: '0.5vh',
  gold: {
    dark: palette.special.gold,
    light: palette.special.goldDark,
  },
} as const;
