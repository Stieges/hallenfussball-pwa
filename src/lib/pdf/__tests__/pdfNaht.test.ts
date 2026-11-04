/**
 * B-28 C7 – Architektur-Naht (Fable B10): ein Eingang `PdfInput`, ein `RenderContext`, `pageGeometry(format, orientation)`
 * mit `scale` an einer Stelle. Der Spielplan bleibt dabei unverändert: Text und Koordinaten aller Seiten der vier
 * Pflicht-Fixtures sind vor und nach dem Umbau gleich (Prüfsumme über die gerundeten pdfjs-Maße). Seit C8 ist die Summe ein
 * Änderungsmelder gegen ungewollte Verschiebungen, kein Nachweis der Wortlaute (das tragen die pdfjs-Wortlaut-Tests). Bei
 * Neuaufnahme Bild DE und EN sichten.
 */
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { printPage } from '../../../design-tokens/print';
import { printFormat } from '../../../design-tokens/print-format';
import { pageGeometry } from '../layout';
import { hallencupSchedule } from './pdfFixture';
import { FIXTURES, layoutOf } from './pdfFixtureLayout';
import { translatorFor } from './pdfText';
import type { LayoutPage } from './pdfjsLayout';

/** Fester Zeitpunkt: die Fußzeile trägt den Stand, sonst änderte sich die Prüfsumme jede Minute. */
const STAND = new Date(2026, 10, 14, 15, 7);
const round = (n: number): number => Math.round(n * 100) / 100;

/** Prüfsumme über Text, Maße, Füllungen und Linien aller Seiten, auf 0,01 mm gerundet. */
export function layoutDigest(pages: LayoutPage[]): string {
  const flat = pages.map(p => ({
    t: p.texts.map(t => [t.str, round(t.x), round(t.y), round(t.size), round(t.w)]),
    r: p.rects.map(r => [round(r.x), round(r.y), round(r.w), round(r.h), r.fill ?? '', r.stroke ?? '']),
    l: p.lines.map(l => [round(l.x1), round(l.y1), round(l.x2), round(l.y2), round(l.width), l.color]),
  }));
  return createHash('sha1').update(JSON.stringify(flat)).digest('hex').slice(0, 12);
}

/**
 * Prüfsummen je Pflicht-Fixture. Aufgenommen am Stand c1d6b429 (vor dem Umbau der Naht); die Naht hat sie nicht verändert.
 * Neu aufgenommen am Stand C8-F (16.10.: Spalten mindestens so breit wie ihr Kopfwort; C8 vorher c7d6997a6c6d, c2263d5409c3,
 * a42071e7d8cb, 82c6e0bc524d; selbst aufgenommen, bestätigt also nur Stabilität), weil Daniels Wortlaut-Entscheidungen den gedruckten Text ändern: Kopfzeile
 * „Spielplan“ (G57), „Gruppen + Finalrunde“ (G71), „Wertung“ (G72), „5 Schützen je Team“ (G74). Die Kopfzeile verschiebt
 * alles darunter; Bilder (Grafiken) erfasst die Summe nicht. Die Maße der alten Stände: 1f942dff25ce, 8bd3acd911de,
 * 2cff8b00a80b, a492098473fc (hoch 12, hoch 20, quer 12, quer 20).
 * Neu aufgenommen beim Merge von main in Spur C (16.10., I-C): der Generator auf main ändert den Plan, der PDF-Code nicht.
 * Halbfinale über Kreuz 1A–2B / 1B–2A (W8, @TM-015; vorher 2A–1B / 1A–2B), dadurch Heim-/Gast-Spalten 1–2 mm anders breit;
 * bei 20 Spielen neue Reihenfolge der Gruppenspiele, Ende 15:10 statt 15:30. Seitenzahl unverändert, Text-für-Text
 * verglichen (Lauf vor/nach dem Merge). C8-F-Stände: 2ce4400a8222, 5290b179abed, 3da3988d5446, 4f32e0da30fc, EN a89e4efe5be4.
 * Neu aufgenommen 20.10. (@TM-144, Befund C-FINALE-VOR-PLATZ3-IM-SEED): der Generator setzt das Spiel um Platz 3 (Nr. 15,
 * 14:10) vor das Finale (Nr. 16, 14:20), der PDF-Code ist unverändert. Text-für-Text verglichen (Lauf vor/nach): hoch DE/EN
 * gleiche Texte je Seite, nur die Abschnitte Platz 3 und Finale getauscht; quer gleiche Seitenzahl, der Seitenumbruch
 * fällt jetzt zwischen Überschrift „Finale“ (Seite 4 unten) und Finalzeile (Seite 5). Stände davor: bb3e0ca5e417,
 * 5bd69682be36, 783e5046a4f9, d652f84ac302, EN 4b9bdb85b3f8.
 * Neu aufgenommen 24.10. (@DR-020): neue Kopfzeile „Gleichstand auf Platz 1: Strafstoßschießen“ unter der Wertung; sie verschiebt
 * alles darunter um eine Zeile, sonst ändert sich nur dieser Text. Stände davor: 1b9bebb000a0, 8aeb731a31c0, 748bb781943c,
 * 19c0c20f5f26, EN ee7c12a63f2c.
 * Neu aufgenommen 25.10. (R2 PR 4, @W2A-012): die Vorgabe der Schützen ist 3 statt 5; Text-für-Text verglichen (Vorgabe 5 gegen 3):
 * nur die beiden K.-o.-Zeilen „… 5 Schützen je Team“ → „… 3 Schützen je Team“ (EN „shooters“), Lage unverändert. Stände davor:
 * 92e27f9338d0, 026dca7efbd1, 2ad20180580c, 329ef9fb4fa6, EN 1e5c882d540d.
 * Neu aufgenommen 02.11. (C-PDF-SCHRIFT-OHNE-MERKMALE, Paket PDF T1): neu geschnittene Schrift mit gleich breiten Ziffern und
 * Doppelpunkt (alle Ziffern Regular 1328 statt 833–1323, Bold 1324 statt 883–1385 Einheiten), I und l unterscheidbar. Text-für-Text verglichen (Lauf mit alter und neuer
 * Schrift, alle fünf Fixtures): gleiche Seitenzahl, gleiche Textstücke bis auf die Herkunft der Finalteams, die in den Hochformaten
 * wegen der breiteren „1“ und „2“ umbricht („Sieger Halbfinale“ / „1“; EN „Loser Semi-final“ / „1“); alles andere verschiebt sich um
 * Bruchteile eines Millimeters. Bild DE (Seite 1 und 3) und EN (Seite 3) gesichtet (Review und Umsetzer). Stände davor: 5e61f5f4ce76, fe74f2817606, 0fd9a8f07abe, 9166518dd987, EN 78c5516555dd.
 * Neu aufgenommen 01.11. (@OB-075/@OB-076, Paket „Begriffe ausschreiben“): Spaltenköpfe „Schiedsrichter“ und „Gruppe“ statt „SR“
 * und „Gr“, „Nr.“/„Sp.“/„Diff.“/„Pkt.“ und „#“ statt „Nr“/„Sp“/„Diff“/„Pkt“/„Pl“ (EN: „Referee“, „Group“, „GD“, „#“), „10 Minuten“
 * statt „10 Min.“ in der Regelzeile; die Spalte „Schiedsrichter“ ist 27 mm breit (Token printColumns), „Gruppe“ und „Nr.“ weiten
 * sich auf ihr Kopfwort, Heim und Gast werden in der Gruppenphase und der Finalrunde ca. 5 mm schmaler (Namen brechen früher um).
 * Stände davor (Stand T1): ee37c5de21d3, 574eec8b7779, 0bf091cb1408, c2826c814458, EN fb13bbb6d917.
 * Text-für-Text verglichen (12 Spiele, hoch, DE und EN; Lauf origin/main mit T1 gegen diesen Stand, je 337 Textstücke): geändert sind nur die
 * genannten Kopfwörter und Zahlwörter („10 Minuten“, EN „10 minutes“, „Gruppe“/„Group“, „Schiedsrichter“/„Referee“, „#“, „Nr.“, „Sp.“,
 * „Diff.“, „Pkt.“, EN „GD“) und der Umbruch der Herkunft der Finalteams in der schmaleren Heim- und Gast-Spalte („Sieger“ / „Halbfinale 1“
 * statt „Sieger Halbfinale“ / „1“; EN „Winner“ / „Semi-final 1“). Bild DE (Seite 1 und 3) und EN (Seite 1 und 3) gesichtet: Köpfe
 * ungebrochen, nichts abgeschnitten, kein Überlauf, Heim und Gast in beiden Sprachen lesbar.
 * Die drei übrigen Prüfsummen (20 Spiele hoch, 12 und 20 Spiele quer) sind ebenfalls Text-für-Text gegen origin/main verglichen (als Menge der
 * Textstücke, Zählung je Stück): dieselbe Änderung, nämlich nur die oben genannten Wörter (je Seitenkopf „Nr.“, „Schiedsrichter“, „Gruppe“,
 * „#“, „Sp.“, „Diff.“, „Pkt.“, die Zeitzeile) und in den Hochformaten der Umbruch „Sieger“ / „Halbfinale 1“; im Querformat ändert sich
 * zusätzlich die Reihenfolge, in der die Kopfzellen ausgegeben werden, nicht ihr Inhalt.
 * Neu aufgenommen 02.11. (Glossar-Folge, @OB-075/@DR-025/@DR-001): Spaltenköpfe „SR“ (EN „Ref“) und „Gr.“ (EN „Grp“) statt „Schiedsrichter“/„Referee“
 * und „Gruppe“/„Group“ (Kurzformen im Tabellenkopf, Daniel 02.11.); die Zeitspalte ist mindestens so breit wie „00:00“ in der Schrift der Zeile
 * (+0,7 mm, @DR-001: keine Uhrzeit bricht um), dadurch wird die Gruppen-Spalte schmaler (kürzeres Kopfwort) und Heim/Gast ändern ihre Breite um
 * Bruchteile eines Millimeters. Text-für-Text verglichen (Lauf origin/main 5e440d09 gegen diesen Stand, alle vier Fixtures DE, EN hoch 12 und 20
 * Spiele und EN quer, je Textstück gezählt): gleiche Seitenzahlen; geändert sind nur die Kopfwörter („Gruppe“ → „Gr.“, „Schiedsrichter“ → „SR“; EN
 * „Group“ → „Grp“, „Referee“ → „Ref“) und der Umbruch einzelner Herkunftstexte („Zweiter Gruppe A“ → „Zweiter Gruppe“ / „A“; EN „Loser Semi-final“ /
 * „1“ → „Loser“ / „Semi-final 1“). Bild DE (Seite 1 und 3) und EN (Seite 1 und 3) gesichtet. Stände davor: 6720748dc9c2, 1d9fc9ecc557,
 * af351460128a, b0c3148ebdee, EN e14f54a199ec.
 * Neu aufgenommen 03.11. (Paket PDF T7a, Seitenmodell + Zeichenschicht): Seite 1 und Folgeseiten der Gruppenspiele im Handzettel-Bild
 * (Kopf mit Eckdaten, Zebra, Schreiblinien, Adresse in der Fußzeile, keine Teilnehmerliste, immer A4 hoch). Bild der Fixtures a, b, c
 * gesichtet. Die Querformat-Fixtures entfallen (@DR-026, MVP+). Mit „Ablauf“ in den Eckdaten und den Gruppenzeichen (@DR-031, @DR-001).
 * Neu aufgenommen 03.11. (@DR-034, 5 mm Schreibraum): Schreiblinie 3 mm statt 4 mm über dem Zeilenboden, Zeileninhalt 1 mm tiefer, Stundentrenner 0,7 mm tiefer in der Stunde; verglichen mit dem Stand davor: gleiche Textstücke in gleicher Reihenfolge, gleiche Seitenzahl, gleiche Zahl von Füllungen und Linien je Seite, es ändert sich nur die Lage (Stände davor: 7216a62abeb3, 8d29266cc850, EN 92afa4a2e407).
 * Neu aufgenommen 03.11. (@DR-034, Zeilen mit Stundentrenner höher, Doppelpunkt näher an der Linie, Trenner 0,75 mm): wieder gleiche Textstücke, Seitenzahl und Zahl der Füllungen und Linien, nur Lage und Höhen ändern sich (Stände davor: e45bc8f4ce78, 6125467d3f7e, EN 5c377ebc616f).
 * Neu aufgenommen 03.11. (@DR-031, Bezeichnungen „Wann“, „Wo“, „Spielzeit“, „Ablauf“ in Versalien mit Sperrung und Akzentstrich): gleiche Seitenzahl; geändert sind nur diese vier Textstücke (Versalien, EN „WHEN“, „WHERE“, „MATCH TIME“, „MATCHES“) und je ein Strich mehr im Kopf (Stände davor: d0a24a8c6d9f, 4b8fec7ed423, EN ea3feed6e2d2).
 * Neu aufgenommen 03.11. (@DR-024, Titel und Zeile darunter mittig im freien Platz): gleiche Textstücke und Seitenzahl, nur die x-Lage der Titelzeilen ändert sich (Stände davor: bfd83224a3d3, 1030955f1569, EN 39c333f4c7be).
 * Neu aufgenommen 03.11. (@DR-024, Kurzkopf der Folgeseiten mittig): wieder gleiche Textstücke und Seitenzahl, nur die x-Lage von Titel und Zeile im Kurzkopf ändert sich (Stände davor: b8b53fc00c3f, cdbe4c898d6e, EN 40ac67e9e46e).
 * Neu aufgenommen 03.11. (@DR-024, Titel 26 pt mit 2 mm Luft darüber und darunter): gleiche Textstücke, Seitenzahl und Zahl der Füllungen und Linien je Seite (Lauf gegen den Stand davor); es ändern sich nur die Höhenlagen ab dem Titel (Stände davor: e96bd7631edc, 95b69a12d525, EN fa095c9a84f8). Stände davor: 2341a1c44ae0, 126de4bc7787, EN d04aeeb0a9b1.
 * Neu aufgenommen 04.11. (T7b Fixrunde 3): SR-Spalte der Finalrunde 23 mm mit 1 mm Innenabstand (Teamnamen brechen um, @DR-037), Spalten Nummer 5,4 und Zeit 15,1 mm; Seite 1 und die Gruppenspiele unverändert, es ändern sich nur Lagen in der Finalrunde (Stände davor: bf37a0b4ba7f, 47cbcae2d933, EN 134575c38710).
 * Neu aufgenommen 04.11. (T7b Fixrunde 2): Abstand der Uhrzeit zur Namenslinie der Finalrunde (nameOuter 2,15 statt 0,4, Spalte der kleinen Linien 22 mm); nur die Lage in der Finalrunde ändert sich (Stände davor: a64320e43d7b, 02572b3b81d3, EN b2fd943f59c8).
 * Neu aufgenommen 04.11. (T7b Fixrunde): Fußzeile mit festen Plätzen (@DR-044: „Titel · Stand“ und „Seite x von y“ getrennt, rechts unten), kein „voraussichtlich“ mehr (@DR-001), kleine Linien der Finalrunde unter dem Ergebnis bei Feld- oder SR-Spalte (@DR-037, 7 mm, Abstände ≥ 4 mm, @DR-034); die Hallencup-Fixtures haben zwei Felder, die Finalrunde ist höher. Stände davor: f8c2732ccd42, d8ef4c756344, EN b4202197d563.
 * Neu aufgenommen 03.11. (Paket PDF T7b, Seite 2 ff.): Tabellen mit Gruppenzeichen und Raster, Strafstoß-Zeile, Finalrunde mit Namenslinien und Herkunft unter der Linie, Platzierung, Modus „2 Gruppen + Finalrunde“, Kurzkopf vor dem Inhalt, Feldnummern; keine Abschnittstitel und -nummern mehr, Finalrunde und Platzierung auf der Seite der Tabellen, wenn sie dort ganz Platz haben. Bild der Fixtures a, b, c, b-lang gesichtet (Stände davor: e109befcec2b, 9947181a693b, EN e38b6350af9f).
 * Neu aufgenommen 04.11. (T9, C-PDF-QR-RAND-FOLGESEITE, @DR-003): Kopflinie des Kurzkopfs 1 mm unter der Ruhezone des QR statt in ihr
 * (`printHeader.qrRuleGap`). Text-für-Text verglichen (Lauf main 5a28cc09 gegen diesen Stand, 12 und 20 Spiele DE, 12 Spiele EN): gleiche
 * Seitenzahl, gleiche Textstücke in gleicher Reihenfolge, gleiche Zahl von Füllungen und Linien je Seite; Seite 1 unverändert, auf den
 * Folgeseiten liegt der Inhalt unter dem Kurzkopf genau 1,0 mm tiefer (Kurzkopf-Titel, -Zeile und Fußzeile unverändert). Die Zeilenhöhen
 * (C-PDF-ENGE-STUFE-UNTERLAENGE) ändern hier nichts: die Hallencup-Namen sind einzeilig. Stände davor: c271743aa44b, 8f4a61f67824, EN 2ee274eadb3b.
 */
const VORHER: Record<string, string> = {
  '12 Spiele, hoch': 'eb36e29082e2',
  '20 Spiele, hoch': 'cb15518a4350',
};

describe('@DR-001 Naht: Spielplan-Muster vorher = nachher', () => {
  it.each(FIXTURES)('$name: Prüfsumme des Layouts', async ({ name, options, schedule }) => {
    const { pages } = await layoutOf({ ...options, now: STAND }, schedule());

    expect(layoutDigest(pages)).toBe(VORHER[name]);
  });
});

describe('@DR-022 Naht EN: Spielplan englisch (Änderungsmelder, Kopfwörter ungebrochen seit C8-F)', () => {
  it('12 Spiele, hoch, englisch: Prüfsumme des Layouts', async () => {
    const { pages } = await layoutOf({ locale: 'en', translate: translatorFor('en'), now: STAND }, hallencupSchedule());

    expect(layoutDigest(pages)).toBe('54751521beb2');
  });
});

describe('B10d pageGeometry(format, orientation): scale an einer Stelle', () => {
  it('A4 hat scale 1 und die Ränder der Tokens', () => {
    const geo = pageGeometry('a4', 'portrait');

    expect(geo.scale).toBe(1);
    expect(geo.left).toBe(printPage.margin.left);
    expect(geo.top).toBe(printPage.margin.top);
    expect(geo.contentWidth).toBe(printPage.a4.portrait.width - printPage.margin.left - printPage.margin.right);
  });

  it.each(['a3', 'a2'] as const)('%s: Ränder = Token × scale, Satzspiegel = Breite − Ränder, genau einmal skaliert', format => {
    const geo = pageGeometry(format, 'portrait');
    const scale = printFormat[format].scale;

    expect(geo.scale).toBe(scale);
    expect(geo.left).toBeCloseTo(printPage.margin.left * scale, 6);
    expect(geo.right).toBeCloseTo(printPage.margin.right * scale, 6);
    expect(geo.top).toBeCloseTo(printPage.margin.top * scale, 6);
    expect(geo.contentWidth).toBeCloseTo(geo.width - geo.left - geo.right, 6);
    expect(geo.contentWidth).toBeCloseTo(printFormat[format].portrait.width - (printPage.margin.left + printPage.margin.right) * scale, 6);
  });
});
