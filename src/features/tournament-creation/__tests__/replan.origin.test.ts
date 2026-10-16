/**
 * A-36a (Brief Schritt 2, Ruling R-A36a-3): Neuplanung und Herkunft des Platzes.
 *
 * Ein behaltenes Spiel behält seine Herkunft (`kept.originA/B`), auch wenn der Generator für dasselbe
 * Spiel eine neue Herkunft mit neuen Vorgänger-IDs erzeugt. Ein neu erzeugtes Spiel bekommt die Herkunft
 * aus dem Generator. Grundlage für „Spielplan auf Anfang“ (@SA-011: Rücksetzen aus `origin_x`).
 */
import { describe, it, expect } from 'vitest';
import type { Match, Tournament } from '../../../types/tournament';
import { generateFullSchedule } from '../../../core/generators';
import { buildReplanPreview, applyReplan } from '../utils/replan';
import { testUuid } from '../../../test/testIds';

const hallencup = (): Tournament =>
  ({
    id: 't-origin',
    title: 'Hallencup Nord',
    sport: 'football',
    tournamentType: 'classic',
    mode: 'classic',
    groupSystem: 'groupsAndFinals',
    finalsConfig: { preset: 'top-4' },
    date: '2030-01-01',
    timeSlot: '09:00',
    startDate: '2030-01-01',
    startTime: '09:00',
    numberOfTeams: 8,
    numberOfFields: 2,
    numberOfGroups: 2,
    groupPhaseGameDuration: 10,
    groupPhaseBreakDuration: 2,
    finalRoundGameDuration: 10,
    finalRoundBreakDuration: 2,
    breakBetweenPhases: 0,
    placementLogic: [],
    teams: [
      ...[1, 2, 3, 4].map((n) => ({ id: testUuid(n), name: `FC Nord A${n}`, group: 'A' })),
      ...[1, 2, 3, 4].map((n) => ({ id: testUuid(10 + n), name: `SV Süd B${n}`, group: 'B' })),
    ],
    matches: [],
    status: 'published',
    publishedAt: '2026-10-04T08:00:00Z',
    hideScoresForPublic: false,
    hideRankingsForPublic: false,
    pointSystem: { win: 3, draw: 1, loss: 0 },
    createdAt: '2026-10-04T08:00:00Z',
    updatedAt: '2026-10-04T08:00:00Z',
  }) as unknown as Tournament;

/** Bestehender Plan wie nach dem Veröffentlichen: Spiele mit Slots UND Herkunft des Platzes. */
function established(): Tournament {
  const t = hallencup();
  const matches: Match[] = generateFullSchedule(t).allMatches.map((m, index) => ({
    id: m.id,
    round: index + 1,
    field: m.field,
    slotA: m.slotA,
    slotB: m.slotB,
    ...(m.originA && { originA: m.originA }),
    ...(m.originB && { originB: m.originB }),
    isFinal: m.phase !== 'groupStage',
    phase: m.phase,
    finalType: m.finalType,
    label: m.label,
  }));
  return { ...t, matches };
}

function finalOf(t: Tournament): Match {
  const final = t.matches.find((m) => m.finalType === 'final');
  if (!final?.originA) {
    throw new Error('Finale mit Herkunft fehlt');
  }
  return final;
}

describe('A-36a Neuplanung: Herkunft des Platzes', () => {
  it('@SA-011 behaltenes Finalspiel (ausgefallen, Plätze offen): Vorschau und Ergebnis behalten kept.originA', () => {
    const before = established();
    const final = finalOf(before);
    const skipped: Match = { ...final, matchStatus: 'skipped' };
    const withSkipped: Tournament = { ...before, matches: before.matches.map((m) => (m.id === final.id ? skipped : m)) };

    const preview = buildReplanPreview(withSkipped);
    expect(preview.status).toBe('preview');
    if (preview.status !== 'preview') { return; }

    const inPreview = preview.schedule.allMatches.find((m) => m.id === final.id);
    expect(inPreview?.originA).toEqual(final.originA);
    expect(inPreview?.originB).toEqual(final.originB);

    const after = applyReplan(withSkipped, preview);
    expect(after.matches.find((m) => m.id === final.id)?.originA).toEqual(final.originA);
  });

  it('@SA-011 neu erzeugte Finalrunden-Spiele bekommen die Herkunft aus dem Generator', () => {
    const before = established();
    const preview = buildReplanPreview(before);
    if (preview.status !== 'preview') { throw new Error('keine Vorschau'); }

    const after = applyReplan(before, preview);
    const finals = after.matches.filter((m) => m.isFinal);
    expect(finals.length).toBe(4);
    for (const m of finals) {
      expect(m.originA, `Spiel ${m.id}`).toBeDefined();
      expect(m.slotA.kind === 'pending' ? m.slotA.source : undefined).toEqual(m.originA);
      expect(m.slotB.kind === 'pending' ? m.slotB.source : undefined).toEqual(m.originB);
    }
  });

  it('Gegenbeispiel: Gruppenspiele bleiben nach der Neuplanung ohne Herkunft des Platzes', () => {
    const before = established();
    const preview = buildReplanPreview(before);
    if (preview.status !== 'preview') { throw new Error('keine Vorschau'); }

    for (const m of applyReplan(before, preview).matches.filter((x) => !x.isFinal)) {
      expect('originA' in m).toBe(false);
      expect('originB' in m).toBe(false);
    }
  });
});
