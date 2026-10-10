// @vitest-environment node
/**
 * Reine Sichtbarkeitsregeln des Monitors (B-16e2, @W2A-031, @ZM-090). Ohne React.
 */
import { describe, it, expect } from 'vitest';
import type { MonitorSlide } from '../../../types/monitor';
import { scoresPublic, isSlideShowable, zuschauerUrl } from '../publicVisibility';
import { selectDisplayableSlides } from '../slideProgramme';

const AUSGEBLENDET = { hideScoresForPublic: true };
const OEFFENTLICH = { hideScoresForPublic: false };

function folie(type: MonitorSlide['type'], id: string = type): MonitorSlide {
  return { id, type, config: {}, duration: null, order: 0 };
}

describe('scoresPublic', () => {
  it.each([
    { fall: 'Schalter aus', turnier: OEFFENTLICH, erwartet: true },
    { fall: 'Schalter an', turnier: AUSGEBLENDET, erwartet: false },
    { fall: 'kein Turnier geladen', turnier: null, erwartet: true },
  ])('$fall → $erwartet', ({ turnier, erwartet }) => {
    expect(scoresPublic(turnier)).toBe(erwartet);
  });
});

describe('isSlideShowable', () => {
  it('Tabelle ist bei ausgeblendeten Ergebnissen nicht zeigbar (@ZM-090)', () => {
    expect(isSlideShowable(folie('standings'), AUSGEBLENDET)).toBe(false);
  });

  it('Tabelle bleibt bei öffentlichen Ergebnissen zeigbar', () => {
    expect(isSlideShowable(folie('standings'), OEFFENTLICH)).toBe(true);
  });

  it.each(['live', 'schedule-field', 'sponsor', 'custom-text'] as const)('%s ist auch im Kindermodus zeigbar', (typ) => {
    expect(isSlideShowable(folie(typ), AUSGEBLENDET)).toBe(true);
  });
});

describe('zuschauerUrl (F-03/R7: nie die Verwaltung)', () => {
  it('öffentliches Turnier mit Share-Code → Zuschauer-Adresse', () => {
    const url = zuschauerUrl({ isPublic: true, shareCode: 'ABC123' });
    expect(url).toContain('/#/live/ABC123');
    expect(url).not.toContain('/#/tournament/');
  });

  it.each([
    { fall: 'nicht öffentlich', turnier: { isPublic: false, shareCode: 'ABC123' } },
    { fall: 'ohne Share-Code', turnier: { isPublic: true, shareCode: '' } },
    { fall: 'Turnier fehlt', turnier: null },
  ])('$fall → kein QR (null)', ({ turnier }) => {
    expect(zuschauerUrl(turnier)).toBeNull();
  });
});

describe('selectDisplayableSlides mit isShowable (@ZM-090)', () => {
  const nurTabelle = [folie('standings', 'tab')];
  const verboten = (slide: MonitorSlide) => isSlideShowable(slide, AUSGEBLENDET);

  it('bleibt nichts zeigbar übrig, kommt die Zuschauer-QR-Folie', () => {
    const ergebnis = selectDisplayableSlides(nurTabelle, { qrMoeglich: true, isShowable: verboten });
    expect(ergebnis).toHaveLength(1);
    expect(ergebnis[0]).toMatchObject({ type: 'qr-code' });
  });

  it('ohne QR-Möglichkeit fällt der Rückfall auf den Spielplan', () => {
    const ergebnis = selectDisplayableSlides(nurTabelle, { qrMoeglich: false, isShowable: verboten });
    expect(ergebnis).toHaveLength(1);
    expect(ergebnis[0]).toMatchObject({ type: 'schedule-field' });
  });

  it('ohne isShowable bleibt die Tabelle erhalten (Gegenbeispiel: Schalter aus)', () => {
    const ergebnis = selectDisplayableSlides(nurTabelle, { qrMoeglich: true });
    expect(ergebnis.map(s => s.type)).toEqual(['standings']);
  });

  it('zeigbare Folien bleiben in ihrer Reihenfolge, wertende fallen weg', () => {
    const programm = [folie('standings', 'tab'), folie('live', 'live'), folie('sponsor', 'spon')];
    const ergebnis = selectDisplayableSlides(programm, { qrMoeglich: true, isShowable: verboten });
    expect(ergebnis.map(s => s.id)).toEqual(['live', 'spon']);
  });
});
