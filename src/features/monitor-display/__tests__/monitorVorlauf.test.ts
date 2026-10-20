/**
 * @ZM-138: Vorlaufzeit = Pausendauer, mindestens 5 Minuten; ab 15:25 bei Pause 3 Minuten und Anstoß 15:30, ab 15:22 bei Pause 8.
 * Die Uhr läuft in Turnier-Ortszeit (Europe/Berlin, @ZM-111) und auf Minuten genau.
 */
import { describe, it, expect } from 'vitest';
import { imVorlauf, vorlaufMinuten, type VorlaufSpiel } from '../monitorVorlauf';
import { minutesBetween } from '../../../core/view';

/** Berlin im Winter (UTC+1): 5.12.2026, Stunde/Minute/Sekunde Berliner Zeit. */
const berlin = (h: number, min: number, s = 0): number => Date.UTC(2026, 11, 5, h - 1, min, s);

const spiel = (over: Partial<VorlaufSpiel> = {}): VorlaufSpiel => ({
  field: 1, isUpcoming: true, matchNumber: 1, kickoff: { date: '2026-12-05', time: '15:30' }, vorlaufMin: 5, ...over,
});

describe('vorlaufMinuten – Pausendauer, mindestens 5 Minuten (@ZM-138)', () => {
  it.each([
    [3, 5], [8, 8], [5, 5], [0, 5],
  ])('Pause %i Minuten → Vorlaufzeit %i Minuten', (pause, erwartet) => {
    expect(vorlaufMinuten({ groupPhaseBreakDuration: pause }, 'groupStage')).toBe(erwartet);
  });

  it('ohne Pausenangabe gilt das Minimum von 5 Minuten', () => {
    expect(vorlaufMinuten({}, 'groupStage')).toBe(5);
  });

  it('vor einem Spiel der Finalrunde zählt deren Pause, ohne eigene Angabe die der Gruppenphase', () => {
    expect(vorlaufMinuten({ groupPhaseBreakDuration: 3, finalRoundBreakDuration: 9 }, 'final')).toBe(9);
    expect(vorlaufMinuten({ groupPhaseBreakDuration: 7 }, 'final')).toBe(7);
    expect(vorlaufMinuten({ groupPhaseBreakDuration: 9, finalRoundBreakDuration: 3 }, 'groupStage')).toBe(9);
  });
});

describe('imVorlauf – Beginn auf die Minute genau (@ZM-138)', () => {
  it('Pause 3 (Vorlaufzeit 5), Anstoß 15:30: 15:24:59 noch nicht, ab 15:25:00 ja, 15:26 ja', () => {
    const spiele = [spiel({ vorlaufMin: 5 })];
    expect(imVorlauf(spiele, 1, berlin(15, 24, 59))).toBe(false);
    expect(imVorlauf(spiele, 1, berlin(15, 25, 0))).toBe(true);
    expect(imVorlauf(spiele, 1, berlin(15, 26))).toBe(true);
  });

  it('Pause 8, Anstoß 15:30: 15:21 noch nicht, ab 15:22 ja', () => {
    const spiele = [spiel({ vorlaufMin: 8 })];
    expect(imVorlauf(spiele, 1, berlin(15, 21, 59))).toBe(false);
    expect(imVorlauf(spiele, 1, berlin(15, 22))).toBe(true);
  });

  it('ein überfälliges, noch nicht angepfiffenes Spiel bleibt „nächstes“ und damit im Vorlauf (@ZM-141)', () => {
    expect(imVorlauf([spiel()], 1, berlin(15, 41))).toBe(true);
  });

  it('Gegenbeispiel: ein angepfiffenes, beendetes oder ausgefallenes Spiel (nicht geplant) zählt nie', () => {
    expect(imVorlauf([spiel({ isUpcoming: false })], 1, berlin(15, 28))).toBe(false);
  });

  it('Gegenbeispiel: das nächste Spiel eines anderen Felds zählt nie', () => {
    expect(imVorlauf([spiel({ field: 2 })], 1, berlin(15, 28))).toBe(false);
  });

  it('maßgeblich ist das früheste geplante Spiel des Felds, nicht ein späteres', () => {
    const spiele = [
      spiel({ matchNumber: 2, kickoff: { date: '2026-12-05', time: '15:40' } }),
      spiel({ matchNumber: 1, kickoff: { date: '2026-12-05', time: '15:30' } }),
    ];
    expect(imVorlauf(spiele, 1, berlin(15, 36))).toBe(true); // Spiel 1 ist überfällig und bleibt das nächste
    expect(imVorlauf([spiele[0]], 1, berlin(15, 36))).toBe(true); // Spiel 2 allein: 4 Minuten vorher
    expect(imVorlauf([spiele[0]], 1, berlin(15, 34))).toBe(false); // Spiel 2 allein: 6 Minuten vorher
  });

  it('ohne Anstoßzeit gibt es keinen Vorlauf', () => {
    expect(imVorlauf([spiel({ kickoff: undefined })], 1, berlin(15, 28))).toBe(false);
  });

  it('der Anstoß hängt am Turnierdatum: dieselbe Uhrzeit am Vortag zählt nicht', () => {
    const vortag = Date.UTC(2026, 11, 4, 14, 28);
    expect(imVorlauf([spiel()], 1, vortag)).toBe(false);
  });

  it('die Uhr ist die Turnier-Ortszeit, unabhängig von der Gerätezeit: 15:25 Berlin = 14:25 UTC', () => {
    expect(imVorlauf([spiel()], 1, Date.UTC(2026, 11, 5, 14, 25))).toBe(true);
    expect(imVorlauf([spiel()], 1, Date.UTC(2026, 11, 5, 14, 24, 59))).toBe(false);
  });
});

describe('minutesBetween', () => {
  it('rechnet über Mitternacht und negativ', () => {
    expect(minutesBetween({ date: '2026-12-05', time: '23:50' }, { date: '2026-12-06', time: '00:10' })).toBe(20);
    expect(minutesBetween({ date: '2026-12-05', time: '16:10' }, { date: '2026-12-05', time: '16:15' })).toBe(5);
    expect(minutesBetween({ date: '2026-12-05', time: '16:15' }, { date: '2026-12-05', time: '16:10' })).toBe(-5);
  });
});
