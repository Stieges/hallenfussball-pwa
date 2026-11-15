/**
 * H4-11 „🔈? Prüfen“ (@HT-047, @HT-049) und die Gründe „Ausgang verloren“ / „Ausgang bestätigen“ (@HT-039) im Unterpunkt „Hallenton“: Erwartungen aus dem
 * Gherkin, nicht am Code abgelesen. Hooks sind Doppel (Stand am Server, Gerät); Texte aus den echten deutschen Sprachdateien.
 * Wann der Hinweis am Server entsteht (starke Anzeichen, nie nach Neuladen oder Minimieren), entscheiden die Laufzeit-Tests (`lautsprecherLebenszeichen`,
 * `ausgangsSignale`); hier steht, was die Oberfläche daraus macht.
 */
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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
const laufendDoppel = vi.hoisted(() => ({ spiele: new Map<number, number>() }));
vi.mock('../../useLaufendeSpiele', () => ({ useLaufendeSpiele: () => laufendDoppel.spiele }));

import { HallentonSeite } from '../HallentonSeite';

const SERVER_JETZT = new Date(2026, 10, 21, 14, 2, 30).getTime();
const GESPIELT_1402 = new Date(2026, 10, 21, 14, 2, 0).getTime();

interface Stand { state: string; hinweis?: boolean; test?: { testId: string; playedAt: number | null } }
function voll(s: Stand): HallStatusVoll {
  return {
    sicht: 'voll', serverNow: SERVER_JETZT, closed: false, leads: [],
    settings: { halftimeSound: 'horn-1', halftimeCustomPath: null, endCustomPath: null, goalToneFields: [], goalAnthemPaths: [] },
    speakers: [{
      field: 1, deviceName: 'Laptop Turnierleitung', isThisDevice: false, state: s.state as never, assignedAt: 1, outputHint: s.hinweis === true, hintAt: s.hinweis === true ? 1 : null,
      lastSeen: null, ageMs: 3000, test: s.test ? { testId: s.test.testId, requestedAt: 1, playedAt: s.test.playedAt } : null,
    }],
  };
}
const lageAus = (antwort: HallStatusAntwort): Record<number, LautsprecherLage> =>
  Object.fromEntries(antwort.speakers.map((s) => [s.field, lautsprecherLage({ state: s.state, ageMs: s.ageMs, outputHint: s.outputHint }, antwort.serverNow)]));
const setzeStatus = (s: Stand, testton = vi.fn(), gehoert = vi.fn(() => Promise.resolve({ ok: true }))): void => {
  const antwort = voll(s);
  doppel.status = { stand: 'aktuell', antwort, felder: lageAus(antwort), lautsprecherBekannt: true, testtonAnfordern: testton, gehoert } as unknown as HallStatus;
};
const anfordernMock = () => vi.fn(() => Promise.resolve({ ok: true, status: 'requested', testId: 'x1', requestedAt: 1, serverNow: SERVER_JETZT }));

beforeEach(() => {
  doppel.darf = true; doppel.abgeschlossen = false; laufendDoppel.spiele = new Map();
  doppel.lautsprecher = { rolle: 'keiner', felder: [], name: null, laufzeit: null, abgeloest: null, anderesTurnier: null, hierAnhoeren: vi.fn(() => Promise.resolve(true)), lautstaerke: { abpfiff: 100, halbzeit: 100, tor: 100 } } as unknown as HallLautsprecher;
});

const seite = () => <HallentonSeite tournamentId="t1" felderAnzahl={2} />;
const pille = () => screen.queryByTestId('lautsprecher-feld-1-pruefen');

describe('@HT-047 „🔈? Prüfen“ neben „✓ Bereit“', () => {
  it('Zeilen 1 bis 3 (Verzögerung, geänderte Geräte, Unterbrechung): „bereit“ und daneben die Pille „Prüfen“, keine Störung', () => {
    setzeStatus({ state: 'ready', hinweis: true });
    render(seite());
    expect(screen.getByTestId('lautsprecher-feld-1-zustand')).toHaveTextContent('bereit');
    expect(pille()).toHaveTextContent('Prüfen');
    expect(screen.getByTestId('lautsprecher-feld-1-zustand')).toHaveAttribute('data-ton', 'ok');
  });

  it('Zeilen 4 bis 6 (minimiert und wieder vorn, nach Neuladen, Bluetooth getrennt ohne Meldung): „bereit“ ohne Pille – der Server setzt keinen Hinweis, die Oberfläche erfindet keinen', () => {
    setzeStatus({ state: 'ready', hinweis: false });
    render(seite());
    expect(screen.getByTestId('lautsprecher-feld-1-zustand')).toHaveTextContent('bereit');
    expect(pille()).toBeNull();
  });

  it('die Pille ist antippbar (mindestens 44 px hoch ausgelegt) und die Seite zeigt sie nur, solange der Hinweis am Server steht', () => {
    setzeStatus({ state: 'ready', hinweis: true });
    const { rerender } = render(seite());
    expect(pille()?.tagName).toBe('BUTTON');
    setzeStatus({ state: 'ready', hinweis: false });
    rerender(seite());
    expect(pille()).toBeNull();
  });
});

describe('@HT-049 Rückfrage „Gehört“ / „Nicht gehört“', () => {
  async function tippeUndSpiele(): Promise<{ rerender: (u: React.ReactElement) => void; testton: ReturnType<typeof anfordernMock>; gehoert: ReturnType<typeof vi.fn> }> {
    const testton = anfordernMock();
    const gehoert = vi.fn(() => Promise.resolve({ ok: true }));
    setzeStatus({ state: 'ready', hinweis: true }, testton, gehoert);
    const { rerender } = render(seite());
    await act(async () => { fireEvent.click(pille()!); await Promise.resolve(); });
    expect(testton).toHaveBeenCalledWith(1); // der Tipp spielt einmal den Testton in der Halle
    setzeStatus({ state: 'ready', hinweis: true, test: { testId: 'x1', playedAt: GESPIELT_1402 } }, testton, gehoert);
    rerender(seite());
    return { rerender, testton, gehoert };
  }

  it('nach dem Tipp zeigt die Karte „Gespielt 14:02“ mit „✓ Gehört“ und „✕ Nicht gehört“; der Lautsprecher bleibt „bereit“', async () => {
    await tippeUndSpiele();
    const frage = screen.getByTestId('ausgang-rueckfrage');
    expect(frage).toHaveTextContent('Gespielt 14:02');
    expect(frage).toHaveTextContent('Hast du den Testton in der Halle gehört?');
    expect(screen.getByTestId('ausgang-gehoert')).toHaveTextContent('✓ Gehört');
    expect(screen.getByTestId('ausgang-nicht-gehoert')).toHaveTextContent('✕ Nicht gehört');
    expect(screen.getByTestId('lautsprecher-feld-1-zustand')).toHaveTextContent('bereit');
  });

  it('Zeile 1 „✓ Gehört“: der Hinweis geht weg (hall_output_heard), die Pille verschwindet, bei Feld 1 steht nur „bereit“', async () => {
    const { rerender, gehoert } = await tippeUndSpiele();
    await act(async () => { fireEvent.click(screen.getByTestId('ausgang-gehoert')); await Promise.resolve(); });
    expect(gehoert).toHaveBeenCalledWith(1);
    setzeStatus({ state: 'ready', hinweis: false });
    rerender(seite());
    expect(screen.queryByTestId('ausgang-rueckfrage')).toBeNull();
    expect(pille()).toBeNull();
    expect(screen.getByTestId('lautsprecher-feld-1-zustand')).toHaveTextContent('bereit');
  });

  it('Zeile 2 „✕ Nicht gehört“: die drei Prüfpunkte und „Nochmal prüfen“; „bereit“ bleibt stehen, es wird nichts als gehört gemeldet', async () => {
    const { gehoert } = await tippeUndSpiele();
    fireEvent.click(screen.getByTestId('ausgang-nicht-gehoert'));
    const punkte = screen.getByTestId('ausgang-pruefpunkte');
    expect(punkte).toHaveTextContent('Lautstärke am Gerät und an der Anlage');
    expect(punkte).toHaveTextContent('Kabel oder Bluetooth verbunden');
    expect(punkte).toHaveTextContent('Richtiger Ausgang am Gerät');
    expect(screen.getByTestId('ausgang-nochmal')).toHaveTextContent('Nochmal prüfen');
    expect(screen.getByTestId('lautsprecher-feld-1-zustand')).toHaveTextContent('bereit');
    expect(gehoert).not.toHaveBeenCalled();
  });

  it('„Nochmal prüfen“ spielt noch einmal den Testton; erst nach dessen Quittung kommt die Frage wieder (nie mit der alten Uhrzeit)', async () => {
    const { rerender, testton } = await tippeUndSpiele();
    fireEvent.click(screen.getByTestId('ausgang-nicht-gehoert'));
    testton.mockResolvedValueOnce({ ok: true, status: 'requested', testId: 'x2', requestedAt: 2, serverNow: SERVER_JETZT });
    await act(async () => { fireEvent.click(screen.getByTestId('ausgang-nochmal')); await Promise.resolve(); });
    expect(testton).toHaveBeenCalledTimes(2);
    expect(screen.queryByTestId('ausgang-rueckfrage')).toBeNull(); // noch keine Quittung des neuen Tons
    setzeStatus({ state: 'ready', hinweis: true, test: { testId: 'x2', playedAt: new Date(2026, 10, 21, 14, 5, 0).getTime() } }, testton);
    rerender(seite());
    expect(screen.getByTestId('ausgang-rueckfrage')).toHaveTextContent('Gespielt 14:05');
  });

  it('Zeile 3 „nichts wählt“: die Frage bleibt ruhig stehen, bis Olli antwortet; „bereit“ bleibt, nichts wird gemeldet', async () => {
    const { rerender, gehoert } = await tippeUndSpiele();
    rerender(seite());
    rerender(seite());
    expect(screen.getByTestId('ausgang-rueckfrage')).toBeVisible();
    expect(screen.getByTestId('lautsprecher-feld-1-zustand')).toHaveTextContent('bereit');
    expect(gehoert).not.toHaveBeenCalled();
  });

  it('Gegenbeispiel: ohne Tipp wird nie ein Testton angefordert (die Pille steht nur da)', () => {
    const testton = anfordernMock();
    setzeStatus({ state: 'ready', hinweis: true }, testton);
    render(seite());
    expect(testton).not.toHaveBeenCalled();
    expect(screen.queryByTestId('ausgang-rueckfrage')).toBeNull();
  });

  it('läuft auf dem Feld ein Spiel, fragt zuerst die Rückfrage „Testton trotzdem …“ (wie @HT-017); ohne Ja geht nichts raus', async () => {
    laufendDoppel.spiele = new Map([[1, 11]]);
    const testton = anfordernMock();
    setzeStatus({ state: 'ready', hinweis: true }, testton);
    render(seite());
    await act(async () => { fireEvent.click(pille()!); await Promise.resolve(); });
    expect(testton).not.toHaveBeenCalled();
    expect(screen.getByText(/Auf Feld 1 läuft Spiel 11/)).toBeVisible();
  });

  it('nach dem Turnierende (nicht änderbar) ist die Pille eine reine Marke, kein Tipp spielt einen Testton', () => {
    doppel.darf = false; doppel.abgeschlossen = true;
    setzeStatus({ state: 'ready', hinweis: true });
    render(seite());
    expect(pille()?.tagName).toBe('SPAN');
  });
});

describe('@HT-039 die Gründe „Ausgang verloren“ und „Ausgang bestätigen“ im Unterpunkt', () => {
  it.each([
    ['output_lost', 'nicht bereit – Ausgang verloren'],
    ['output_unconfirmed', 'nicht bereit – Ausgang bestätigen'],
  ])('Server meldet %s → die Karte von Feld 1 nennt „%s“', (state, text) => {
    setzeStatus({ state });
    render(seite());
    expect(screen.getByTestId('lautsprecher-feld-1-zustand')).toHaveTextContent(text);
  });

  it('Gegenbeispiel: ein Testton in die Halle geht bei „Ausgang verloren“ nicht raus – die Auskunft nennt den Grund', () => {
    const testton = anfordernMock();
    setzeStatus({ state: 'output_lost' }, testton);
    render(seite());
    fireEvent.click(screen.getByTestId('testton-halle-1'));
    expect(testton).not.toHaveBeenCalled();
    expect(screen.getByTestId('testton-feld-1-ergebnis')).toHaveTextContent('nicht bereit – Ausgang verloren');
  });
});
