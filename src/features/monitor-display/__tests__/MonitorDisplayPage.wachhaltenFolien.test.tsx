/**
 * Wachhalten-Hinweis nach Folientyp und Verschiebung der Folie (B-48a Fixrunde 4, @ME-006).
 * Gherkin: Der Hinweis steht nur auf der Einrichtungs- und der QR-Folie, wenn auf dem Feld kein Spiel läuft. Auf Spielplan-,
 * Tabellen- und Live-Folien nie. Solange er steht, rückt der Inhalt der Folie um seine Höhe nach unten (verdeckt nichts).
 * Fassung 17.10. (Fixrunde 5): Hinweis auf den Ersatzfolien bei leerem Programm (öffentlich QR, sonst Spielplan) und auf einer QR-Folie
 * des Programms; nicht auf Text-, Spielplan-, Tabellen-, Sponsor-, Live-Folien des Programms.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen } from '@testing-library/react';
import type { Tournament } from '../../../types/tournament';
import { attachMonitor, buildTournament, FIXTURE_SPONSOR, slide, withMonitor } from './monitorFixture';
import { displayLayout } from '../../../design-tokens';
import {
  HINWEIS,
  wakeLockFehlt,
  wakeLockAbgelehnt,
  vorspulen,
  seite,
  hinweis,
} from './wachhaltenFixture';

const { supabaseGet, localGet } = vi.hoisted(() => ({ supabaseGet: vi.fn(), localGet: vi.fn() }));

vi.mock('../../../lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: { from: vi.fn(() => ({ upsert: vi.fn().mockResolvedValue({}) })), rpc: vi.fn().mockResolvedValue({ error: null }) },
}));
vi.mock('../../../core/repositories/SupabaseRepository', () => ({
  SupabaseRepository: vi.fn(function SupabaseRepository() { return { get: supabaseGet }; }),
}));
vi.mock('../../../core/repositories/LocalStorageRepository', () => ({
  LocalStorageRepository: vi.fn(function LocalStorageRepository() { return { get: localGet }; }),
}));
vi.mock('qrcode.react', async () => {
  const React = await import('react');
  return { QRCodeSVG: ({ value }: { value: string }) => React.createElement('svg', { 'data-testid': 'qr-code', 'data-value': value }) };
});
vi.mock('../../../hooks/useLiveMatches', () => ({
  useLiveMatches: () => ({
    liveMatches: new Map(), runningMatches: [], pausedMatches: [], runningMatchIds: new Set<string>(),
    getMatchById: () => undefined, lastGoalEvent: null, clearLastGoalEvent: vi.fn(),
    lastCardEvent: null, clearLastCardEvent: vi.fn(), calculateElapsedSeconds: () => 0,
  }),
}));

type Folie = ReturnType<typeof slide>;
const turnier = (folien: Folie[], overscanPercent?: number, flags: Partial<Tournament> = {}) => attachMonitor(
  buildTournament({ sponsors: [FIXTURE_SPONSOR], ...flags }),
  withMonitor({ slides: folien, ...(overscanPercent !== undefined ? { overscanPercent } : {}) }),
);

type Fall = readonly [string, Folie[], Partial<Tournament>?];
const voll = (faelle: ReadonlyArray<Fall>): Array<[string, Folie[], Partial<Tournament>]> => faelle.map(([n, f, fl]) => [n, f, fl ?? {}]);
// @ME-006: Ersatzfolien, solange kein Folienprogramm eingerichtet ist (öffentlich: QR, sonst Spielplan), und QR aus dem Programm
const MIT_HINWEIS: ReadonlyArray<Fall> = [
  ['Ersatz-Spielplan (leeres Programm, nicht öffentlich)', [], { isPublic: false }],
  ['Ersatz-Spielplan (leeres Programm, ohne Share-Code)', [], { shareCode: undefined }],
  ['Ersatz-QR (leeres Programm, öffentlich)', []],
  ['QR aus dem Programm', [slide('qr-code', {}, 60)]],
];
const OHNE_HINWEIS: ReadonlyArray<Fall> = [
  ['Textfolie (Ankündigung)', [slide('custom-text', { headline: 'Willkommen' }, 60)]],
  ['Spielplan aus dem Programm', [slide('schedule-field', { fieldId: 'field-1' }, 60)], { isPublic: false }],
  ['Spielplan Feld', [slide('schedule-field', { fieldId: 'field-1' }, 60)]],
  ['Tabelle', [slide('standings', { groupId: 'A' }, 60)]],
  ['Alle Tabellen', [slide('all-standings', {}, 60)]],
  ['Nächste Spiele', [slide('next-matches', { matchCount: 3 }, 60)]],
  ['Sponsor', [slide('sponsor', { sponsorId: 'sp-1', showQrCode: true }, 60)]],
  // Programm eingerichtet, aber nichts darstellbar: die Ersatzfolie ist kein „leeres Programm“ (@ME-006)
  ['Ersatz-QR, Programm nur mit Tabelle bei ausgeblendeten Ergebnissen', [slide('standings', { groupId: 'A' }, 60)], { hideScoresForPublic: true }],
  ['Ersatz-Spielplan, Programm nur mit QR im nicht öffentlichen Turnier', [slide('qr-code', {}, 60)], { isPublic: false }],
  // Live-Folie ohne Spiel zeigt den Rückfall, aber ein Programm ist eingerichtet
  ['Live ohne Spiel (Feld 2, Programm eingerichtet)', [slide('live', { fieldId: 'field-2' }, 60)]],
  ['Live mit Spiel (Feld 1)', [slide('live', { fieldId: 'field-1' }, 60)]],
];

/** Wurzel der Folie: das Element, das den Bildrand als Innenabstand trägt. */
const folienWurzel = () => screen.getByTestId('monitor-slide').firstElementChild as HTMLElement;

beforeEach(() => {
  vi.clearAllMocks();
  supabaseGet.mockResolvedValue(null);
  wakeLockAbgelehnt();
  window.history.replaceState(null, '', '/#/display/tour-1/mon-1');
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
});

afterEach(() => {
  vi.useRealTimers();
  wakeLockFehlt();
});

describe('Hinweis nur auf Ersatz- und QR-Folie (@ME-006)', () => {
  it.each(voll(MIT_HINWEIS))('Folie „%s“: der Hinweis steht 10 Sekunden in einer Zeile', async (_name, folien, flags) => {
    localGet.mockResolvedValue(turnier([...folien], undefined, flags));
    seite();
    await vorspulen(0);
    expect(hinweis()).toHaveTextContent(HINWEIS);
    expect(hinweis()?.style.whiteSpace).toBe('nowrap');
    await vorspulen(9_999);
    expect(hinweis()).toBeInTheDocument();
    await vorspulen(1);
    expect(hinweis()).not.toBeInTheDocument();
  });

  it.each(voll(OHNE_HINWEIS))('Gegenbeispiel, Folie „%s“: kein Hinweis, von Sekunde 0 bis nach Ablauf der 10 Sekunden', async (_name, folien, flags) => {
    localGet.mockResolvedValue(turnier([...folien], undefined, flags));
    seite();
    await vorspulen(0);
    expect(hinweis()).not.toBeInTheDocument();
    for (let s = 1; s <= 11; s += 1) {
      await vorspulen(1_000);
      expect(hinweis(), `nach ${s} s`).not.toBeInTheDocument();
    }
  });

  it('Wechsel von der QR- auf die Tabellen-Folie innerhalb der 10 Sekunden nimmt den Hinweis weg', async () => {
    localGet.mockResolvedValue(turnier([slide('qr-code', {}, 4), slide('standings', { groupId: 'A' }, 60)]));
    seite();
    await vorspulen(0);
    expect(hinweis()).toBeInTheDocument();
    await vorspulen(4_000);
    expect(screen.queryByTestId('qr-code')).not.toBeInTheDocument();
    expect(hinweis()).not.toBeInTheDocument();
  });

  it('Wechsel von der Tabellen- auf die QR-Folie innerhalb der 10 Sekunden zeigt den Rest der 10 Sekunden', async () => {
    localGet.mockResolvedValue(turnier([slide('standings', { groupId: 'A' }, 4), slide('qr-code', {}, 60)]));
    seite();
    await vorspulen(0);
    expect(hinweis()).not.toBeInTheDocument();
    await vorspulen(4_000);
    expect(hinweis()).toBeInTheDocument();
    await vorspulen(6_000);
    expect(hinweis()).not.toBeInTheDocument();
  });
});

describe('Folie rückt um die Höhe des Hinweises nach unten (@ME-006)', () => {
  /** So, wie jsdom den Wert im Stil ausgibt (es vereinfacht calc). */
  const alsStil = (eigenschaft: 'height' | 'paddingTop', wert: string): string => {
    const el = document.createElement('div');
    el.style[eigenschaft] = wert;
    return el.style[eigenschaft];
  };
  const hoehe = alsStil('height', displayLayout.noticeHeight);
  const oben = (rand: number) => alsStil('paddingTop', `calc(${rand}cqh + ${displayLayout.noticeHeight})`);

  it.each(voll(MIT_HINWEIS))('Folie „%s“: solange der Hinweis steht, beginnt der Inhalt um seine Höhe tiefer, danach wieder am Rand', async (_name, folien, flags) => {
    localGet.mockResolvedValue(turnier([...folien], undefined, flags));
    seite();
    await vorspulen(0);
    expect(hinweis()?.style.height).toBe(hoehe);
    expect(folienWurzel().style.paddingTop).toBe(oben(5));
    await vorspulen(10_000);
    expect(folienWurzel().style.paddingTop).toBe('5cqh');
  });

  it('mit Bildrand 0 % beginnt der Inhalt genau unter dem Hinweis', async () => {
    localGet.mockResolvedValue(turnier([], 0));
    seite();
    await vorspulen(0);
    expect(folienWurzel().style.paddingTop).toBe(oben(0));
  });

  it.each(voll(OHNE_HINWEIS))('Gegenbeispiel, Folie „%s“: keine Verschiebung', async (_name, folien, flags) => {
    localGet.mockResolvedValue(turnier([...folien], undefined, flags));
    seite();
    await vorspulen(0);
    expect(folienWurzel().style.paddingTop).toBe('5cqh');
  });

  it('der Hinweis sitzt oben rechts im sicheren Bereich, ohne eigenen zweiten Rand', async () => {
    localGet.mockResolvedValue(turnier([]));
    seite();
    await vorspulen(0);
    expect(hinweis()?.style.position).toBe('absolute');
    expect(hinweis()?.style.top).toBe('0px');
    expect(hinweis()?.style.right).toBe('0px');
    expect(hinweis()?.parentElement?.style.top).toBe('5cqh');
    expect(hinweis()?.parentElement?.style.right).toBe('5cqw');
  });
});
