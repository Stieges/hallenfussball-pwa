/**
 * @SL-173 Gleich helle Farben bekommen einen Hinweis „gleich hell“, aber KEINE Leibchen-Karte (Daniel 2026-11-10; Rot-Grün-Schwäche).
 * Testwerte aus dem Gherkin (docs/anforderungen/2026-10-02_spiel-leiten.md, Szenariogrundriss @SL-173), nicht aus dem Code.
 * Vorher löste die Helligkeit die Karte aus; Beispiel Rot/Grün und Rot/Blau erwarteten `bibSide: 'a'` – seit der geänderten @SL-173 nicht mehr.
 */
import { describe, expect, it } from 'vitest';
import { kitConflict, kitSameBrightness, KIT_SIMILAR_LUMINANCE_RATIO } from '../kit';
import { kitHinweis, leibchenWieEigenesTrikot } from '../kitChoice';
import { resolveBoxColors } from '../scoreBoxColors';
import { DEFAULT_SPECTATOR_DISPLAY, standardColorsTooSimilar } from '../spectatorDisplay';
import { hexDeltaE2000 } from '../kitColorDistance';
import { kitBeimAnpfiff } from '../kitAnpfiff';
import { teamSlot } from '../matchSlot';
import { getContrastRatio } from '../../../design-tokens/display';
import type { Match, Team } from '../../../types/tournament';

const FC_NORD = '11111111-1111-4111-8111-000000000002';
const DJK_BERG = '11111111-1111-4111-8111-000000000004';

const round2 = (n: number): number => Math.round(n * 100) / 100;

describe('@SL-173 Helligkeitsabstand der Trikotfarben', () => {
  it('@SL-173 die Grenze ist 1,5 : 1', () => {
    expect(KIT_SIMILAR_LUMINANCE_RATIO).toBe(1.5);
  });

  // Alle vier Beispielzeilen wörtlich (Farbe FC Nord | Farbe DJK Berg | Helligkeit | Hinweis).
  it.each([
    { zeile: 'Rot/Grün', nord: '#D32F2F', berg: '#2E7D32', helligkeit: 1.03, hinweis: true },
    { zeile: 'Rot/Blau', nord: '#C62828', berg: '#1565C0', helligkeit: 1.02, hinweis: true },
    { zeile: 'Gelb/Blau', nord: '#FFEB3B', berg: '#1565C0', helligkeit: 4.71, hinweis: false },
    { zeile: 'Rot/Weiß', nord: '#D32F2F', berg: '#FFFFFF', helligkeit: 4.98, hinweis: false },
  ])('@SL-173 $zeile: Helligkeit $helligkeit → keine Karte, Hinweis „gleich hell“: $hinweis', ({ nord, berg, helligkeit, hinweis }) => {
    expect(round2(getContrastRatio(nord, berg))).toBe(helligkeit);
    // Der Farbabstand ist in allen Zeilen über 30 – deshalb keine Karte; der Hinweis kommt nur über die Helligkeit.
    expect(hexDeltaE2000(nord, berg)).toBeGreaterThan(30);
    // „Karte nötig“ = nur der Farbabstand (SL-139): in allen vier Zeilen keine Karte
    expect(kitConflict(nord, berg)).toBe('none');
    expect(kitConflict(berg, nord)).toBe('none');
    expect(kitHinweis({ a: nord, b: berg })).toBe('none');
    // „gleich hell“ wird weiter gemessen, in beide Richtungen
    expect(kitSameBrightness(nord, berg)).toBe(hinweis);
    expect(kitSameBrightness(berg, nord)).toBe(hinweis);

    const teams: Team[] = [
      { id: FC_NORD, name: 'FC Nord', colors: { primary: nord } },
      { id: DJK_BERG, name: 'DJK Berg', colors: { primary: berg } },
    ];
    const match: Match = { id: 'spiel-15', round: 1, field: 1, slotA: teamSlot(FC_NORD), slotB: teamSlot(DJK_BERG) };
    expect(kitBeimAnpfiff(match, teams, undefined).bibSide).toBeUndefined();
  });

  // Gegenbeispiel: Die Helligkeitsregel gilt nicht für die Ergebniskästen der Zuschauer (@ZM-153, @ZM-159).
  it('@ZM-153 Blau/Rot (Helligkeit 1,02:1): Vorschau ohne Hinweis, Gast-Kasten bleibt Rot', () => {
    const settings = { ...DEFAULT_SPECTATOR_DISPLAY, homeColor: '#1565C0', awayColor: '#C62828' };
    expect(standardColorsTooSimilar(settings)).toBe(false);
    const { a, b } = resolveBoxColors({ worn: {}, settings });
    expect(a.fill).toEqual({ kind: 'solid', color: '#1565C0' });
    expect(b.fill).toEqual({ kind: 'solid', color: '#C62828' });
  });

  // Grenze 1,5 : 1 genau abgesichert: Die Paare liegen knapp darunter (1,4998) bzw. knapp darüber (1,5001) mit Blau #1565C0,
  // ΔE2000 jeweils über 30 – nur die Helligkeit entscheidet. Werte per getContrastRatio ausgerechnet, nicht geschätzt.
  it.each([
    { zeile: 'knapp unter 1,5', farbe: '#2D960F', verhaeltnis: 1.4998, hinweis: true },
    { zeile: 'knapp über 1,5', farbe: '#23553C', verhaeltnis: 1.5001, hinweis: false },
  ])('@SL-173 Grenze $zeile: #1565C0 / $farbe → Verhältnis $verhaeltnis, Hinweis „gleich hell“: $hinweis', ({ farbe, verhaeltnis, hinweis }) => {
    const blau = '#1565C0';
    expect(Math.round(getContrastRatio(blau, farbe) * 10000) / 10000).toBe(verhaeltnis);
    expect(hexDeltaE2000(blau, farbe)).toBeGreaterThan(30);
    expect(kitConflict(blau, farbe)).toBe('none');
    expect(kitSameBrightness(blau, farbe)).toBe(hinweis);
  });
});

describe('@SL-231 Farbliste der Karte: „wie Trikot“ und „gleich hell“', () => {
  const ROT = '#C62828';
  const BLAU = '#1565C0';
  it('@SL-231 SV Süd in Rot, Rot gewählt: Warnung „wie Trikot“ (aehnlich)', () => {
    expect(leibchenWieEigenesTrikot({ a: ROT, b: '#FFFFFF' }, 'a', ROT)).toBe('aehnlich');
  });
  it('@SL-231 SV Süd in Blau #1565C0, Rot #C62828 gewählt: Farbabstand 44,8, aber 1,02 : 1 – Hinweis „gleich hell“ (@SL-173)', () => {
    expect(hexDeltaE2000(ROT, BLAU)).toBeGreaterThan(44);
    expect(leibchenWieEigenesTrikot({ a: BLAU, b: '#FFFFFF' }, 'a', ROT)).toBe('gleichHell');
  });
  it('@SL-231 Gegenbeispiel: Gelb gegen das Rot von SV Süd – weder Warnung noch Hinweis', () => {
    expect(leibchenWieEigenesTrikot({ a: ROT, b: '#FFFFFF' }, 'a', '#FFCC00')).toBe('none');
  });
  it('@SL-231 Gegenbeispiel: nur die EIGENE Seite zählt – Rot gegen das Trikot des Gegners (Weiß) bleibt ohne Warnung', () => {
    expect(leibchenWieEigenesTrikot({ a: '#FFFFFF', b: ROT }, 'a', ROT)).toBe('none');
  });
  it('@SL-231 Gegenbeispiel: ohne Trikotfarbe der Seite nie eine Warnung', () => {
    expect(leibchenWieEigenesTrikot({ b: ROT }, 'a', ROT)).toBe('none');
  });
});
