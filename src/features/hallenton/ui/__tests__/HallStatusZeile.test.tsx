/**
 * H4-5 Adapter `HallStatusZeile` und `HallGeraetStreifen` (@HT-012, @HT-033 Zeile 8, @HT-035, @HT-038, @HT-045): Recht `manageScreens`,
 * ohne Lautsprecher keine Zeile, Reihenfolge Störung → Probe → bereit, Platz für die Probe, Streifen nur ohne Kopfzeile als Host.
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
  darf: true,
  kiosk: false,
  status: null as HallStatus | null,
  lautsprecher: null as HallLautsprecher | null,
  statusAufrufe: 0,
}));
vi.mock('../../../auth/hooks/useCan', () => ({ useCan: () => doppel.darf }));
vi.mock('../../../../hooks/useKioskRoute', () => ({ useKioskRoute: () => doppel.kiosk }));
vi.mock('../../useHallStatus', () => ({ useHallStatus: () => { doppel.statusAufrufe += 1; return doppel.status; } }));
vi.mock('../../useHallLautsprecher', () => ({ useHallLautsprecher: () => doppel.lautsprecher }));
const geraet = vi.hoisted(() => ({ einschaltung: null as { turnierId: string; felder: number[]; name: string } | null }));
vi.mock('../../lautsprecherGeraet', () => ({
  geraetStand: () => geraet,
  abonniereGeraet: () => () => undefined,
}));

import { AuthContext } from '../../../auth/context/authContextInstance';
import { HallStatusZeile } from '../HallStatusZeile';
import { HallGeraetStreifen } from '../HallGeraetStreifen';

const status = (felder: Record<number, LautsprecherLage>, stand: HallStatus['stand'] = 'aktuell'): HallStatus => ({
  stand, antwort: null, felder, testtonAnfordern: vi.fn(), gehoert: vi.fn(),
});
const laufzeit = (rolle: LaufzeitSnapshot['rolle'], zustand: string): LaufzeitSnapshot => ({
  rolle, turnierId: 't1', felder: [1], geraeteZustand: 'ready', zustandJeFeld: { 'field-1': zustand as never },
  naechsterTon: null, taktFehler: false, warAngehalten: false, verfuegbarkeit: null,
});
const lautsprecher = (l: LaufzeitSnapshot | null, tonAktivieren = vi.fn(() => Promise.resolve(true))): HallLautsprecher => ({
  rolle: l ? 'diesesTurnier' : 'keiner', felder: l ? [1] : [], name: l ? 'Laptop Turnierleitung' : null, laufzeit: l, tonAktivieren,
} as unknown as HallLautsprecher);
const probe: StatusEintrag = { id: 'probe', rang: 'probe', ton: 'info', rand: 'gestrichelt', symbol: null, text: 'Probe läuft', aktion: { art: 'navigiere', ziel: '/probe' } };
const zeige = (ui: React.ReactElement) => render(<AuthContext.Provider value={{} as never}><MemoryRouter>{ui}</MemoryRouter></AuthContext.Provider>);
const buttons = () => screen.getAllByRole('button').map((b) => b.textContent);

beforeEach(() => {
  doppel.darf = true; doppel.kiosk = false; doppel.statusAufrufe = 0;
  doppel.status = status({}); doppel.lautsprecher = lautsprecher(null);
  geraet.einschaltung = null;
});

describe('@HT-045 @HT-038 HallStatusZeile in der Kopfzeile', () => {
  it('ohne Lautsprecher im Turnier und ohne Probe: keine Zeile, nie „bereit“', () => {
    zeige(<HallStatusZeile tournamentId="t1" />);
    expect(screen.queryByTestId('hallenton-status-zeile')).toBeNull();
    expect(document.body.textContent).not.toContain('bereit');
  });
  it('Helfer (ohne manageScreens): keine Zeile, und der Server wird nicht gefragt', () => {
    doppel.darf = false;
    doppel.status = status({ 1: { art: 'bereit', pruefen: false } });
    zeige(<HallStatusZeile tournamentId="t1" />);
    expect(screen.queryByTestId('hallenton-status-zeile')).toBeNull();
    expect(doppel.statusAufrufe).toBe(0);
  });
  it('Zeile 2: Feld 1 bereit und Probe → „Probe läuft“, dann „Lautsprecher Feld 1 bereit“', () => {
    doppel.status = status({ 1: { art: 'bereit', pruefen: false } });
    zeige(<HallStatusZeile tournamentId="t1" probe={probe} />);
    expect(buttons()).toEqual(['Probe läuft', 'Lautsprecher Feld 1 bereit']);
  });
  it('Zeile 3: Feld 1 nicht bereit und Probe → Störung vor Probe', () => {
    doppel.status = status({ 1: { art: 'nichtBereit', grund: 'background', pruefen: false } });
    zeige(<HallStatusZeile tournamentId="t1" probe={probe} />);
    expect(buttons()).toEqual(['Lautsprecher Feld 1 nicht bereit', 'Probe läuft']);
  });
  it('Probe-Platzhalter: nur die Probe, kein Lautsprecher → nur „Probe läuft“', () => {
    zeige(<HallStatusZeile tournamentId="t1" probe={probe} />);
    expect(buttons()).toEqual(['Probe läuft']);
  });
  it('@HT-041 kein Netz nach bekanntem Lautsprecher → „Lautsprecher: Status unbekannt“ (nicht schon beim ersten Laden)', () => {
    doppel.status = status({ 1: { art: 'bereit', pruefen: false } });
    const r = zeige(<HallStatusZeile tournamentId="t1" />);
    doppel.status = status({}, 'unbekannt');
    r.rerender(<AuthContext.Provider value={{} as never}><MemoryRouter><HallStatusZeile tournamentId="t1" /></MemoryRouter></AuthContext.Provider>);
    expect(buttons()).toEqual(['Lautsprecher: Status unbekannt']);
  });
  it('„Prüfen“ steht neben „bereit“ in derselben Gruppe', () => {
    doppel.status = status({ 1: { art: 'bereit', pruefen: true } });
    zeige(<HallStatusZeile tournamentId="t1" />);
    expect(buttons()).toEqual(['Lautsprecher Feld 1 bereit', 'Prüfen']);
  });
  it('Im Unterpunkt „Hallenton“ (ohneLautsprecher) entfällt der Lautsprecher-Eintrag', () => {
    doppel.status = status({ 1: { art: 'nichtBereit', grund: 'background', pruefen: false } });
    zeige(<HallStatusZeile tournamentId="t1" ohneLautsprecher />);
    expect(screen.queryByTestId('hallenton-status-zeile')).toBeNull();
  });
});

describe('@HT-012 @HT-033 Zeile 8 HallGeraetStreifen (Ansichten ohne Kopf)', () => {
  beforeEach(() => { geraet.einschaltung = { turnierId: 't1', felder: [1], name: 'Laptop Turnierleitung' }; });

  it('@HT-012 ohne „Ton aktivieren“ steht „Ton nicht aktiv – hier klicken“; der Klick aktiviert den Ton dieses Tabs', () => {
    const tonAktivieren = vi.fn(() => Promise.resolve(true));
    doppel.lautsprecher = lautsprecher(laufzeit('wartet', 'not_activated'), tonAktivieren);
    zeige(<HallGeraetStreifen />);
    fireEvent.click(screen.getByRole('button', { name: 'Ton nicht aktiv – hier klicken' }));
    expect(tonAktivieren).toHaveBeenCalledTimes(1);
  });
  it('@HT-033 Zeile 8: Klick im Tab ohne Sperre → „Lautsprecher läuft schon in einem anderen Fenster“', async () => {
    let tonAktivieren: () => Promise<boolean> = () => Promise.resolve(true);
    doppel.lautsprecher = lautsprecher(laufzeit('wartet', 'not_activated'), vi.fn(() => tonAktivieren()));
    const r = zeige(<HallGeraetStreifen />);
    tonAktivieren = () => { doppel.lautsprecher = lautsprecher(laufzeit('andererTab', 'ready')); return Promise.resolve(true); };
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Ton nicht aktiv – hier klicken' })); await Promise.resolve(); });
    r.rerender(<MemoryRouter><HallGeraetStreifen /></MemoryRouter>);
    expect(buttons()).toEqual(['Lautsprecher läuft schon in einem anderen Fenster']);
  });
  it('Gegenbeispiel: eine Kopfzeile mit Statuszeile für dasselbe Turnier ist Host → der Streifen bleibt aus', () => {
    doppel.lautsprecher = lautsprecher(laufzeit('wartet', 'not_activated'));
    doppel.status = status({ 1: { art: 'bereit', pruefen: false } });
    zeige(<><HallStatusZeile tournamentId="t1" /><HallGeraetStreifen /></>);
    expect(screen.queryByTestId('hallenton-geraet-streifen')).toBeNull();
    expect(screen.getAllByTestId('hallenton-status-zeile')).toHaveLength(1);
  });
  it('Host für ein anderes Turnier ändert nichts: der Streifen des eigenen Geräts bleibt', () => {
    doppel.lautsprecher = lautsprecher(laufzeit('wartet', 'not_activated'));
    zeige(<><HallStatusZeile tournamentId="t2" /><HallGeraetStreifen /></>);
    expect(screen.getByTestId('hallenton-geraet-streifen')).toBeInTheDocument();
  });
  it('kein Lautsprecher-Gerät: kein Streifen; auf Kiosk-Routen (Monitor) auch keiner', () => {
    geraet.einschaltung = null;
    zeige(<HallGeraetStreifen />);
    expect(screen.queryByTestId('hallenton-geraet-streifen')).toBeNull();
  });
  it('Kiosk-Route: kein Streifen', () => {
    doppel.kiosk = true;
    doppel.lautsprecher = lautsprecher(laufzeit('wartet', 'not_activated'));
    zeige(<HallGeraetStreifen />);
    expect(screen.queryByTestId('hallenton-geraet-streifen')).toBeNull();
  });
});
