/**
 * H4-18 @HT-059: Kopf und Kasten zusammen. Der ECHTE `ManagementTabKopf` (mit echtem `CockpitSlimHeader` und echter `HallStatusZeile`) und der ECHTE
 * `CockpitHallHinweis` (der Kasten „Hallen-Lautsprecher aus – Ende selbst anzeigen“ unter der Tafel) stehen in verschiedenen Teilbäumen, wie im Cockpit.
 * Je Beispielzeile von @HT-059 (zehn) ein Test; dazu die Gegenbeispiele: der Kasten wird nicht gezeigt → die Pille bleibt, der Kasten verschwindet → die
 * Pille steht wieder da, anderes Feld, eigenes Gerät für Feld 1 UND 2. Nie darf eine Störung nirgends stehen. Die Prüfstand-Specs (Playwright) laufen in
 * der CI nicht, dieser Test schon. Hooks sind Doppel; Texte aus den echten deutschen Sprachdateien.
 */
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import common from '../../../../i18n/locales/de/common.json';
import de from '../../../../i18n/locales/de/hallenton.json';
import type { CockpitZustand } from '../../../../components/live-cockpit/model/cockpitPhase';
import type { Tournament } from '../../../../types/tournament';
import type { HallLautsprecher } from '../../useHallLautsprecher';
import type { HallStatus } from '../../useHallStatus';
import type { LautsprecherLage } from '../../runtime/hallStatusAuswertung';
import type { LaufzeitSnapshot } from '../../runtime/HallLautsprecherLaufzeit';

vi.mock('react-i18next', () => ({
  useTranslation: (ns: string) => ({
    i18n: { language: 'de' },
    t: (key: string, opts?: Record<string, unknown>) => {
      const quelle = ns === 'common' ? common : de;
      const wert = key.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], quelle);
      const text = typeof wert === 'string' ? wert : `FEHLT:${key}`;
      return text.replace(/\{\{(\w+)\}\}/g, (_, n: string) => String(opts?.[n] ?? `{{${n}}}`));
    },
  }),
}));
vi.mock('../../../../components/live-cockpit/frame/ConnectionPill', () => ({ ConnectionPill: () => <span data-testid="verbindung" /> }));
vi.mock('../../../klaerungsliste/KlaerungslisteEinstieg', () => ({ KLAERUNG_IM_COCKPIT_KOPF: false, KlaerungslisteEinstieg: () => null }));
vi.mock('../../../../hooks/useBreakpoint', () => ({ useBreakpoint: () => ({ isMobile: true, isTablet: false, isDesktop: false, width: 360 }) }));
vi.mock('../../../auth/hooks/useAuth', () => ({ useAuth: () => ({ reconnect: vi.fn() }) }));
vi.mock('../../../match-engine/useResyncNow', () => ({ useResyncNow: () => vi.fn() }));
vi.mock('../../useUhrAbgeglichen', () => ({ useUhrAbgeglichen: () => true }));

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
import { ManagementTabKopf } from '../../../tournament-management/components/ManagementTabKopf';
import { CockpitHallHinweis } from '../CockpitHallHinweis';
import { HallGeraetStreifen } from '../HallGeraetStreifen';
import { HallStatusZeile } from '../HallStatusZeile';

const turnier = { id: 't1', title: 'Hallencup Süd', numberOfFields: 2, matches: [], teams: [] } as unknown as Tournament;
const bereit: LautsprecherLage = { art: 'bereit', pruefen: false };
const nichtBereit: LautsprecherLage = { art: 'nichtBereit', grund: 'background', pruefen: false };
const ohneTon: LautsprecherLage = { art: 'nichtBereit', grund: 'not_activated', pruefen: false };
const status = (felder: Record<number, LautsprecherLage>, stand: HallStatus['stand'] = 'aktuell'): HallStatus => ({
  stand, antwort: null, felder, lautsprecherBekannt: true, letzteSprecher: [], testtonAnfordern: vi.fn(), gehoert: vi.fn(),
});
const laufzeit = (felder: number[], zustand: string): LaufzeitSnapshot => ({
  rolle: 'wartet', turnierId: 't1', felder, geraeteZustand: 'ready', zustandJeFeld: Object.fromEntries(felder.map((f) => [`field-${f}`, zustand])) as never,
  naechsterTon: null, taktFehler: false, warAngehalten: false, verfuegbarkeit: null,
});
/** Dieses Gerät ist Lautsprecher für die Felder (mit Zustand) – Einschaltung und Laufzeit passend dazu. */
const eigenesGeraet = (felder: number[], zustand: string, tonAktivieren = vi.fn(() => Promise.resolve(true))): void => {
  geraet.einschaltung = { turnierId: 't1', felder, name: 'Handy Tom' };
  doppel.lautsprecher = { rolle: 'diesesTurnier', felder, name: 'Handy Tom', laufzeit: laufzeit(felder, zustand), tonAktivieren, abgeloest: null } as unknown as HallLautsprecher;
};
const huelle = (ui: React.ReactElement) => <AuthContext.Provider value={{} as never}><MemoryRouter>{ui}</MemoryRouter></AuthContext.Provider>;
/** Das Cockpit von Feld `feld`: der schmale Kopf mit der Statuszeile UND der Kasten unter der Tafel. */
const cockpit = (o: { feld?: number; zustand?: CockpitZustand; kannSteuern?: boolean; verdeckt?: boolean } = {}) => {
  const feld = o.feld ?? 1;
  return (
    <>
      <ManagementTabKopf tournament={turnier} feld={feld} onFeld={() => undefined} halter={{}} onTastenkuerzel={() => undefined} />
      <CockpitHallHinweis tournamentId="t1" feldId={`field-${feld}`} zustand={o.zustand ?? 'laeuft'} kannSteuern={o.kannSteuern ?? true} verdeckt={o.verdeckt ?? false} />
    </>
  );
};
const zeige = (ui: React.ReactElement) => render(huelle(ui));
const kopfText = (): string | null => screen.queryByTestId('hallenton-status-zeile')?.textContent ?? null;
const pillen = (): string[] => (screen.queryByTestId('hallenton-status-zeile') === null ? [] : within(screen.getByTestId('hallenton-status-zeile')).getAllByRole('button').map((b) => b.textContent ?? ''));
const KASTEN = 'cockpit-hall-aus';

beforeEach(() => {
  doppel.angepfiffen = new Set<number>();
  doppel.status = status({});
  doppel.lautsprecher = { rolle: 'keiner', felder: [], name: null, laufzeit: null, tonAktivieren: vi.fn(), abgeloest: null } as unknown as HallLautsprecher;
  geraet.einschaltung = null;
});

describe('@HT-059 Cockpit-Kopf und Kasten unter der Tafel: jede Störung genau einmal (zehn Beispielzeilen)', () => {
  it('@HT-059 Zeile 1: Feld 1 bereit → keine Statuszeile, kein Kasten', () => {
    doppel.status = status({ 1: bereit });
    zeige(cockpit());
    expect(kopfText()).toBeNull();
    expect(screen.queryByTestId(KASTEN)).toBeNull();
  });
  it('@HT-059 Zeile 2: Feld 1 bereit mit „Prüfen“ → keine Statuszeile; in der Verwaltung steht die Pille weiter (@HT-047)', () => {
    doppel.status = status({ 1: { art: 'bereit', pruefen: true } });
    const r = zeige(cockpit());
    expect(kopfText()).toBeNull();
    r.unmount();
    zeige(<HallStatusZeile tournamentId="t1" />);
    expect(pillen()).toEqual(['Lautsprecher Feld 1 bereit', 'Prüfen']);
  });
  it('@HT-059 Zeile 3: Feld 1 bereit, Feld 2 nicht bereit → nur die Pille „Lautsprecher Feld 2 nicht bereit“ (Cockpit von Feld 1, kein Kasten dort)', () => {
    doppel.status = status({ 1: bereit, 2: nichtBereit });
    zeige(cockpit());
    expect(pillen()).toEqual(['Lautsprecher Feld 2 nicht bereit']);
    expect(screen.queryByTestId(KASTEN)).toBeNull();
    expect(document.body.textContent).not.toContain('Feld 1 bereit');
  });
  it('@HT-059 Zeile 4: dieses Handy ist Lautsprecher für Feld 1, Ton nicht aktiviert → keine Pille; der Kasten mit „Ton aktivieren“ steht unter der Tafel (@HT-039)', () => {
    doppel.status = status({ 1: ohneTon });
    eigenesGeraet([1], 'not_activated');
    zeige(cockpit());
    expect(kopfText()).toBeNull();
    expect(screen.getByTestId(KASTEN)).toHaveTextContent('Hallen-Lautsprecher aus – Ende selbst anzeigen');
    expect(screen.getByTestId('cockpit-hall-ton-aktivieren')).toBeInTheDocument();
  });
  it('@HT-059 Zeile 5: dieses Handy ist Lautsprecher nur für Feld 2, Ton nicht aktiviert (Cockpit von Feld 1) → Pille „Ton nicht aktiv – hier klicken“; ein Tipp aktiviert den Ton', async () => {
    doppel.status = status({ 1: bereit, 2: ohneTon });
    const aktivieren = vi.fn(() => Promise.resolve(true));
    eigenesGeraet([2], 'not_activated', aktivieren);
    zeige(cockpit());
    expect(pillen()).toEqual(['Ton nicht aktiv – hier klicken']);
    expect(screen.queryByTestId(KASTEN)).toBeNull();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Ton nicht aktiv – hier klicken' })); await Promise.resolve(); });
    expect(aktivieren).toHaveBeenCalledTimes(1);
  });
  it('@HT-059 Zeile 6: der Lautsprecher von Feld 1 ist nicht bereit → keine Statuszeile; der Kasten mit dem Grund steht unter der Tafel (@HT-039)', () => {
    doppel.status = status({ 1: nichtBereit });
    zeige(cockpit());
    expect(kopfText()).toBeNull();
    expect(screen.getByTestId(KASTEN)).toHaveTextContent('Hallen-Lautsprecher aus – Ende selbst anzeigen');
    expect(screen.getByTestId(KASTEN)).toHaveTextContent('Grund: Hintergrund');
  });
  it('@HT-059 Zeile 7: die Lautsprecher von Feld 1 und Feld 2 sind nicht bereit → nur die Pille „Lautsprecher Feld 2 nicht bereit“; für Feld 1 steht der Kasten', () => {
    doppel.status = status({ 1: nichtBereit, 2: nichtBereit });
    zeige(cockpit());
    expect(pillen()).toEqual(['Lautsprecher Feld 2 nicht bereit']);
    expect(screen.getByTestId(KASTEN)).toBeInTheDocument();
  });
  it('@HT-059 Zeile 8 (Leibchen-Wahl): der Lautsprecher von Feld 1 ist nicht bereit, die Wahl verdeckt den Kasten → die Pille „Lautsprecher Feld 1 nicht bereit“ steht; schließt Olli die Wahl, steht wieder nur der Kasten', () => {
    doppel.status = status({ 1: nichtBereit });
    const r = zeige(cockpit({ verdeckt: true }));
    expect(pillen()).toEqual(['Lautsprecher Feld 1 nicht bereit']);
    r.rerender(huelle(cockpit({ verdeckt: false })));
    expect(kopfText()).toBeNull();
    expect(screen.getByTestId(KASTEN)).toBeInTheDocument();
    r.rerender(huelle(cockpit({ verdeckt: true })));
    expect(pillen()).toEqual(['Lautsprecher Feld 1 nicht bereit']);
  });
  it('@HT-059 Zeile 9 (schlafen gelegt): eigenes Gerät für Feld 1, vom Browser schlafen gelegt → der Kasten nennt den Grund ohne Taste, die Pille „Ton aktivieren“ bleibt und aktiviert', async () => {
    doppel.status = status({ 1: { art: 'nichtBereit', grund: 'slept', pruefen: false } });
    const aktivieren = vi.fn(() => Promise.resolve(true));
    eigenesGeraet([1], 'slept', aktivieren);
    zeige(cockpit());
    expect(screen.getByTestId(KASTEN)).toHaveTextContent('Grund: schlafen gelegt');
    expect(screen.queryByTestId('cockpit-hall-ton-aktivieren')).toBeNull();
    expect(pillen()).toHaveLength(1);
    await act(async () => { fireEvent.click(within(screen.getByTestId('hallenton-status-zeile')).getByRole('button')); await Promise.resolve(); });
    expect(aktivieren).toHaveBeenCalledTimes(1);
  });
  it('G1: der Kasten zeigt (noch) einen anderen Grund ohne Taste, lokal steht „Ton nicht aktiv“ → die Pille bleibt', () => {
    doppel.status = status({ 1: nichtBereit });
    eigenesGeraet([1], 'not_activated');
    zeige(cockpit());
    expect(screen.getByTestId(KASTEN)).toHaveTextContent('Grund: Hintergrund');
    expect(screen.queryByTestId('cockpit-hall-ton-aktivieren')).toBeNull();
    expect(pillen()).toEqual(['Ton nicht aktiv – hier klicken']);
  });
  it('Feld 1 und 2 am eigenen Gerät (Feld 1 ohne Ton, Feld 2 schlafen gelegt) → „Ton nicht aktiv“ bleibt', () => {
    doppel.status = status({ 1: ohneTon, 2: { art: 'nichtBereit', grund: 'slept', pruefen: false } });
    const aktivieren = vi.fn(() => Promise.resolve(true));
    eigenesGeraet([1, 2], 'not_activated', aktivieren);
    doppel.lautsprecher = { ...doppel.lautsprecher, laufzeit: { ...laufzeit([1, 2], 'not_activated'), zustandJeFeld: { 'field-1': 'not_activated', 'field-2': 'slept' } } } as unknown as HallLautsprecher;
    zeige(cockpit());
    expect(screen.getByTestId(KASTEN)).toBeInTheDocument();
    expect(pillen()).toContain('Ton nicht aktiv – hier klicken');
  });
  it('@HT-059 Zeile 8: Ollis Handy hat kein Netz → im Cockpit keine Statuszeile, auch nicht „Status unbekannt“; in der Verwaltung steht sie weiter (@HT-041)', () => {
    doppel.status = status({}, 'unbekannt');
    const r = zeige(cockpit());
    expect(kopfText()).toBeNull();
    expect(document.body.textContent).not.toContain('Status unbekannt');
    r.unmount();
    zeige(<HallStatusZeile tournamentId="t1" />);
    expect(pillen()).toEqual(['Lautsprecher: Status unbekannt']);
  });
  it('@HT-059 Zeile 9: Feld 1 bereit, Olli wechselt in die Verwaltung → im Cockpit keine Zeile, in der Verwaltung weiter „Lautsprecher Feld 1 bereit“ (@HT-045)', () => {
    doppel.status = status({ 1: bereit });
    const r = zeige(cockpit());
    expect(kopfText()).toBeNull();
    r.unmount();
    zeige(<HallStatusZeile tournamentId="t1" />);
    expect(pillen()).toEqual(['Lautsprecher Feld 1 bereit']);
  });
  it('@HT-059 Zeile 10: Feld 1 bereit, dieses Handy ist selbst Lautsprecher → keine Zeile, und der Streifen (@HT-012) erscheint nicht ersatzweise', () => {
    doppel.status = status({ 1: bereit });
    eigenesGeraet([1], 'ready');
    zeige(<>{cockpit()}<HallGeraetStreifen /></>);
    expect(kopfText()).toBeNull();
    expect(screen.queryByTestId('hallenton-geraet-streifen')).toBeNull();
    expect(screen.queryByTestId(KASTEN)).toBeNull();
  });
});

describe('@HT-059 Gegenbeispiele: nur wenn der Kasten wirklich steht, entfällt die Pille – nie steht eine Störung nirgends', () => {
  it('kein Spiel am Feld (kein Kasten) → die Pille „Lautsprecher Feld 1 nicht bereit“ bleibt', () => {
    doppel.status = status({ 1: nichtBereit });
    zeige(cockpit({ zustand: 'keinSpiel' }));
    expect(screen.queryByTestId(KASTEN)).toBeNull();
    expect(pillen()).toEqual(['Lautsprecher Feld 1 nicht bereit']);
  });
  it('kein Steuerrecht (kein Kasten) → die Pille bleibt', () => {
    doppel.status = status({ 1: nichtBereit });
    zeige(cockpit({ kannSteuern: false }));
    expect(screen.queryByTestId(KASTEN)).toBeNull();
    expect(pillen()).toEqual(['Lautsprecher Feld 1 nicht bereit']);
  });
  it('der Kasten steht für ein anderes Feld (Cockpit von Feld 2) → die Pille für Feld 1 bleibt, die für Feld 2 entfällt', () => {
    doppel.status = status({ 1: nichtBereit, 2: nichtBereit });
    zeige(cockpit({ feld: 2 }));
    expect(screen.getByTestId(KASTEN)).toBeInTheDocument();
    expect(pillen()).toEqual(['Lautsprecher Feld 1 nicht bereit']);
  });
  it('der Kasten verschwindet (Spiel abgepfiffen) → die Pille steht wieder da', () => {
    doppel.status = status({ 1: nichtBereit });
    const r = zeige(cockpit());
    expect(kopfText()).toBeNull();
    r.rerender(huelle(cockpit({ zustand: 'abgepfiffen' })));
    expect(screen.queryByTestId(KASTEN)).toBeNull();
    expect(pillen()).toEqual(['Lautsprecher Feld 1 nicht bereit']);
  });
  it('das Cockpit wird verlassen (Kasten ausgehängt) → die Pille steht im Kopf einer anderen Ansicht mit Kopfzeile', () => {
    doppel.status = status({ 1: nichtBereit });
    const r = zeige(cockpit());
    expect(kopfText()).toBeNull();
    r.rerender(huelle(<ManagementTabKopf tournament={turnier} feld={1} onFeld={() => undefined} halter={{}} onTastenkuerzel={() => undefined} />));
    expect(pillen()).toEqual(['Lautsprecher Feld 1 nicht bereit']);
  });
  it('dieses Gerät ist Lautsprecher für Feld 1 UND 2, Ton nicht aktiviert (Cockpit von Feld 1) → die Pille bleibt, der Kasten steht trotzdem', () => {
    doppel.status = status({ 1: ohneTon, 2: ohneTon });
    eigenesGeraet([1, 2], 'not_activated');
    zeige(cockpit());
    expect(screen.getByTestId(KASTEN)).toBeInTheDocument();
    expect(pillen()).toEqual(['Ton nicht aktiv – hier klicken']);
  });
  it('dieses Gerät tönt schon für Feld 1 (am Gerät gilt der lokale Zustand), der Server-Stand zieht noch nicht nach → der Kasten tritt zurück, und auch im Kopf steht keine Störung', () => {
    doppel.status = status({ 1: ohneTon });
    eigenesGeraet([1], 'ready');
    zeige(cockpit());
    expect(screen.queryByTestId(KASTEN)).toBeNull();
    expect(kopfText()).toBeNull();
  });
  it('@HT-057 „abgemeldet“ und „Handy ohne Netz“ bleiben im Cockpit-Kopf neben dem Kasten stehen', () => {
    doppel.status = { ...status({ 1: nichtBereit }), antwort: { sicht: 'voll', serverNow: 1, closed: false, speakers: [], leads: [{ field: 1, ageMs: 40_000 }], settings: { halftimeSound: 'horn-1', halftimeCustomPath: null, endCustomPath: null, goalToneFields: [], goalAnthemPaths: [] } } as never };
    doppel.angepfiffen = new Set([1]);
    doppel.lautsprecher = { rolle: 'keiner', felder: [], name: null, laufzeit: null, tonAktivieren: vi.fn(), abgeloest: { felder: [{ feld: 1, art: 'abgemeldet' }], um: 1 } } as unknown as HallLautsprecher;
    zeige(cockpit());
    expect(screen.getByTestId(KASTEN)).toBeInTheDocument();
    expect(pillen()).toEqual(['Feld 1: Handy ohne Netz', de.statuszeile.abgemeldet.replace('{{feld}}', '1')]);
  });
});
