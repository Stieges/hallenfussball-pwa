/**
 * C3b-2 F3b1 Fixrunde, Aufgabe 6: `exportStatisticsToPDF` hatte bisher kein Testharness (kein
 * `pdfStatisticsExporter*.test.ts` im Repo). `jspdf-autotable` (und `jspdf`) werden gemockt, damit
 * ohne echtes PDF-Rendering geprueft werden kann: die Fair-Play-Kopfzeile enthaelt KEINE Ziffern
 * mehr (F3b1: keine festen Punktwerte im Code/UI), und die Spalte "Gelb-Rot" ist vorhanden und
 * zeigt `f.yellowRedCards`.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Tournament } from '../../types/tournament';

interface AutoTableCallArgs {
  head?: string[][];
  body?: string[][];
}

const autoTableMock = vi.fn((doc: { lastAutoTable?: { finalY: number } }, _opts: AutoTableCallArgs) => {
  // jspdf-autotable setzt `lastAutoTable` dynamisch auf die Doc-Instanz (Export liest das danach).
  doc.lastAutoTable = { finalY: 100 };
});

vi.mock('jspdf-autotable', () => ({
  default: (doc: { lastAutoTable?: { finalY: number } }, opts: AutoTableCallArgs) => autoTableMock(doc, opts),
}));

// vi.mock-Factories werden gehoisted (vor allen Top-Level-Imports ausgefuehrt) -- die Mock-Klasse
// muss deshalb INNERHALB der Factory deklariert sein, sonst "Cannot access before initialization".
vi.mock('jspdf', () => {
  class MockJsPDF {
    lastAutoTable?: { finalY: number };
    setFont = vi.fn().mockReturnThis();
    setFontSize = vi.fn().mockReturnThis();
    setTextColor = vi.fn().mockReturnThis();
    text = vi.fn().mockReturnThis();
    addPage = vi.fn().mockReturnThis();
    save = vi.fn();
  }
  return { default: MockJsPDF };
});

// Import NACH den vi.mock-Aufrufen (Hoisting durch vitest ist zwar garantiert, aber explizit
// nach den Mocks platziert fuer Lesbarkeit).
import { exportStatisticsToPDF } from '../pdfStatisticsExporter';

function tournamentWithYellowRed(): Tournament {
  return {
    id: 'tour-pdf',
    title: 'PDF-Test-Turnier',
    date: '2024-01-01',
    timeSlot: '10:00',
    location: { name: 'Test Location' },
    ageClass: 'U15',
    sport: 'football',
    tournamentType: 'classic',
    mode: 'classic',
    numberOfTeams: 2,
    numberOfFields: 1,
    groupSystem: 'roundRobin',
    groupPhaseGameDuration: 10,
    teams: [
      { id: 'teamA', name: 'FC Alpha' },
      { id: 'teamB', name: 'SV Beta' },
    ],
    matches: [
      {
        id: 'm',
        round: 1,
        field: 1,
        teamA: 'teamA',
        teamB: 'teamB',
        events: [
          {
            id: 'yr1',
            matchId: 'm',
            timestampSeconds: 10,
            type: 'RED_CARD',
            payload: { teamId: 'teamA', playerNumber: 4, cardType: 'YELLOW_RED' },
            scoreAfter: { home: 0, away: 0 },
          },
        ],
      },
    ],
    pointSystem: { win: 3, draw: 1, loss: 0 },
    placementLogic: [
      { id: 'points', label: 'Punkte', enabled: true },
      { id: 'goalDifference', label: 'Tordifferenz', enabled: true },
      { id: 'goalsFor', label: 'Tore', enabled: true },
      { id: 'directComparison', label: 'Direkter Vergleich', enabled: true },
    ],
    finals: { final: false, thirdPlace: false, fifthSixth: false, seventhEighth: false },
    isKidsTournament: false,
    hideScoresForPublic: false,
    hideRankingsForPublic: false,
    resultMode: 'goals',
    status: 'published',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  } as unknown as Tournament;
}

/** Findet unter den autoTable-Aufrufen den fuer die Fair-Play-Tabelle (head enthaelt 'Gelb-Rot' – eindeutig, 'Team' steht auch bei den Torschuetzen). */
function findFairPlayCall(): AutoTableCallArgs {
  const call = autoTableMock.mock.calls.find(([, opts]) => opts?.head?.[0]?.includes('Gelb-Rot'));
  if (!call) { throw new Error('Fair-Play autoTable-Aufruf nicht gefunden'); }
  return call[1];
}

describe('exportStatisticsToPDF (Fair-Play-Tabelle, F3b1 Fixrunde Aufgabe 6)', () => {
  beforeEach(() => {
    autoTableMock.mockClear();
  });

  it('Kopfzeile der Fair-Play-Tabelle enthaelt keine Ziffern (keine festen Punktwerte)', async () => {
    await exportStatisticsToPDF(tournamentWithYellowRed());
    const { head } = findFairPlayCall();
    const headerText = (head?.[0] ?? []).join(' ');
    expect(headerText).not.toMatch(/\d/);
  });

  it('Spalte "Gelb-Rot" ist vorhanden und zeigt f.yellowRedCards', async () => {
    await exportStatisticsToPDF(tournamentWithYellowRed());
    const { head, body } = findFairPlayCall();
    const colIndex = head?.[0]?.indexOf('Gelb-Rot') ?? -1;
    expect(colIndex).toBeGreaterThanOrEqual(0);

    const row = body?.find((r) => r.includes('FC Alpha'));
    expect(row?.[colIndex]).toBe('1');
  });
});
