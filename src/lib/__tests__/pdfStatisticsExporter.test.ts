/**
 * C3b-2 F3b1 Fixrunde, Aufgabe 6: `exportStatisticsToPDF` hatte bisher kein Testharness (kein
 * `pdfStatisticsExporter*.test.ts` im Repo). `jspdf-autotable` (und `jspdf`) werden gemockt, damit
 * ohne echtes PDF-Rendering geprueft werden kann: die Fair-Play-Kopfzeile enthaelt KEINE Ziffern
 * mehr (F3b1: keine festen Punktwerte im Code/UI), und die Spalte "Gelb-Rot" ist vorhanden und
 * zeigt `f.yellowRedCards`.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Tournament } from '../../types/tournament';

type Rgb = [number, number, number];
interface ZelleFuerHaken { section: string; column: { index: number }; cell: { x: number; y: number; width: number; height: number; text: string[]; styles: { fillColor?: Rgb; textColor?: Rgb; fontStyle?: string; fontSize?: number }; padding: (r: string) => number } }
interface AutoTableCallArgs {
  head?: string[][];
  body?: string[][];
  didParseCell?: (data: ZelleFuerHaken) => void;
  didDrawCell?: (data: ZelleFuerHaken) => void;
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
    setFillColor = vi.fn().mockReturnThis();
    triangle = vi.fn().mockReturnThis();
    rect = vi.fn().mockReturnThis();
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
import { hexToRgb } from '../colorUtils';
import { resolveToken } from '../../test/contrast';

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

/** RGB aus dem aufgelösten Token (global.css), nie aus einer zweiten Zahl im Test. */
function tokenRgb(token: string): Rgb {
  const { r, g, b } = hexToRgb(resolveToken('light', token));
  return [r, g, b];
}

function zelle(index: number, section = 'head'): ZelleFuerHaken {
  return { section, column: { index }, cell: { x: 10, y: 20, width: 20, height: 8, text: ['x'], styles: {}, padding: () => 2 } };
}

describe('Karten-Farben nur für Karten (Oberfläche E) – PDF Fair-Play-Tabelle', () => {
  beforeEach(() => {
    autoTableMock.mockClear();
  });

  it('Kopfzelle Gelb nutzt RGB aus cardYellow, Kopfzelle Rot RGB aus cardRed', async () => {
    await exportStatisticsToPDF(tournamentWithYellowRed());
    const opts = findFairPlayCall();
    const head = opts.head?.[0] ?? [];
    const gelb = zelle(head.indexOf('Gelb'));
    const rot = zelle(head.indexOf('Rot'));
    opts.didParseCell?.(gelb);
    opts.didParseCell?.(rot);
    expect(gelb.cell.styles.fillColor).toEqual(tokenRgb('var(--color-card-yellow)'));
    expect(rot.cell.styles.fillColor).toEqual(tokenRgb('var(--color-card-red)'));
  });

  it('Kopfzelle Gelb-Rot zeigt beide Farben: Gelb als Fläche, Rot als Dreieck', async () => {
    await exportStatisticsToPDF(tournamentWithYellowRed());
    const opts = findFairPlayCall();
    const idx = (opts.head?.[0] ?? []).indexOf('Gelb-Rot');
    const z = zelle(idx);
    opts.didParseCell?.(z);
    expect(z.cell.styles.fillColor).toEqual(tokenRgb('var(--color-card-yellow)'));
    const doc = autoTableMock.mock.calls[0][0] as unknown as { setFillColor: ReturnType<typeof vi.fn>; triangle: ReturnType<typeof vi.fn> };
    opts.didDrawCell?.(z);
    expect(doc.setFillColor).toHaveBeenCalledWith(...tokenRgb('var(--color-card-red)'));
    expect(doc.triangle).toHaveBeenCalled();
  });

  it('Gegenbeispiel: andere Kopfzellen (Team, Punkte, Zeit) und Körperzellen bleiben ohne Kartenfarbe', async () => {
    await exportStatisticsToPDF(tournamentWithYellowRed());
    const opts = findFairPlayCall();
    const head = opts.head?.[0] ?? [];
    for (const name of ['Team', 'Punkte', 'Zeit']) {
      const z = zelle(head.indexOf(name));
      opts.didParseCell?.(z);
      expect(z.cell.styles.fillColor).toBeUndefined();
    }
    const koerper = zelle(head.indexOf('Gelb'), 'body');
    opts.didParseCell?.(koerper);
    expect(koerper.cell.styles.fillColor).toBeUndefined();
  });

  it('Schrift auf Kartengelb ist dunkel, auf Kartenrot hell (lesbar)', async () => {
    await exportStatisticsToPDF(tournamentWithYellowRed());
    const opts = findFairPlayCall();
    const head = opts.head?.[0] ?? [];
    const gelb = zelle(head.indexOf('Gelb'));
    const rot = zelle(head.indexOf('Rot'));
    opts.didParseCell?.(gelb);
    opts.didParseCell?.(rot);
    expect(gelb.cell.styles.textColor).toEqual([0, 0, 0]);
    expect(rot.cell.styles.textColor).toEqual([255, 255, 255]);
  });
});
