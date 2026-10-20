/**
 * A-12a Impact der Phase je Spiel (Plan GA4 v2 Auflage 15, Gegenbeispiel Impact): Halbfinale tragen jetzt
 * `phase: 'semifinal'` (C-FINALPHASE-AUS-ID). Kein Leser darf die Finalrunde deshalb auseinanderreißen:
 * Spielplan-Abschnitte (Admin-Spielplan, Public View), PDF und Monitor zeigen sie als EINEN Block in der Reihenfolge
 * HF1, HF2, Platz 3, Finale. Dazu: Lesepfade bleiben tolerant, wenn eine gespeicherte Finalrunde fehlt und die
 * Vorlage nicht erzeugbar ist (kein Absturz in Public View, Export, Turnier-Manager).
 */
import { describe, expect, it, vi } from 'vitest';
import { generateFullSchedule } from '../../../core/generators';
import { TournamentCreationService } from '../../../core/services/TournamentCreationService';
import type { ITournamentRepository } from '../../../core/repositories/ITournamentRepository';
import { buildTournamentView } from '../../../core/view';
import { finalRoundMatches } from '../../../features/monitor-display/slideContent';
import { HALLENCUP_TEAMS, hallencupTournament } from './pdfFixture';
import { flatText, renderSchedulePdf } from './pdfText';
import type { Tournament } from '../../../types/tournament';

vi.mock('jspdf', async (importOriginal) => {
  const mod = await importOriginal<typeof import('jspdf')>();
  const { capturingJsPdf } = await import('./pdfCapture');
  return { ...mod, default: capturingJsPdf(mod.default), jsPDF: capturingJsPdf(mod.jsPDF) };
});

const ORDER = ['1. Halbfinale', '2. Halbfinale', 'Spiel um Platz 3', 'Finale'];

async function published(): Promise<Tournament> {
  const repository = { save: vi.fn(() => Promise.resolve()) } as unknown as ITournamentRepository;
  // publish() erzeugt einen Share-Code über window.crypto (utils/shareCode.ts); danach wieder ohne window (PDF-Weg).
  vi.stubGlobal('window', { crypto: globalThis.crypto });
  try {
    return await new TournamentCreationService(repository).publish({ ...hallencupTournament(), id: undefined, publishedAt: undefined });
  } finally {
    vi.unstubAllGlobals();
  }
}

describe('A-12a Gegenbeispiel Impact: Halbfinale in Phase semifinal reißen die Finalrunde nicht auseinander', () => {
  it('A-12a Spielplan-Abschnitte (Admin-Spielplan, Public View): genau ein Abschnitt Finalrunde, HF1, HF2, Platz 3, Finale', () => {
    const schedule = generateFullSchedule(hallencupTournament());

    expect(schedule.allMatches.filter((m) => m.phase === 'semifinal')).toHaveLength(2);
    expect(schedule.phases.map((p) => p.name)).toEqual(['groupStage', 'final']);
    expect(schedule.phases[1].matches.map((m) => m.label)).toEqual(ORDER);
  });

  it('A-12a dasselbe nach dem Speichern und erneuten Laden (gespeicherte Phase, Zweig „vorhandene Spiele“)', async () => {
    const tournament = await published();
    const schedule = generateFullSchedule(tournament);

    expect(tournament.matches.filter((m) => m.phase === 'semifinal').map((m) => m.label)).toEqual(ORDER.slice(0, 2));
    expect(schedule.phases.map((p) => p.name)).toEqual(['groupStage', 'final']);
    expect(schedule.phases[1].matches.map((m) => m.label)).toEqual(ORDER);
  });

  it('A-12a PDF: die Finalrunde steht als ein Block in der Reihenfolge HF1, HF2, Platz 3, Finale', async () => {
    const schedule = generateFullSchedule(hallencupTournament(), 'de');
    const finals = schedule.allMatches.filter((m) => m.phase !== 'groupStage');
    const text = flatText(await renderSchedulePdf(schedule, undefined, {}));
    // Zeilen der Finalrunde: Spielnummer gefolgt von der Uhrzeit (rowFrom-Muster), in Textreihenfolge
    const rowAt = (number: number, time: string) => text.findIndex((t, i) => t === String(number) && text[i + 1] === time);
    const rows = finals.map((m) => rowAt(m.matchNumber, m.time));
    const heading = (title: string) => text.findIndex((t) => t === title || t.endsWith(` ${title}`));

    expect(finals.map((m) => m.label)).toEqual(ORDER);
    expect(rows.every((p) => p >= 0)).toBe(true);
    expect([...rows].sort((a, b) => a - b)).toEqual(rows);
    // ein Block: Halbfinale, dann Spiel um Platz 3, dann Finale – keine Zeile springt in einen anderen Abschnitt
    expect(heading('Halbfinale')).toBeLessThan(rows[0]);
    expect(rows[1]).toBeLessThan(heading('Spiel um Platz 3'));
    expect(heading('Spiel um Platz 3')).toBeLessThan(rows[2]);
    expect(rows[2]).toBeLessThan(text.lastIndexOf('Finale'));
    expect(text.lastIndexOf('Finale')).toBeLessThan(rows[3]);
  });

  it('A-12a Monitor: Halbfinale gehören zur Finalrunde (Folie „Finalrunde“, Pokal/Ring), Reihenfolge HF1, HF2, Platz 3, Finale', async () => {
    const tournament = await published();
    const view = buildTournamentView(tournament, { audience: 'screen', medium: 'app', locale: 'de' });

    const idsInOrder = ORDER.map((label) => tournament.matches.find((m) => m.label === label)?.id);

    expect(idsInOrder.every((id) => id !== undefined)).toBe(true);
    expect(finalRoundMatches(view).map((m) => m.id)).toEqual(idsInOrder);
  });
});

describe('A-12a Lesepfade bleiben tolerant (Prüfung nur beim Erzeugen/Anlegen)', () => {
  /** Gespeichertes Turnier nur mit Gruppenspielen (Finalrunde fehlt in den Daten), Vorlage ab 3 Gruppen nicht erzeugbar. */
  function storedWithoutFinals(overrides: Partial<Tournament>): Tournament {
    const base = hallencupTournament({ finalsConfig: { preset: 'top-4' }, ...overrides });
    const groupOnly = generateFullSchedule({ ...base, finalsConfig: { preset: 'none' } });
    return {
      ...base,
      matches: groupOnly.allMatches.map((m, i) => ({
        id: m.id, round: i + 1, field: m.field, slot: m.slot, slotA: m.slotA, slotB: m.slotB, group: m.group,
        isFinal: false, phase: 'groupStage', matchNumber: m.matchNumber, scheduledTime: m.startTime,
      })),
    };
  }

  it('A-12a 3 Gruppen gespeichert, Finalrunde fehlt: der Spielplan zeigt die gespeicherten Spiele statt abzustürzen', () => {
    const teams = HALLENCUP_TEAMS.map((t, i) => ({ ...t, group: ['A', 'B', 'C'][i % 3] }));
    const stored = storedWithoutFinals({ teams, numberOfGroups: 3 });

    const schedule = generateFullSchedule(stored);
    expect(schedule.allMatches.length).toBe(stored.matches.length);
    expect(schedule.phases.map((p) => p.name)).toEqual(['groupStage']);
  });

  it('A-12a Gruppenzahl fehlt im gespeicherten Turnier: kein Absturz, gespeicherte Spiele bleiben sichtbar', () => {
    const stored = storedWithoutFinals({ numberOfGroups: undefined });

    expect(() => generateFullSchedule(stored)).not.toThrow();
    expect(generateFullSchedule(stored).allMatches.length).toBe(stored.matches.length);
  });

  it('A-12a Gegenbeispiel: dasselbe Turnier OHNE gespeicherte Spiele (Anlegen) meldet den Fehler sichtbar', () => {
    const teams = HALLENCUP_TEAMS.map((t, i) => ({ ...t, group: ['A', 'B', 'C'][i % 3] }));
    expect(() => generateFullSchedule(hallencupTournament({ teams, numberOfGroups: 3 }))).toThrow(/nur für 1 oder 2 Gruppen/);
  });

  it('A-12a Gegenbeispiel: ein gespeichertes Turnier mit 2 Gruppen bekommt die fehlende Finalrunde weiterhin erzeugt', () => {
    const stored = storedWithoutFinals({});
    const schedule = generateFullSchedule(stored);

    expect(schedule.allMatches.filter((m) => m.phase !== 'groupStage').map((m) => m.label)).toEqual(ORDER);
  });
});
