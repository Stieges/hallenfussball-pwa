/**
 * A-12a (Review S3): Der Lesepfad von `generateFullSchedule` (gespeicherte Spiele, Finalrunde fehlt) fängt nur
 * Vorlagen- und Prüffehler (`FinalsTemplateError`, `FinalsPlanInvalidError`). Ein Programmfehler beim Erzeugen bleibt
 * sichtbar und wird nicht als „keine Finalrunde“ verschluckt. Der Planer der Finalrunde ist dafür gezielt gestört.
 */
import { describe, expect, it, vi } from 'vitest';

const stoerung = vi.hoisted(() => ({ aktiv: false }));
vi.mock('../playoffScheduler', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../playoffScheduler')>();
  return {
    ...mod,
    generatePlayoffSchedule: (...args: Parameters<typeof mod.generatePlayoffSchedule>) => {
      if (stoerung.aktiv) { throw new TypeError('Programmfehler im Planer'); }
      return mod.generatePlayoffSchedule(...args);
    },
  };
});

import { generateFullSchedule } from '../scheduleGenerator';
import { createMockTeams, createMockTournament } from '../../../test/factories';
import type { Tournament } from '../../../types/tournament';

/** Gespeichertes Turnier (2 × 4, „Top 4“) nur mit Gruppenspielen. */
function storedGroupOnly(): Tournament {
  const base = createMockTournament({
    teams: createMockTeams(8, 2), numberOfTeams: 8, numberOfGroups: 2, groupSystem: 'groupsAndFinals',
    finalsConfig: { preset: 'top-4' },
  });
  const groupOnly = generateFullSchedule({ ...base, finalsConfig: { preset: 'none' } });
  return {
    ...base,
    matches: groupOnly.allMatches.map((m, i) => ({
      id: m.id, round: i + 1, field: m.field, slot: m.slot, slotA: m.slotA, slotB: m.slotB, group: m.group,
      isFinal: false, phase: 'groupStage', matchNumber: m.matchNumber, scheduledTime: m.startTime,
    })),
  };
}

describe('A-12a Lesepfad fängt nur Vorlagen- und Prüffehler', () => {
  it('A-12a Programmfehler beim Nachträglich-Erzeugen der Finalrunde bleibt sichtbar (kein stilles „keine Finalrunde“)', () => {
    const stored = storedGroupOnly();
    stoerung.aktiv = true;
    try {
      expect(() => generateFullSchedule(stored)).toThrow(TypeError);
    } finally {
      stoerung.aktiv = false;
    }
  });

  it('A-12a Gegenbeispiel: ohne Störung erzeugt derselbe Lesepfad die fehlende Finalrunde', () => {
    const schedule = generateFullSchedule(storedGroupOnly());
    expect(schedule.allMatches.filter((m) => m.phase !== 'groupStage')).toHaveLength(4);
  });
});
