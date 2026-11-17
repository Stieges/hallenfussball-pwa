/**
 * @HT-059 Im Cockpit zeigt die Statuszeile nur Störungen (Eigenschaft `nurStoerungen`, gesetzt von `ManagementTabKopf`). Die Erwartungen stehen im
 * Gherkin von @HT-059 (je Beispielzeile ein Test), dazu die Gegenbeispiele: die Verwaltung (@HT-045) und der Streifen (@HT-012) bleiben, wie sie sind.
 * Die Hooks sind Doppel; Texte aus den echten deutschen Sprachdateien.
 */
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import common from '../../../../i18n/locales/de/common.json';
import de from '../../../../i18n/locales/de/hallenton.json';
import type { StatusEintrag } from '../../../../components/ui/molecules/statusZeileTypen';
import type { HallLautsprecher } from '../../useHallLautsprecher';
import type { HallStatus } from '../../useHallStatus';
import type { LautsprecherLage } from '../../runtime/hallStatusAuswertung';
import type { LaufzeitSnapshot } from '../../runtime/HallLautsprecherLaufzeit';

vi.mock('react-i18next', () => ({
  useTranslation: (ns: string) => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      const quelle = ns === 'common' ? common : de;
      const wert = key.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], quelle);
      const text = typeof wert === 'string' ? wert : `FEHLT:${key}`;
      return text.replace(/\{\{(\w+)\}\}/g, (_, n: string) => String(opts?.[n] ?? `{{${n}}}`));
    },
  }),
}));

const doppel = vi.hoisted(() => ({
  status: null as HallStatus | null,
  lautsprecher: null as HallLautsprecher | null,
  angepfiffen: new Set<number>(),
}));
vi.mock('../../../auth/hooks/useCan', () => ({ useCan: () => true }));
vi.mock('../../../../hooks/useKioskRoute', () => ({ useKioskRoute: () => false }));
vi.mock('../../useHallStatus', () => ({ useHallStatus: () => doppel.status }));
const laufendAusFeldern = vi.hoisted(() => {
  const zwischenspeicher = new WeakMap<ReadonlySet<number>, ReadonlyMap<number, number>>();
  return (felder: ReadonlySet<number>): ReadonlyMap<number, number> => {
    const gemerkt = zwischenspeicher.get(felder) ?? new Map([...felder].map((feld) => [feld, 1] as const));
    zwischenspeicher.set(felder, gemerkt);
    return gemerkt;
  };
});
vi.mock('../../useLaufendeSpiele', () => ({ useLaufendeSpiele: () => laufendAusFeldern(doppel.angepfiffen) }));
vi.mock('../../useHallLautsprecher', () => ({ useHallLautsprecher: () => doppel.lautsprecher }));
const geraet = vi.hoisted(() => ({ einschaltung: null as { turnierId: string; felder: number[]; name: string } | null }));
vi.mock('../../lautsprecherGeraet', () => ({ geraetStand: () => geraet, abonniereGeraet: () => () => undefined }));

import { AuthContext } from '../../../auth/context/authContextInstance';
import { HallStatusZeile, HallStatusZeileAnsicht } from '../HallStatusZeile';
import { hallAnzeige } from '../../hallAnzeige';
import { HallGeraetStreifen } from '../HallGeraetStreifen';
import { hatStatusZeileHost } from '../StatusZeileOrt';

const status = (felder: Record<number, LautsprecherLage>, stand: HallStatus['stand'] = 'aktuell', lautsprecherBekannt = Object.keys(felder).length > 0): HallStatus => ({
  stand, antwort: null, felder, lautsprecherBekannt, letzteSprecher: [], testtonAnfordern: vi.fn(), gehoert: vi.fn(),
});
const laufzeit = (rolle: LaufzeitSnapshot['rolle'], zustand: string): LaufzeitSnapshot => ({
  rolle, turnierId: 't1', felder: [1], geraeteZustand: 'ready', zustandJeFeld: { 'field-1': zustand as never },
  naechsterTon: null, taktFehler: false, warAngehalten: false, verfuegbarkeit: null,
});
const lautsprecher = (l: LaufzeitSnapshot | null, tonAktivieren = vi.fn(() => Promise.resolve(true))): HallLautsprecher => ({
  rolle: l ? 'diesesTurnier' : 'keiner', felder: l ? [1] : [], name: l ? 'Handy Tom' : null, laufzeit: l, tonAktivieren,
} as unknown as HallLautsprecher);
const probe: StatusEintrag = { id: 'probe', rang: 'probe', ton: 'info', rand: 'gestrichelt', symbol: null, text: 'Probe läuft', aktion: { art: 'navigiere', ziel: '/probe' } };
const huelle = (ui: React.ReactElement) => <AuthContext.Provider value={{} as never}><MemoryRouter>{ui}</MemoryRouter></AuthContext.Provider>;
const zeige = (ui: React.ReactElement) => render(huelle(ui));
const buttons = () => screen.getAllByRole('button').map((b) => b.textContent);
const bereit: LautsprecherLage = { art: 'bereit', pruefen: false };
const nichtBereit: LautsprecherLage = { art: 'nichtBereit', grund: 'background', pruefen: false };

beforeEach(() => {
  doppel.angepfiffen = new Set<number>();
  doppel.status = status({}); doppel.lautsprecher = lautsprecher(null);
  geraet.einschaltung = null;
});

describe('@HT-059 Im Cockpit zeigt die Statuszeile nur Störungen', () => {
  it('@HT-059 Zeile 1: Feld 1 bereit → keine Statuszeile, kein Wort „bereit“, keine Höhe', () => {
    doppel.status = status({ 1: bereit });
    const r = zeige(<HallStatusZeile tournamentId="t1" nurStoerungen />);
    expect(screen.queryByTestId('hallenton-status-zeile')).toBeNull();
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(r.container.innerHTML).toBe('');
  });
  it('@HT-059 Zeile 2: Feld 1 bereit mit „Prüfen“ → keine Statuszeile; in der Verwaltung steht die Pille weiter (@HT-047)', () => {
    doppel.status = status({ 1: { art: 'bereit', pruefen: true } });
    const cockpit = zeige(<HallStatusZeile tournamentId="t1" nurStoerungen />);
    expect(screen.queryByTestId('hallenton-status-zeile')).toBeNull();
    expect(screen.queryByRole('button', { name: /Prüfen/ })).toBeNull();
    cockpit.unmount();
    zeige(<HallStatusZeile tournamentId="t1" />);
    expect(buttons()).toEqual(['Lautsprecher Feld 1 bereit', 'Prüfen']);
  });
  it('@HT-059 Zeile 3: Feld 1 bereit, Feld 2 nicht bereit → nur „Lautsprecher Feld 2 nicht bereit“, „Feld 1 bereit“ steht nicht daneben', () => {
    doppel.status = status({ 1: bereit, 2: nichtBereit });
    zeige(<HallStatusZeile tournamentId="t1" nurStoerungen />);
    expect(buttons()).toEqual(['Lautsprecher Feld 2 nicht bereit']);
    expect(document.body.textContent).not.toContain('Feld 1 bereit');
  });
  it('@HT-059 Zeile 4: dieses Handy ist Lautsprecher, Ton nicht aktiviert → „Ton nicht aktiv – hier klicken“; ein Tipp aktiviert den Ton, danach verschwindet die Zeile', async () => {
    geraet.einschaltung = { turnierId: 't1', felder: [1], name: 'Handy Tom' };
    doppel.status = status({ 1: bereit });
    let tonAktivieren: () => Promise<boolean> = () => Promise.resolve(true);
    doppel.lautsprecher = lautsprecher(laufzeit('wartet', 'not_activated'), vi.fn(() => tonAktivieren()));
    const r = zeige(<HallStatusZeile tournamentId="t1" nurStoerungen />);
    expect(buttons()).toEqual(['Ton nicht aktiv – hier klicken']);
    tonAktivieren = () => { doppel.lautsprecher = lautsprecher(laufzeit('toent', 'ready')); return Promise.resolve(true); };
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Ton nicht aktiv – hier klicken' })); await Promise.resolve(); });
    r.rerender(huelle(<HallStatusZeile tournamentId="t1" nurStoerungen />));
    expect(screen.queryByTestId('hallenton-status-zeile')).toBeNull();
  });
  it('@HT-059 Zeile 5: Feld 1 bereit → im Cockpit keine Zeile, in der Verwaltung weiter „Lautsprecher Feld 1 bereit“ (@HT-045)', () => {
    doppel.status = status({ 1: bereit });
    const cockpit = zeige(<HallStatusZeile tournamentId="t1" nurStoerungen />);
    expect(screen.queryByTestId('hallenton-status-zeile')).toBeNull();
    cockpit.unmount();
    zeige(<HallStatusZeile tournamentId="t1" />);
    expect(buttons()).toEqual(['Lautsprecher Feld 1 bereit']);
  });
  it('@HT-059 Zeile 6: Feld 1 bereit, dieses Handy ist selbst Lautsprecher → keine Zeile, und der Streifen (@HT-012) erscheint nicht ersatzweise', () => {
    geraet.einschaltung = { turnierId: 't1', felder: [1], name: 'Handy Tom' };
    doppel.status = status({ 1: bereit });
    doppel.lautsprecher = lautsprecher(laufzeit('toent', 'ready'));
    zeige(<><HallStatusZeile tournamentId="t1" nurStoerungen /><HallGeraetStreifen /></>);
    expect(screen.queryByTestId('hallenton-status-zeile')).toBeNull();
    expect(screen.queryByTestId('hallenton-geraet-streifen')).toBeNull();
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(hatStatusZeileHost('t1')).toBe(true);
  });
});

describe('@HT-059 Gegenbeispiele und Grenzen', () => {
  it('ohne die Eigenschaft bleibt alles wie in @HT-045: bereit, Hinweis und Störung stehen', () => {
    doppel.status = status({ 1: bereit, 2: nichtBereit });
    zeige(<HallStatusZeile tournamentId="t1" />);
    expect(buttons()).toEqual(['Lautsprecher Feld 2 nicht bereit', 'Lautsprecher Feld 1 bereit']);
  });
  it('H4-18 „Lautsprecher: Status unbekannt“ (Verwaltung ohne Netz) steht im Cockpit nicht, in der Verwaltung weiter (@HT-041)', () => {
    doppel.status = status({}, 'unbekannt', true);
    const cockpit = zeige(<HallStatusZeile tournamentId="t1" nurStoerungen />);
    expect(screen.queryByTestId('hallenton-status-zeile')).toBeNull();
    cockpit.unmount();
    zeige(<HallStatusZeile tournamentId="t1" />);
    expect(buttons()).toEqual(['Lautsprecher: Status unbekannt']);
  });
  it('„Feld 1: Handy ohne Netz“ bleibt im Cockpit stehen, „Feld 1 bereit“ daneben entfällt', () => {
    doppel.status = {
      ...status({ 1: bereit }),
      antwort: { sicht: 'voll', serverNow: 1, closed: false, speakers: [], leads: [{ field: 1, ageMs: 40_000 }], settings: { halftimeSound: 'horn-1', halftimeCustomPath: null, endCustomPath: null, goalToneFields: [], goalAnthemPaths: [] } } as never,
    };
    doppel.angepfiffen = new Set([1]);
    zeige(<HallStatusZeile tournamentId="t1" nurStoerungen />);
    expect(buttons()).toEqual(['Feld 1: Handy ohne Netz']);
  });
  it('„Feld 1 nicht bereit – keine Verbindung“ am eigenen Gerät bleibt im Cockpit stehen', () => {
    geraet.einschaltung = { turnierId: 't1', felder: [1], name: 'Handy Tom' };
    doppel.status = status({ 1: bereit });
    doppel.lautsprecher = lautsprecher(laufzeit('toent', 'keineVerbindung'));
    zeige(<HallStatusZeile tournamentId="t1" nurStoerungen />);
    expect(buttons()).toHaveLength(1);
    expect(buttons()[0]).toMatch(/nicht bereit – keine Verbindung$/);
  });
  it('der Hinweis „Lautsprecher läuft schon in einem anderen Fenster“ (rang „hinweis“) entfällt im Cockpit, in der Verwaltung steht er', () => {
    const anzeige = hallAnzeige({
      server: { stand: 'laedt', felder: {}, antwort: null }, lokal: { felder: [1], rolle: 'andererTab', zustandJeFeld: { 'field-1': 'ready' } },
      angepfiffen: new Set<number>(), lautsprecherBekannt: false, anderesFensterTont: true,
    });
    const ansicht = (nurStoerungen: boolean) => huelle(<HallStatusZeileAnsicht anzeige={anzeige} tournamentId="t1" tonAktivieren={() => undefined} nurStoerungen={nurStoerungen} />);
    const verwaltung = render(ansicht(false));
    expect(buttons()).toEqual(['Lautsprecher läuft schon in einem anderen Fenster']);
    verwaltung.unmount();
    render(ansicht(true));
    expect(screen.queryByTestId('hallenton-status-zeile')).toBeNull();
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });
  it('@HT-057 der Störungseintrag „abgemeldet“ bleibt im Cockpit stehen, „bereit“ daneben entfällt', () => {
    doppel.status = status({ 1: bereit });
    doppel.lautsprecher = { ...lautsprecher(null), abgeloest: { felder: [{ feld: 1, art: 'abgemeldet' }], um: 1 } } as unknown as HallLautsprecher;
    zeige(<HallStatusZeile tournamentId="t1" nurStoerungen />);
    expect(buttons()).toHaveLength(1);
    expect(buttons()[0]).toBe(de.statuszeile.abgemeldet.replace('{{feld}}', '1'));
    expect(document.body.textContent).not.toContain('bereit');
  });
  it('die Probe (rang „probe“) läuft unverändert durch, „bereit“ daneben entfällt', () => {
    doppel.status = status({ 1: bereit });
    zeige(<HallStatusZeile tournamentId="t1" nurStoerungen probe={probe} />);
    expect(buttons()).toEqual(['Probe läuft']);
  });
  it('Störung vor Probe, die Reihenfolge bleibt', () => {
    doppel.status = status({ 1: nichtBereit });
    zeige(<HallStatusZeile tournamentId="t1" nurStoerungen probe={probe} />);
    expect(buttons()).toEqual(['Lautsprecher Feld 1 nicht bereit', 'Probe läuft']);
  });
  it('die Kopfzeile bleibt Host, auch wenn die Zeile leer ist (kein Streifen daneben)', () => {
    doppel.status = status({ 1: bereit });
    const r = zeige(<HallStatusZeile tournamentId="t1" nurStoerungen />);
    expect(hatStatusZeileHost('t1')).toBe(true);
    r.unmount();
    expect(hatStatusZeileHost('t1')).toBe(false);
  });
});
