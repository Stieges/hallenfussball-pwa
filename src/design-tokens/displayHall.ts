/**
 * Display-Tokens der Live-Folie im Profil „Halle (sehr fern)“ (@ZM-212, @ZM-213, @ZM-214; Anordnung „Farbseiten“ aus dem
 * Gestaltungs-Review 17.11.2026, Hallentest: Bildschirm 86 × 49 cm, Leseabstand rund 22 m).
 *
 * Alle Maße in Container-Einheiten der Folienfläche innerhalb des Bildrands (`cqh`, `cqw` nur dort, wo die Breite die Grenze ist): bei
 * 1920×1080, 1280×720 und 1920×940 gilt dasselbe Verhältnis zur Höhe. Mindestwerte nach @ZM-213 (Anteil der Höhe): Torzahl 34 %,
 * Restzeit 26 % (jetzt 34 %), Namen je nach Länge 7,5 bis 20 %. Die Werte stammen aus der Mockup-Messung des Reviews (1080 px = 100 cqh).
 * Ausgabe der übrigen Folien und der Profile „Spielfeld (fern)“ und „Info (nah)“ bleibt unberührt: nichts hier wird dort gelesen.
 */
import { barColors } from './displayBar';

export const displayHall = {
  /** Zwei Farbflächen oben bis an den Rand der Folienfläche: Höhe (64,5 %: Namensfeld und Torzahl füllen sie, der Rest geht an Zeitbalken und Restzeit, @ZM-215), Lücke dazwischen, Rundung der unteren Ecken */
  panel: { height: '64.5cqh', gap: '3cqh', radius: '1.7cqh', ringWidth: '1.5cqh' },
  /** Teamname oben in der Fläche: Feld (Abstand oben, Höhe, seitlicher Abstand), größte Schrift, Zeilenhöhe (unitlos); höchstens zwei Zeilen. Die Höhe lässt Platz für die Unterlängen (g, j, p, y) der zweiten Zeile vor der Torzahl und trägt zwei Zeilen zu 15 %; beides sichern der Test `displayHall.zm213.test.ts` und die Tintenmessung in `monitor-profil-halle-zm213.spec.ts` (@ZM-213) */
  name: { top: '2.4cqh', height: '31.6cqh', padX: '3.7cqh', maxFont: '22.5cqh', lineHeight: 1.04, letterSpacing: '-0.01em' },
  /** Torzahl unter dem Namen: 35 % der Höhe, Zeilenhöhe = Versalhöhe der Ziffern (Inter 0,727), Abstand zum unteren Rand der Fläche */
  digit: { font: '35cqh', lineHeight: 0.727, bottom: '2.4cqh', letterSpacing: '-0.02em' },
  /** Doppelpunkt zwischen den Flächen: zwei Punkte (Durchmesser, Abstand, Lage von oben, auf Höhe der Torzahlen) */
  colon: { dot: '2.2cqh', gap: '8.4cqh', top: '43.9cqh' },
  /** Leibchen-Zeichen (oben links) und Pokal (oben rechts), klein in der Ecke der Fläche */
  mark: { size: '4.4cqh', inset: '0.8cqh', border: '0.3cqh', iconShare: 0.6 },
  /** Zeitbalken über die ganze Breite: Abstand zur Fläche darüber, Höhe (6 %, @ZM-215), seitlicher Abstand, Umrandung der Bahn */
  bar: { gapTop: '1.2cqh', height: '6cqh', padX: '2.2cqh' },
  /** Farben des Zeitbalkens je Thema: gemeinsam mit den übrigen Live-Sichten des Monitors (@ZM-215), siehe `displayBar.ts` */
  barColors,
  /** Uhrband unten: Innenabstand seitlich und unten, Abstand zwischen den Zeilen der Seitenangaben */
  band: { padX: '3.7cqh', padBottom: '1.2cqh', sideGap: '0.6cqh' },
  /** Restzeit bzw. Anstoßzeit: 34 % der Höhe (größtmöglich im Uhrband, @ZM-215; bei vierstelligen Zeiten passt `useBandFit` sie der Breite an); Zeilenhöhe so, dass die Ziffern den Platz ausfüllen */
  clock: { font: '34cqh', lineHeight: 0.78, padX: '3.4cqh' },
  /** Wort an der Stelle der Restzeit („Endstand“, „4 : 3 i. E.“): 26 % der Höhe, die Breite begrenzt `useBandFit` (Schrift so klein, dass das Wort die Seitenspalten nie verdrängt) */
  word: { font: '26cqh' },
  /** Zwischenstand im Strafstoßschießen an der Stelle der Restzeit */
  shootout: { font: '23cqh' },
  /** Angaben links und rechts neben der Uhr (Live-Abzeichen, Feld, Gruppe, Abschnitt): 8 % der Höhe (mit der Vorbelegung des Bildrands von 5 % noch 7,2 % des Bildschirms, mindestens 7,08 %), Nah-Information, bei zu vielen Zeilen im Uhrband höchstens bis `fontMin` verkleinert (nie unter 7,08 % der BILDSCHIRMhöhe, auch mit Bildrand: die Folie ist nie höher als das Fenster, also liegt 7 cqh nie darüber), nie ausgeblendet; reicht auch das nicht, als Notlösung bis `fontNot` (5,5 % der Bildschirmhöhe, die Grenze aus @ZM-213; mit den Symbolen statt Text von @ZM-215 steht jede Angabe in einer Zeile, die Lage „drei Abschnitte + Gruppe + Feld + Zeit abgelaufen“ braucht keine Verkleinerung mehr, Review PR #563 B1); das Wort „Verlängerung“ steht seit @ZM-215 nicht mehr im Abzeichen */
  side: { font: '8cqh', fontMin: '7.08vh', fontNot: '5.5vh', lineHeight: 1, badgePadY: '0.04em', badgePadX: '0.4em', badgeGap: '0.35em', badgeDot: '0.38em' },
  /**
   * Symbole neben der Restzeit (@ZM-215, Daniel 2026-11-19: Symbole statt Text): alle Maße in `em` der Seitenspalte, damit sie mit `useBandFit` zusammen kleiner werden.
   * Zustand der Uhr (angehalten, Pause, Pfeife, Verlängerung, Anstoß), Feld und Gruppe in Zeilenhöhe, Punkte des Abschnitts (Größe, Abstand, Randbreite), Abstand zweier Symbole
   */
  symbols: { state: '1.25em', stateGap: '0.3em', field: '1em', group: '1.1em', dot: '0.55em', dotGap: '0.2em', dotBorder: '0.09em', groupBorder: '0.07em', groupRadius: '0.15em' },
  /** Kein Spiel mehr auf dem Feld: Satz mittig, Schrift 9 % der Höhe */
  noMatch: { font: '9cqh', padX: '6cqh' },
} as const;
