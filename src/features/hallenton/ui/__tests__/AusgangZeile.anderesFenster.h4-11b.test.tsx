/**
 * H4-11b Nachzug 🟡A aus dem Review von H4-11, Anzeige im ANDEREN Fenster (@HT-055 „Ausgang bestätigen“): Meldet der Server für dieses Gerät „Ausgang bestätigen“ (Karte, Cockpit), und tönt
 * ein anderes Fenster dieses Geräts, zeigt dieses Fenster die Taste „Ausgang bestätigen“ trotzdem – sonst käme niemand an den Fehler im tönenden Fenster heran. Ein Tipp stößt den tönenden Tab an
 * (`pruefenAnstossen`, geschrieben in den gemeinsamen Speicher). Das tönende Fenster selbst glaubt seiner eigenen Lage, nicht dem (bis zu 5 s alten) Stand am Server.
 * Der echte Hook `useHallAusgang` mit gefälschten `mediaDevices`/`AudioContext`; Stand am Server und Gerät sind Doppel.
 */
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import de from '../../../../i18n/locales/de/hallenton.json';
import type { HallStatusVoll } from '../../../../core/repositories/hallentonRpc';
import { FalscheMedienGeraete } from '../../../../test/hallenton/falscheMedienGeraete';
import { FalscherSpeicher } from '../../../../test/hallenton/falschesGeraet';
import { lautsprecherLage } from '../../runtime/hallStatusAuswertung';
import { __setzeGeraetFuerTests } from '../../lautsprecherGeraet';
import { erzeugeAusgangListe } from '../../runtime/ausgang/ausgangListe';
import { erzeugeAusgangWaechter } from '../../runtime/ausgang/ausgangWaechter';
import { AUSGANG_PRUEFEN_SCHLUESSEL, erzeugeAusgangWahl } from '../../runtime/ausgang/ausgangWahl';
import { __setzeAusgangFuerTests } from '../../runtime/ausgang/browserAusgang';
import type { HallTonSpieler } from '../../runtime/hallTonSpieler';
import type { HallLautsprecher } from '../../useHallLautsprecher';
import type { HallStatus } from '../../useHallStatus';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'de' },
    t: (key: string, opts?: Record<string, unknown>) => {
      const wert = key.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], de);
      const text = typeof wert === 'string' ? wert : `FEHLT:${key}`;
      return text.replace(/\{\{(\w+)\}\}/g, (_, n: string) => String(opts?.[n] ?? `{{${n}}}`));
    },
  }),
}));
const doppel = vi.hoisted(() => ({ status: null as unknown as HallStatus, lautsprecher: null as unknown as HallLautsprecher }));
vi.mock('../../../auth/hooks/useCan', () => ({ useCan: () => true }));
vi.mock('../../../../hooks/useTournamentClosed', () => ({ useTournamentClosed: () => false }));
vi.mock('../../useHallStatus', () => ({ useHallStatus: () => doppel.status }));
vi.mock('../../useHallLautsprecher', () => ({ useHallLautsprecher: () => doppel.lautsprecher }));
vi.mock('../../useLaufendeSpiele', () => ({ useLaufendeSpiele: () => new Map<number, number>() }));
vi.mock('../../lokalesTurnier', () => ({ ladeTurnierLokal: () => Promise.resolve(null) }));

import { HallentonSeite } from '../HallentonSeite';

const SERVER_JETZT = new Date(2026, 10, 15, 14, 2, 30).getTime();
let medien: FalscheMedienGeraete;
let speicher: FalscherSpeicher;
let aktivieren: ReturnType<typeof vi.fn>;

function setzeServer(state: string): void {
  const antwort: HallStatusVoll = {
    sicht: 'voll', serverNow: SERVER_JETZT, closed: false, leads: [],
    settings: { halftimeSound: 'horn-1', halftimeCustomPath: null, endCustomPath: null, goalToneFields: [], goalAnthemPaths: [] },
    speakers: [{ field: 1, deviceName: 'Laptop Turnierleitung', isThisDevice: true, state: state as never, assignedAt: 1, outputHint: false, hintAt: null, lastSeen: null, ageMs: 3000, test: null }],
  };
  doppel.status = {
    stand: 'aktuell', antwort, felder: { 1: lautsprecherLage({ state: antwort.speakers[0].state, ageMs: 3000, outputHint: false }, SERVER_JETZT) },
    lautsprecherBekannt: true, letzteSprecher: antwort.speakers, testtonAnfordern: vi.fn(), gehoert: vi.fn(),
  } as unknown as HallStatus;
}
const lautsprecher = (rolle: 'toent' | 'andererTab'): HallLautsprecher => ({
  rolle: 'diesesTurnier', felder: [1], name: 'Laptop Turnierleitung', laufzeit: { rolle, zustandJeFeld: { 'field-1': 'ready' }, warAngehalten: false }, abgeloest: null, anderesTurnier: null,
  tonAktivieren: vi.fn(() => Promise.resolve(true)), abgeloestVerstanden: vi.fn(), angehaltenBestaetigen: vi.fn(), hierAnhoeren: vi.fn(() => Promise.resolve(true)),
  lautstaerke: { abpfiff: 100, halbzeit: 100, tor: 100 }, setzeLautstaerke: vi.fn(), feldAbmelden: vi.fn(), ausschalten: vi.fn(),
}) as unknown as HallLautsprecher;
const seite = () => <HallentonSeite tournamentId="t-sued" felderAnzahl={1} />;

beforeEach(() => {
  medien = new FalscheMedienGeraete();
  speicher = new FalscherSpeicher();
  aktivieren = vi.fn(() => Promise.resolve(true));
  __setzeGeraetFuerTests({ spieler: { aktivieren } as unknown as HallTonSpieler });
  vi.stubGlobal('AudioContext', class { setSinkId(): Promise<void> { return Promise.resolve(); } });
  const liste = erzeugeAusgangListe({ geraete: medien, berechtigungen: medien });
  const wahl = erzeugeAusgangWahl({ speicher, seite: null });
  __setzeAusgangFuerTests({ liste, wahl, waechter: erzeugeAusgangWaechter({ liste, wahl }) });
});
afterEach(() => {
  vi.unstubAllGlobals();
  __setzeAusgangFuerTests(null);
  __setzeGeraetFuerTests();
});

describe('@HT-055 „Ausgang bestätigen“ steht auch im Fenster, das nicht tönt', () => {
  it('der Server meldet für dieses Gerät „Ausgang bestätigen“, ein anderes Fenster tönt → die Taste steht da; der Tipp ist die Geste für „Ton aktivieren“ und stößt den tönenden Tab über den gemeinsamen Speicher an', async () => {
    setzeServer('output_unconfirmed');
    doppel.lautsprecher = lautsprecher('andererTab');
    render(seite());
    expect(screen.getByTestId('ausgang-bestaetigen')).toHaveTextContent('Ausgang bestätigen');
    expect(speicher.getItem(AUSGANG_PRUEFEN_SCHLUESSEL)).toBeNull();
    await act(async () => { fireEvent.click(screen.getByTestId('ausgang-bestaetigen-taste')); await Promise.resolve(); await Promise.resolve(); });
    expect(aktivieren).toHaveBeenCalledTimes(1);
    expect(speicher.getItem(AUSGANG_PRUEFEN_SCHLUESSEL)).not.toBeNull(); // der tönende Tab bekommt das `storage`-Ereignis
    expect(medien.mikrofonAnfragen).toBe(0); // „Standard“: kein Mikrofon nötig
  });

  it('Gegenbeispiel: der Server meldet „bereit“ → keine Taste', () => {
    setzeServer('ready');
    doppel.lautsprecher = lautsprecher('andererTab');
    render(seite());
    expect(screen.queryByTestId('ausgang-bestaetigen')).toBeNull();
  });

  it('Gegenbeispiel: dieses Fenster IST das tönende und kennt seine Lage selbst („Standard“, in Ordnung) → die Taste steht nicht, auch wenn der Stand am Server noch „Ausgang bestätigen“ sagt', () => {
    setzeServer('output_unconfirmed');
    doppel.lautsprecher = lautsprecher('toent');
    render(seite());
    expect(screen.queryByTestId('ausgang-bestaetigen')).toBeNull();
  });

  it('Gegenbeispiel: der Server meldet „Ausgang bestätigen“ für ein ANDERES Gerät → hier steht keine Taste (nur das Gerät selbst kann bestätigen)', () => {
    setzeServer('output_unconfirmed');
    const stand = doppel.status.antwort as HallStatusVoll;
    doppel.status = { ...doppel.status, antwort: { ...stand, speakers: [{ ...stand.speakers[0], isThisDevice: false }] } };
    doppel.lautsprecher = lautsprecher('andererTab');
    render(seite());
    expect(screen.queryByTestId('ausgang-bestaetigen')).toBeNull();
  });
});
