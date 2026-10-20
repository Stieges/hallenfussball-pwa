/**
 * @ZM-122 / @ZM-138 in der Folienfolge: Die Live-Folie eines Feld-Monitors ohne laufendes Spiel wird übersprungen –
 * außer in der Vorlaufzeit vor dem nächsten Anpfiff auf ihrem Feld. Reine Funktionen, Zeit in ms (Europe/Berlin).
 */
import { describe, it, expect } from 'vitest';
import type { MonitorSlide } from '../../../types/monitor';
import { alleUebersprungen, nextSlide, type RuleMatch, type SlideProgram, type SlideshowState } from '../slideProgramme';

const folie = (id: string, type: string, config: object = {}) => ({ id, type, config, duration: 15, order: 0 }) as MonitorSlide;
const LIVE_F1 = folie('live-f1', 'live', { fieldId: 'field-1' });
const TABELLE = folie('tabelle', 'standings', { groupId: 'A' });
const SPONSOR = folie('sponsor', 'sponsor', { sponsorId: 'sp-1' });

/** Berlin im Winter (UTC+1): 5.12.2026. */
const berlin = (h: number, min: number): number => Date.UTC(2026, 11, 5, h - 1, min);

/** Spiel 9 auf Feld 1, Anstoß 13:00, Vorlaufzeit 5 Minuten (@ZM-122-Beispiel). */
const SPIEL_UM_13: RuleMatch = {
  id: 'm9', field: 1, isLive: false, isUpcoming: true, matchNumber: 9, kickoff: { date: '2026-12-05', time: '13:00' }, vorlaufMin: 5,
};

const programm = (slides: MonitorSlide[], matches: RuleMatch[]): SlideProgram => ({ slides, defaultDurationSec: 15, matches });
const zustand = (over: Partial<SlideshowState> = {}): SlideshowState => ({ index: 0, page: 0, startedAt: 0, direction: 'next', ...over });

describe('Rückfall nur außerhalb der Vorlaufzeit (@ZM-122, @ZM-138)', () => {
  it('@ZM-122: 12:45, erstes Spiel 13:00, Vorlaufzeit nicht begonnen → nur Live-Folie ist übersprungen (Rückfall)', () => {
    expect(alleUebersprungen([LIVE_F1], [SPIEL_UM_13], berlin(12, 45))).toBe(true);
  });

  it('@ZM-138: 12:55, Vorlaufzeit begonnen → die Live-Folie zeigt das nächste Spiel, kein Rückfall', () => {
    expect(alleUebersprungen([LIVE_F1], [SPIEL_UM_13], berlin(12, 55))).toBe(false);
  });

  it('@ZM-138: Vorlaufzeit 8 Minuten bei Anstoß 13:00 → ab 12:52 kein Rückfall, um 12:51 noch Rückfall', () => {
    const acht = { ...SPIEL_UM_13, vorlaufMin: 8 };
    expect(alleUebersprungen([LIVE_F1], [acht], berlin(12, 51))).toBe(true);
    expect(alleUebersprungen([LIVE_F1], [acht], berlin(12, 52))).toBe(false);
  });

  it('@ZM-122 Gegenbeispiel: das nächste Spiel steht auf Feld 2, der Monitor auf Feld 1 → Rückfall auch in dessen Vorlaufzeit', () => {
    expect(alleUebersprungen([LIVE_F1], [{ ...SPIEL_UM_13, field: 2 }], berlin(12, 58))).toBe(true);
  });

  it('@ZM-122 Gegenbeispiel: nach dem letzten Spiel (nichts mehr geplant) → Rückfall', () => {
    expect(alleUebersprungen([LIVE_F1], [{ ...SPIEL_UM_13, isUpcoming: false }], berlin(13, 20))).toBe(true);
  });
});

describe('Folienfolge bei mehreren Folien (@ZM-122, @ZM-138)', () => {
  it('@ZM-122: vor der Vorlaufzeit wird die Live-Folie übersprungen (Wechsel von Tabelle zu Sponsor)', () => {
    const p = programm([LIVE_F1, TABELLE, SPONSOR], [SPIEL_UM_13]);
    const next = nextSlide(p, zustand({ index: 1, startedAt: berlin(12, 45) }), berlin(12, 45) + 15_000);
    expect(next.index).toBe(2);
    const wieder = nextSlide(p, zustand({ index: 2, startedAt: berlin(12, 45) }), berlin(12, 45) + 15_000);
    expect(wieder.index).toBe(1); // zurück zur Tabelle, die Live-Folie bleibt draußen
  });

  it('@ZM-138: in der Vorlaufzeit kommt die Live-Folie in der Folge dran', () => {
    const p = programm([LIVE_F1, TABELLE, SPONSOR], [SPIEL_UM_13]);
    const next = nextSlide(p, zustand({ index: 2, startedAt: berlin(12, 56) }), berlin(12, 56) + 15_000);
    expect(next.index).toBe(0);
  });

  it('@ZM-138: steht der Monitor auf der Live-Folie und die Vorlaufzeit ist (noch) nicht da, geht er weiter', () => {
    const p = programm([LIVE_F1, TABELLE], [SPIEL_UM_13]);
    expect(nextSlide(p, zustand({ index: 0, startedAt: berlin(12, 40) }), berlin(12, 40)).index).toBe(1);
  });

  it('@ZM-138: steht der Monitor in der Vorlaufzeit auf der Live-Folie, bleibt er dort bis zum Takt', () => {
    const p = programm([LIVE_F1, TABELLE], [SPIEL_UM_13]);
    expect(nextSlide(p, zustand({ index: 0, startedAt: berlin(12, 56) }), berlin(12, 56) + 5_000).index).toBe(0);
  });

  it('Anpfiff in der Vorlaufzeit: läuft das Spiel, hält die Live-Folie (Pin) wie bisher', () => {
    const p = programm([LIVE_F1, TABELLE], [{ ...SPIEL_UM_13, isLive: true, isUpcoming: false }]);
    expect(nextSlide(p, zustand({ index: 1 }), berlin(13, 1))).toMatchObject({ index: 0, pinnedMatchId: 'm9' });
  });
});
