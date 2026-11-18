/**
 * Display-Tokens der Live-Folie im Profil „Halle (sehr fern)“ (@ZM-212, @ZM-213, @ZM-214; Anordnung „Farbseiten“ aus dem
 * Gestaltungs-Review 17.11.2026, Hallentest: Bildschirm 86 × 49 cm, Leseabstand rund 22 m).
 *
 * Alle Maße in Container-Einheiten der Folienfläche innerhalb des Bildrands (`cqh`, `cqw` nur dort, wo die Breite die Grenze ist): bei
 * 1920×1080, 1280×720 und 1920×940 gilt dasselbe Verhältnis zur Höhe. Mindestwerte nach @ZM-213 (Anteil der Höhe): Torzahl 34 %,
 * Restzeit 26 % (jetzt 34 %), Namen je nach Länge 7,5 bis 20 %. Die Werte stammen aus der Mockup-Messung des Reviews (1080 px = 100 cqh).
 * Ausgabe der übrigen Folien und der Profile „Spielfeld (fern)“ und „Info (nah)“ bleibt unberührt: nichts hier wird dort gelesen.
 */
import { palette } from './colors/palette';

export const displayHall = {
  /** Zwei Farbflächen oben bis an den Rand der Folienfläche: Höhe (64,5 %: Namensfeld und Torzahl füllen sie, der Rest geht an Zeitbalken und Restzeit, @ZM-215), Lücke dazwischen, Rundung der unteren Ecken */
  panel: { height: '64.5cqh', gap: '3cqh', radius: '1.7cqh', ringWidth: '1.5cqh' },
  /** Teamname oben in der Fläche: Feld (Abstand oben, Höhe, seitlicher Abstand), größte Schrift, Zeilenhöhe (unitlos); höchstens zwei Zeilen */
  name: { top: '2.4cqh', height: '33.8cqh', padX: '3.7cqh', maxFont: '22.5cqh', lineHeight: 1.04, letterSpacing: '-0.01em' },
  /** Torzahl unter dem Namen: 35 % der Höhe, Zeilenhöhe = Versalhöhe der Ziffern (Inter 0,727), Abstand zum unteren Rand der Fläche */
  digit: { font: '35cqh', lineHeight: 0.727, bottom: '2.4cqh', letterSpacing: '-0.02em' },
  /** Doppelpunkt zwischen den Flächen: zwei Punkte (Durchmesser, Abstand, Lage von oben, auf Höhe der Torzahlen) */
  colon: { dot: '2.2cqh', gap: '8.4cqh', top: '43.9cqh' },
  /** Leibchen-Zeichen (oben links) und Pokal (oben rechts), klein in der Ecke der Fläche */
  mark: { size: '4.4cqh', inset: '0.8cqh', border: '0.3cqh', iconShare: 0.6 },
  /** Zeitbalken über die ganze Breite: Abstand zur Fläche darüber, Höhe (6 %, @ZM-215), seitlicher Abstand, Umrandung der Bahn */
  bar: { gapTop: '1.2cqh', height: '6cqh', padX: '2.2cqh' },
  /**
   * Farben des Zeitbalkens je Thema (@ZM-215): die Füllung ist der kräftige Teil und läuft mit der Restzeit herunter, die abgelaufene Strecke ist die blassere Bahn.
   * Dunkel (das einzige Thema am Monitor im MVP, helles Design @ZM-173): Füllung heller als die Bahn; hell: Füllung dunkler als die Bahn.
   * Füllung gegen Bahn jeweils mindestens 3 : 1, Bahn gegen Hintergrund dunkel mindestens 2,6 : 1, hell mindestens 2,0 : 1 (Test `displayHall.zm213.test.ts`).
   * Grün läuft, grau angehalten, violett in der Schlussphase (dunkel: dasselbe Violett wie die Uhr), gedämpft in der Pause. Aus der Palette; neu sind nur
   * `dark.track` (#586880: die Bahn muss gegen #1E293B/#0F172A mindestens 2,6 : 1 haben, `neutral.500` hat nur 2,3 : 1 am oberen Ende des Verlaufs) und
   * `light.violett` (#5B21B6: dunkles Violett, `purple.600` hat gegen die Bahn nur 2,4 : 1).
   */
  barColors: {
    dark: { track: '#586880', gruen: palette.green[400], grau: palette.neutral[50], violett: palette.purple[300], gedaempft: palette.neutral[300] },
    light: { track: palette.neutral[400], gruen: palette.green[800], grau: palette.neutral[700], violett: '#5B21B6', gedaempft: palette.blue[900] },
  },
  /** Uhrband unten: Innenabstand seitlich und unten, Abstand zwischen den Zeilen der Seitenangaben */
  band: { padX: '3.7cqh', padBottom: '1.2cqh', sideGap: '0.6cqh' },
  /** Restzeit bzw. Anstoßzeit: 34 % der Höhe (größtmöglich im Uhrband, @ZM-215; bei vierstelligen Zeiten passt `useBandFit` sie der Breite an); Zeilenhöhe so, dass die Ziffern den Platz ausfüllen */
  clock: { font: '34cqh', lineHeight: 0.78, padX: '3.4cqh' },
  /** Wort an der Stelle der Restzeit („Endstand“, „4 : 3 i. E.“): 26 % der Höhe, die Breite begrenzt `useBandFit` (Schrift so klein, dass das Wort die Seitenspalten nie verdrängt) */
  word: { font: '26cqh' },
  /** Zwischenstand im Strafstoßschießen an der Stelle der Restzeit */
  shootout: { font: '23cqh' },
  /** Angaben links und rechts neben der Uhr (Live-Abzeichen, Feld, Gruppe, Abschnitt): 8 % der Höhe (mit der Vorbelegung des Bildrands von 5 % noch 7,2 % des Bildschirms, mindestens 7,08 %), Nah-Information, bei zu vielen Zeilen im Uhrband höchstens bis `fontMin` verkleinert (nie unter 7,08 % der BILDSCHIRMhöhe, auch mit Bildrand: `max(…cqh, …vh)`), nie ausgeblendet; reicht auch das nicht, als Notlösung bis `fontNot` (sichtbar vor klein); das lange Wort „Verlängerung“ im Abzeichen (12 Zeichen) in `fontLong`, damit es neben die Restzeit passt */
  side: { font: '8cqh', fontMin: 'max(7cqh, 7.08vh)', fontNot: '5.6cqh', fontLong: '6cqh', lineHeight: 1, badgePadY: '0.04em', badgePadX: '0.4em', badgeGap: '0.35em', badgeDot: '0.38em' },
  /** Kein Spiel mehr auf dem Feld: Satz mittig, Schrift 9 % der Höhe */
  noMatch: { font: '9cqh', padX: '6cqh' },
} as const;
