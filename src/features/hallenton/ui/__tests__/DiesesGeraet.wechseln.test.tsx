/**
 * H4-9 „Dieses Gerät“, Rückfrage beim zweiten Turnier (@HT-056): Erwartungen aus dem Gherkin, nicht am Code abgelesen.
 * „Dieses Gerät ist schon Hallen-Lautsprecher für ‚Hallencup Süd‘. Wechseln?“ – bestätigen: Lautsprecher im „Hallencup Nord“; abbrechen: alles
 * wie vorher. Der Name des anderen Turniers kommt aus dem lokalen Turnier. Die Zuordnung selbst (erst neu, dann alt abmelden) prüft
 * `__tests__/geraetWechsel.test.tsx` am Hook.
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
const laufendDoppel = vi.hoisted(() => ({ spiele: new Map<number, number>() }));
vi.mock('../../useLaufendeSpiele', () => ({ useLaufendeSpiele: () => laufendDoppel.spiele }));
const lokalesTurnier = vi.hoisted((): { titel: string | null } => ({ titel: 'Hallencup Süd' }));
vi.mock('../../lokalesTurnier', () => ({ ladeTurnierLokal: () => Promise.resolve(lokalesTurnier.titel === null ? null : { title: lokalesTurnier.titel }) }));

import { HallentonSeite } from '../HallentonSeite';

const SERVER_JETZT = new Date(2026, 10, 13, 14, 2, 30).getTime();

function voll(felder: ReadonlyArray<{ feld: number; name: string; state: string }>): HallStatusVoll {
  return {
    sicht: 'voll', serverNow: SERVER_JETZT, closed: false, leads: [],
    settings: { halftimeSound: 'horn-1', halftimeCustomPath: null, endCustomPath: null, goalToneFields: [], goalAnthemPaths: [] },
    speakers: felder.map((f) => ({
      field: f.feld, deviceName: f.name, isThisDevice: false, state: f.state as never, assignedAt: 1, outputHint: false, hintAt: null, lastSeen: null, ageMs: 3000, test: null,
    })),
  };
}
const lageAus = (antwort: HallStatusAntwort): Record<number, LautsprecherLage> =>
  Object.fromEntries(antwort.speakers.map((s) => [s.field, lautsprecherLage({ state: s.state, ageMs: s.ageMs, outputHint: s.outputHint }, antwort.serverNow)]));
const setzeServer = (antwort: HallStatusVoll): void => {
  doppel.status = { stand: 'aktuell', antwort, felder: lageAus(antwort), lautsprecherBekannt: antwort.speakers.length > 0, testtonAnfordern: vi.fn(), gehoert: vi.fn() } as unknown as HallStatus;
};

const zugeordnet = (felder: number[]) => Promise.resolve({ ok: true as const, status: 'assigned' as const, fields: felder, replaced: [] });
function lautsprecherDoppel(teil: Partial<HallLautsprecher> = {}): HallLautsprecher {
  return {
    rolle: 'keiner', felder: [], name: null, laufzeit: null, abgeloest: null, anderesTurnier: null,
    einschalten: vi.fn((felder: readonly number[]) => zugeordnet([...felder])),
    wechseln: vi.fn((felder: readonly number[]) => zugeordnet([...felder])),
    feldAbmelden: vi.fn(() => Promise.resolve({ ok: true as const, status: 'released' as const, fields: [2] })),
    ausschalten: vi.fn(() => Promise.resolve({ ok: true as const, status: 'released' as const, fields: [1] })),
    tonAktivieren: vi.fn(() => Promise.resolve(true)),
    abgeloestVerstanden: vi.fn(), hierAnhoeren: vi.fn(() => Promise.resolve(true)),
    lautstaerke: { abpfiff: 100, halbzeit: 100, tor: 100 }, setzeLautstaerke: vi.fn(), angehaltenBestaetigen: vi.fn(),
    ...teil,
  } as unknown as HallLautsprecher;
}
const seite = () => <HallentonSeite tournamentId="t-nord" felderAnzahl={2} />;
const wechseln = (): ReturnType<typeof vi.fn> => doppel.lautsprecher.wechseln as unknown as ReturnType<typeof vi.fn>;
const klick = async (testId: string): Promise<void> => { await act(async () => { fireEvent.click(screen.getByTestId(testId)); await Promise.resolve(); }); };
const feldWaehlen = async (): Promise<void> => { await klick('geraet-schalter-taste'); await klick('geraet-feld-1'); };

beforeEach(() => {
  doppel.darf = true; doppel.abgeschlossen = false; lokalesTurnier.titel = 'Hallencup Süd';
  // Dieses Gerät ist bereiter Hallen-Lautsprecher für Feld 1 im „Hallencup Süd“; hier ist das „Hallencup Nord“
  doppel.lautsprecher = lautsprecherDoppel({ rolle: 'anderesTurnier', anderesTurnier: { turnierId: 't-sued', felder: [1] } });
  setzeServer(voll([]));
  window.localStorage.clear();
});
afterEach(() => vi.restoreAllMocks());

describe('@HT-056 Rückfrage beim zweiten Turnier', () => {
  it('Schalter für Feld 1 umlegen → „Dieses Gerät ist schon Hallen-Lautsprecher für ‚Hallencup Süd‘. Wechseln?“, noch keine Zuordnung', async () => {
    render(seite());
    await feldWaehlen();
    expect(screen.getByText('Dieses Gerät ist schon Hallen-Lautsprecher für ‚Hallencup Süd‘. Wechseln?', { exact: false })).toBeInTheDocument();
    expect(wechseln()).not.toHaveBeenCalled();
    expect(doppel.lautsprecher.einschalten).not.toHaveBeenCalled();
  });
  it('bestätigen → Wechsel für Feld 1 mit dem Gerätenamen', async () => {
    render(seite());
    fireEvent.change(screen.getByTestId('geraet-name'), { target: { value: 'Rechner der Turnierleitung' } });
    await feldWaehlen();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Wechseln' })); await Promise.resolve(); });
    expect(wechseln()).toHaveBeenCalledWith([1], 'Rechner der Turnierleitung', false);
    expect(screen.queryByText(/Wechseln\?/)).toBeNull();
  });
  it('Gegenbeispiel: abbrechen ändert nichts – kein Aufruf, Frage weg', async () => {
    render(seite());
    await feldWaehlen();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Abbrechen' })); await Promise.resolve(); });
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false'); // B5: auch der Schalter steht wie vorher
    expect(wechseln()).not.toHaveBeenCalled();
    expect(doppel.lautsprecher.einschalten).not.toHaveBeenCalled();
    expect(screen.queryByText(/Wechseln\?/)).toBeNull();
  });
  it('liegt das andere Turnier nicht lokal, fragt die App ohne Namen', async () => {
    lokalesTurnier.titel = null;
    render(seite());
    await feldWaehlen();
    expect(screen.getByText('Dieses Gerät ist schon Hallen-Lautsprecher für ein anderes Turnier. Wechseln?', { exact: false })).toBeInTheDocument();
  });
  it('belegt im neuen Turnier ein anderes Gerät das Feld: nach dem Wechseln kommt erst die Rückfrage „Ablösen?“, dann gilt der Wechsel mit Ablösen', async () => {
    doppel.lautsprecher = lautsprecherDoppel({
      rolle: 'anderesTurnier', anderesTurnier: { turnierId: 't-sued', felder: [1] },
      wechseln: vi.fn((_f: readonly number[], _n: string, abloesen?: boolean) => Promise.resolve(abloesen === true
        ? { ok: true as const, status: 'assigned' as const, fields: [1], replaced: [{ field: 1, deviceName: 'Hallenmonitor Halle' }] }
        : { ok: true as const, status: 'occupied' as const, fields: [{ field: 1, deviceName: 'Hallenmonitor Halle' }] })),
    } as never);
    render(seite());
    await feldWaehlen();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Wechseln' })); await Promise.resolve(); });
    expect(screen.getByText(/Feld 1 hat schon einen Hallen-Lautsprecher \(Hallenmonitor Halle\)\. Ablösen\?/)).toBeInTheDocument();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Ablösen' })); await Promise.resolve(); });
    expect(wechseln()).toHaveBeenLastCalledWith([1], expect.any(String), true);
  });
  it('Gegenbeispiel: in keinem anderen Turnier Lautsprecher → keine Wechsel-Frage, gleich die Zuordnung', async () => {
    doppel.lautsprecher = lautsprecherDoppel();
    render(seite());
    await feldWaehlen();
    expect(screen.queryByText(/Wechseln\?/)).toBeNull();
    expect(doppel.lautsprecher.einschalten).toHaveBeenCalledTimes(1);
  });
  it('B4 die Abmeldung im alten Turnier scheitert (z. B. dort kein Recht): das neue Turnier gilt, ein ruhiger Hinweis mit dem Namen sagt, dort selbst auszuschalten', async () => {
    doppel.lautsprecher = lautsprecherDoppel({
      rolle: 'anderesTurnier', anderesTurnier: { turnierId: 't-sued', felder: [1] },
      wechseln: vi.fn(() => Promise.resolve({ ok: true as const, status: 'assigned' as const, fields: [1], replaced: [], alteAbmeldungFehler: 'kein_recht' as const })),
    } as never);
    render(seite());
    await feldWaehlen();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Wechseln' })); await Promise.resolve(); });
    expect(screen.getByTestId('geraet-alte-abmeldung')).toHaveTextContent('Im Turnier ‚Hallencup Süd‘ konnte der Lautsprecher nicht abgemeldet werden – dort bitte selbst ausschalten.');
    expect(screen.queryByTestId('geraet-fehler')).toBeNull();
  });
  it('Gegenbeispiel B4: Abmeldung gelungen → kein Hinweis', async () => {
    render(seite());
    await feldWaehlen();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Wechseln' })); await Promise.resolve(); });
    expect(screen.queryByTestId('geraet-alte-abmeldung')).toBeNull();
  });
});
