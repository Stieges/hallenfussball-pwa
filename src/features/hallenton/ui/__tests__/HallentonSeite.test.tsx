/**
 * H4-8 Unterpunkt „Hallenton“ (@HT-016, @HT-017, @HT-041, @HT-042, @HT-046): Erwartungen aus dem Gherkin, nicht am Code abgelesen.
 * Die Hooks sind Doppel (Stand am Server, Gerät); Texte aus den echten deutschen Sprachdateien.
 */
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import de from '../../../../i18n/locales/de/hallenton.json';
import tournamentDe from '../../../../i18n/locales/de/tournament.json';
import type { HallStatusAntwort, HallStatusVoll } from '../../../../core/repositories/hallentonRpc';
import { lautsprecherLage, type LautsprecherLage } from '../../runtime/hallStatusAuswertung';
import type { HallLautsprecher } from '../../useHallLautsprecher';
import type { HallStatus } from '../../useHallStatus';

vi.mock('react-i18next', () => ({
  useTranslation: (ns?: string) => ({
    i18n: { language: 'de' },
    t: (key: string, opts?: Record<string, unknown>) => {
      const quelle = ns === 'tournament' ? tournamentDe : de;
      const wert = key.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], quelle);
      const text = typeof wert === 'string' ? wert : `FEHLT:${key}`;
      return text.replace(/\{\{(\w+)\}\}/g, (_, n: string) => String(opts?.[n] ?? `{{${n}}}`));
    },
  }),
}));

const doppel = vi.hoisted(() => ({
  darf: true, abgeschlossen: false,
  status: null as unknown as HallStatus,
  lautsprecher: null as unknown as HallLautsprecher,
}));
vi.mock('../../../auth/hooks/useCan', () => ({ useCan: () => doppel.darf }));
vi.mock('../../../../hooks/useTournamentClosed', () => ({ useTournamentClosed: () => doppel.abgeschlossen }));
vi.mock('../../useHallStatus', () => ({ useHallStatus: () => doppel.status }));
vi.mock('../../useHallLautsprecher', () => ({ useHallLautsprecher: () => doppel.lautsprecher }));
vi.mock('../../useAngepfiffeneFelder', () => ({ useAngepfiffeneFelder: () => new Set<number>() }));
const laufendDoppel = vi.hoisted(() => ({ spiele: new Map<number, number>() }));
vi.mock('../../useLaufendeSpiele', () => ({ useLaufendeSpiele: () => laufendDoppel.spiele }));

import { HallentonSeite } from '../HallentonSeite';

const SERVER_JETZT = new Date(2026, 10, 13, 14, 2, 30).getTime();
const GESPIELT_1402 = new Date(2026, 10, 13, 14, 2, 0).getTime();

function voll(feld1: { state: string; ageMs: number | null; test?: { testId: string; playedAt: number | null } } | null): HallStatusVoll {
  return {
    sicht: 'voll', serverNow: SERVER_JETZT, closed: false, leads: [],
    settings: { halftimeSound: 'horn-1', halftimeCustomPath: null, endCustomPath: null, goalToneFields: [], goalAnthemPaths: [] },
    speakers: feld1 === null ? [] : [{
      field: 1, deviceName: 'Laptop Turnierleitung', isThisDevice: false, state: feld1.state as never, assignedAt: 1, outputHint: false, hintAt: null,
      lastSeen: null, ageMs: feld1.ageMs, test: feld1.test ? { testId: feld1.test.testId, requestedAt: 1, playedAt: feld1.test.playedAt } : null,
    }],
  };
}
const lageAus = (antwort: HallStatusAntwort): Record<number, LautsprecherLage> =>
  Object.fromEntries(antwort.speakers.map((s) => [s.field, lautsprecherLage({ state: s.state, ageMs: s.ageMs, outputHint: s.outputHint }, antwort.serverNow)]));
const statusAus = (antwort: HallStatusVoll | null, stand: HallStatus['stand'] = 'aktuell', testton = vi.fn()): HallStatus => ({
  stand, antwort: stand === 'aktuell' ? antwort : null, felder: stand === 'aktuell' && antwort ? lageAus(antwort) : {},
  // „ein Lautsprecher war in der Sitzung bekannt“ gilt je Turnier (useHallStatus); ohne Netz bleibt es erhalten (@HT-041)
  lautsprecherBekannt: stand === 'unbekannt' || (antwort !== null && antwort.speakers.length > 0), testtonAnfordern: testton, gehoert: vi.fn(),
});
const setzeStatus = (antwort: HallStatusVoll | null, stand: HallStatus['stand'] = 'aktuell', testton = vi.fn()): void => { doppel.status = statusAus(antwort, stand, testton); };
const anfordern = (): ReturnType<typeof vi.fn> => doppel.status.testtonAnfordern as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  doppel.darf = true; doppel.abgeschlossen = false;
  doppel.lautsprecher = { rolle: 'keiner', felder: [], name: null, laufzeit: null, abgeloest: null, anderesTurnier: null, hierAnhoeren: vi.fn(() => Promise.resolve(true)), lautstaerke: { abpfiff: 100, halbzeit: 100, tor: 100 }, stumm: false } as unknown as HallLautsprecher;
  setzeStatus(voll({ state: 'ready', ageMs: 3000 }));
});
afterEach(() => vi.useRealTimers());

const seite = () => <HallentonSeite tournamentId="t1" felderAnzahl={2} />;

describe('@HT-016 Feld ohne Hallen-Lautsprecher', () => {
  it('Feld 1 mit Lautsprecher, Feld 2 ohne → Feld 2 „kein Hallen-Lautsprecher“, ohne Warnung', () => {
    render(seite());
    expect(screen.getByTestId('lautsprecher-feld-2-zustand')).toHaveTextContent('kein Hallen-Lautsprecher');
    expect(screen.getByTestId('lautsprecher-feld-1-zustand')).toHaveTextContent('bereit');
    expect(screen.queryByTestId('hallenton-kein-netz')).toBeNull();
    expect(screen.queryByTestId('hallenton-felder-leer')).toBeNull();
  });
  it('kein Lautsprecher im Turnier → beide Felder neutral, ruhiger Satz „in Ordnung“, kein Testton-Knopf', () => {
    setzeStatus(voll(null));
    render(seite());
    expect(screen.getByTestId('hallenton-felder-leer')).toHaveTextContent('Das ist in Ordnung');
    expect(screen.queryByTestId('testton-halle-1')).toBeNull();
    expect(screen.getByTestId('testton-feld-2')).toHaveTextContent('kein Hallen-Lautsprecher, kein Testton');
  });
});

describe('@HT-041 die Verwaltung hat selbst kein Netz', () => {
  it('oben „Kein Netz – Status unbekannt“, bei Feld 1 „Status unbekannt“, „Testton in der Halle“ zeigt „Kein Testton: kein Netz“', () => {
    const { rerender } = render(seite());
    setzeStatus(null, 'unbekannt');
    rerender(seite());
    expect(screen.getByTestId('hallenton-kein-netz')).toHaveTextContent('Kein Netz – Status unbekannt');
    expect(screen.getByTestId('lautsprecher-feld-1-zustand')).toHaveTextContent('Status unbekannt');
    expect(screen.getByTestId('lautsprecher-feld-1-geraet')).toHaveTextContent('Laptop Turnierleitung');
    expect(screen.getByTestId('testton-feld-1-ergebnis')).toHaveTextContent('Kein Testton: kein Netz');
    fireEvent.click(screen.getByTestId('testton-halle-1'));
    expect(anfordern()).not.toHaveBeenCalled();
  });
  it('Gegenbeispiel: mit Netz kein Netz-Hinweis, kein „Status unbekannt“; wieder Netz → Stand vom Server', () => {
    const { rerender } = render(seite());
    setzeStatus(null, 'unbekannt');
    rerender(seite());
    setzeStatus(voll({ state: 'ready', ageMs: 2000 }));
    rerender(seite());
    expect(screen.queryByTestId('hallenton-kein-netz')).toBeNull();
    expect(screen.getByTestId('lautsprecher-feld-1-zustand')).toHaveTextContent('bereit');
  });
});

describe('@HT-017 „Hier anhören“ und „Testton in der Halle“', () => {
  it('bereit + „Hier anhören“ → spielt auf diesem Gerät, kein Auftrag an die Halle', () => {
    render(seite());
    fireEvent.click(screen.getByTestId('testton-hier-anhoeren'));
    expect(doppel.lautsprecher.hierAnhoeren).toHaveBeenCalledWith('abpfiff');
    expect(anfordern()).not.toHaveBeenCalled();
  });
  it('bereit + „Testton in der Halle“ → Auftrag für Feld 1; danach steht „gespielt 14:02“ (vom Server)', async () => {
    const testton = vi.fn(() => Promise.resolve({ ok: true, status: 'requested', testId: 'x1', requestedAt: 1, serverNow: SERVER_JETZT }));
    setzeStatus(voll({ state: 'ready', ageMs: 3000 }), 'aktuell', testton);
    const { rerender } = render(seite());
    await act(async () => { fireEvent.click(screen.getByTestId('testton-halle-1')); await Promise.resolve(); });
    expect(testton).toHaveBeenCalledWith(1);
    expect(screen.getByTestId('testton-feld-1-ergebnis')).not.toHaveTextContent('gespielt');
    setzeStatus(voll({ state: 'ready', ageMs: 3000, test: { testId: 'x1', playedAt: GESPIELT_1402 } }), 'aktuell', testton);
    rerender(seite());
    expect(screen.getByTestId('testton-feld-1-ergebnis')).toHaveTextContent('gespielt 14:02');
  });
  it('nicht bereit – Ton nicht aktiviert + „Testton in der Halle“ → kein Auftrag, statt der Quittung der Grund; „Hier anhören“ geht trotzdem', () => {
    setzeStatus(voll({ state: 'not_activated', ageMs: 2000 }));
    render(seite());
    fireEvent.click(screen.getByTestId('testton-halle-1'));
    expect(anfordern()).not.toHaveBeenCalled();
    expect(screen.getByTestId('testton-feld-1-ergebnis')).toHaveTextContent('nicht bereit – Ton nicht aktiviert');
    fireEvent.click(screen.getByTestId('testton-hier-anhoeren'));
    expect(doppel.lautsprecher.hierAnhoeren).toHaveBeenCalledWith('abpfiff');
  });
  it('meldet sich seit 14:02 nicht → „nicht gespielt – meldet sich nicht (zuletzt 14:02)“, kein Auftrag', () => {
    setzeStatus(voll({ state: 'ready', ageMs: 30_000 }));
    render(seite());
    fireEvent.click(screen.getByTestId('testton-halle-1'));
    expect(anfordern()).not.toHaveBeenCalled();
    expect(screen.getByTestId('testton-feld-1-ergebnis')).toHaveTextContent('nicht gespielt – meldet sich nicht (zuletzt 14:02)');
  });
  it('keine Quittung nach 15 Sekunden → „nicht gespielt – keine Antwort“', async () => {
    vi.useFakeTimers();
    const testton = vi.fn(() => Promise.resolve({ ok: true, status: 'requested', testId: 'x2', requestedAt: 1, serverNow: SERVER_JETZT }));
    setzeStatus(voll({ state: 'ready', ageMs: 3000 }), 'aktuell', testton);
    render(seite());
    await act(async () => { fireEvent.click(screen.getByTestId('testton-halle-1')); await Promise.resolve(); });
    await act(async () => { await vi.advanceTimersByTimeAsync(15_100); });
    expect(screen.getByTestId('testton-feld-1-ergebnis')).toHaveTextContent('nicht gespielt – keine Antwort');
  });
  it('Gegenbeispiel: Netz weg beim Auftrag (Hook meldet „netz“) → „Kein Testton: kein Netz“', async () => {
    const testton = vi.fn(() => Promise.resolve({ ok: false, grund: 'netz' }));
    setzeStatus(voll({ state: 'ready', ageMs: 3000 }), 'aktuell', testton);
    render(seite());
    await act(async () => { fireEvent.click(screen.getByTestId('testton-halle-1')); await Promise.resolve(); });
    expect(screen.getByTestId('testton-feld-1-ergebnis')).toHaveTextContent('Kein Testton: kein Netz');
  });
});

describe('@HT-017 nur die Quittung des eigenen Auftrags zählt, ein älterer Test am Server nie', () => {
  const GESPIELT_1350 = new Date(2026, 10, 13, 13, 50, 0).getTime();
  const altTest = { testId: 'alt', playedAt: GESPIELT_1350 };
  it('Gegenbeispiel a: am Server steht ein Test von 13:50, der Lautsprecher ist jetzt nicht bereit → nach dem Klick der Grund, nirgends „gespielt 13:50“', () => {
    setzeStatus(voll({ state: 'not_activated', ageMs: 2000, test: altTest }));
    render(seite());
    expect(screen.queryByTestId('testton-feld-1-ergebnis'), 'ohne Klick keine fremde Quittung').toBeNull();
    fireEvent.click(screen.getByTestId('testton-halle-1'));
    expect(screen.getByTestId('testton-feld-1-ergebnis')).toHaveTextContent('nicht bereit – Ton nicht aktiviert');
    expect(document.body.textContent).not.toContain('gespielt 13:50');
  });
  it('Gegenbeispiel a2: meldet sich nicht, alter Test am Server → „nicht gespielt – meldet sich nicht (zuletzt 14:02)“, nicht „gespielt 13:50“', () => {
    setzeStatus(voll({ state: 'ready', ageMs: 30_000, test: altTest }));
    render(seite());
    fireEvent.click(screen.getByTestId('testton-halle-1'));
    expect(screen.getByTestId('testton-feld-1-ergebnis')).toHaveTextContent('nicht gespielt – meldet sich nicht (zuletzt 14:02)');
    expect(document.body.textContent).not.toContain('gespielt 13:50');
  });
  it('Gegenbeispiel b: alter Test am Server, neuer Auftrag ohne Quittung, nach 15 s → „nicht gespielt – keine Antwort“, nie „gespielt 13:50“', async () => {
    vi.useFakeTimers();
    const testton = vi.fn(() => Promise.resolve({ ok: true, status: 'requested', testId: 'neu', requestedAt: 1, serverNow: SERVER_JETZT }));
    setzeStatus(voll({ state: 'ready', ageMs: 3000, test: altTest }), 'aktuell', testton);
    render(seite());
    await act(async () => { fireEvent.click(screen.getByTestId('testton-halle-1')); await Promise.resolve(); });
    expect(screen.getByTestId('testton-feld-1-ergebnis')).not.toHaveTextContent('gespielt 13:50');
    await act(async () => { await vi.advanceTimersByTimeAsync(15_100); });
    expect(screen.getByTestId('testton-feld-1-ergebnis')).toHaveTextContent('nicht gespielt – keine Antwort');
    expect(document.body.textContent).not.toContain('gespielt 13:50');
  });
  it('die Quittung des eigenen Auftrags bleibt stehen, auch wenn die Antwort später wieder anders aussieht', async () => {
    const testton = vi.fn(() => Promise.resolve({ ok: true, status: 'requested', testId: 'neu', requestedAt: 1, serverNow: SERVER_JETZT }));
    setzeStatus(voll({ state: 'ready', ageMs: 3000 }), 'aktuell', testton);
    const { rerender } = render(seite());
    await act(async () => { fireEvent.click(screen.getByTestId('testton-halle-1')); await Promise.resolve(); });
    setzeStatus(voll({ state: 'ready', ageMs: 3000, test: { testId: 'neu', playedAt: GESPIELT_1402 } }), 'aktuell', testton);
    rerender(seite());
    setzeStatus(voll({ state: 'ready', ageMs: 3000 }), 'aktuell', testton);
    rerender(seite());
    expect(screen.getByTestId('testton-feld-1-ergebnis')).toHaveTextContent('gespielt 14:02');
  });
  it('zwei Felder: der zweite Auftrag verlängert die Frist des ersten nicht', async () => {
    vi.useFakeTimers();
    const testton = vi.fn((feld: number) => Promise.resolve({ ok: true, status: 'requested', testId: `t${feld}`, requestedAt: 1, serverNow: SERVER_JETZT }));
    const zwei = voll({ state: 'ready', ageMs: 3000 });
    zwei.speakers.push({ ...zwei.speakers[0], field: 2 });
    setzeStatus(zwei, 'aktuell', testton);
    render(seite());
    await act(async () => { fireEvent.click(screen.getByTestId('testton-halle-1')); await Promise.resolve(); });
    await act(async () => { await vi.advanceTimersByTimeAsync(10_000); });
    await act(async () => { fireEvent.click(screen.getByTestId('testton-halle-2')); await Promise.resolve(); });
    await act(async () => { await vi.advanceTimersByTimeAsync(5_200); });
    expect(screen.getByTestId('testton-feld-1-ergebnis')).toHaveTextContent('nicht gespielt – keine Antwort');
    expect(screen.getByTestId('testton-feld-2-ergebnis')).toHaveTextContent('Testton wird angefordert');
  });
});

describe('Stand „lädt“ ist kein „kein Netz“', () => {
  it('erste Antwort steht aus → Taste aus, nie „Kein Testton: kein Netz“, kein Auftrag', () => {
    // Dieses Gerät ist selbst Lautsprecher für Feld 1: die Karte steht, auch wenn der Server noch nicht geantwortet hat
    doppel.lautsprecher = {
      ...doppel.lautsprecher, rolle: 'diesesTurnier', felder: [1], name: 'Laptop Turnierleitung',
      laufzeit: { rolle: 'toent', zustandJeFeld: { 'field-1': 'ready' } },
    } as unknown as HallLautsprecher;
    const testton = vi.fn();
    setzeStatus(null, 'laedt', testton);
    render(seite());
    const taste = screen.getByTestId('testton-halle-1');
    expect(taste).toBeDisabled();
    fireEvent.click(taste);
    expect(testton).not.toHaveBeenCalled();
    expect(screen.queryByText('Kein Testton: kein Netz')).toBeNull();
    expect(screen.queryByTestId('testton-feld-1-ergebnis')).toBeNull();
  });
});

describe('@HT-046 nach dem Turnierende lesbar, nichts änderbar', () => {
  beforeEach(() => { doppel.darf = false; doppel.abgeschlossen = true; });
  it('Status je Feld sichtbar, Hinweis „abgeschlossen“, aber kein Testton und kein „Hier anhören“', () => {
    render(seite());
    expect(screen.getByTestId('hallenton-abgeschlossen')).toBeInTheDocument();
    expect(screen.getByTestId('lautsprecher-feld-1-zustand')).toHaveTextContent('bereit');
    expect(screen.queryByTestId('hallenton-testton')).toBeNull();
    expect(screen.queryByTestId('testton-halle-1')).toBeNull();
    expect(screen.queryByTestId('testton-hier-anhoeren')).toBeNull();
  });
  it('Gegenbeispiel: laufendes Turnier mit Recht → Testton-Tasten da, kein Abschluss-Hinweis', () => {
    doppel.darf = true; doppel.abgeschlossen = false;
    render(seite());
    expect(screen.queryByTestId('hallenton-abgeschlossen')).toBeNull();
    expect(screen.getByTestId('testton-halle-1')).toBeInTheDocument();
  });
});
