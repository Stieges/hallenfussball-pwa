/**
 * H4-11b Fixrunde 1 – kein stilles Verschwinden der Rolle (@HT-057 Herkunftszeile, @HT-012, @HT-041): Hat die Turnierleitung DIESES Gerät als Hallen-Lautsprecher abgemeldet, steht in jeder
 * Ansicht dieses Geräts ein Eintrag „Feld 1: als Hallen-Lautsprecher abgemeldet“ (Rang Störung, Ziel Unterpunkt „Hallenton“), bis „Verstanden“ getippt ist – in der Verwaltung (Kopf), im Cockpit
 * (schmaler Kopf) und in einer Ansicht ohne Kopf (Streifen). Auf anderen Geräten nie; nach „Verstanden“ weg; wurde das Gerät nur abgelöst („von einem anderen Gerät übernommen“), steht er nicht.
 * Die Hooks sind Doppel; Texte aus den echten Sprachdateien. Mit der echten Geräte-Ablage: `HallStatusZeile.abgemeldet.ablage.h4-11b.test.tsx`.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import common from '../../../../i18n/locales/de/common.json';
import cockpitDe from '../../../../i18n/locales/de/cockpit.json';
import de from '../../../../i18n/locales/de/hallenton.json';

vi.mock('react-i18next', () => ({
  useTranslation: (ns: string) => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      const quelle = ns === 'common' ? common : ns === 'cockpit' ? cockpitDe : de;
      const wert = key.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], quelle);
      const text = typeof wert === 'string' ? wert : `FEHLT:${key}`;
      return text.replace(/\{\{(\w+)\}\}/g, (_, n: string) => String(opts?.[n] ?? `{{${n}}}`));
    },
  }),
}));

type Marke = { turnierId: string; felder: Array<{ feld: number; art: 'abgeloest' | 'abgemeldet' }>; um: number } | null;
const doppel = vi.hoisted((): { darf: boolean; kiosk: boolean; marke: unknown; stand: unknown; status: unknown; lautsprecher: unknown } => ({ darf: true, kiosk: false, marke: null, stand: { einschaltung: null, abgeloest: null }, status: null, lautsprecher: null }));
vi.mock('../../../auth/hooks/useCan', () => ({ useCan: () => doppel.darf }));
vi.mock('../../../../hooks/useKioskRoute', () => ({ useKioskRoute: () => doppel.kiosk }));
vi.mock('../../../../hooks/useBreakpoint', () => ({ useBreakpoint: () => ({ isMobile: true }) }));
vi.mock('../../useHallStatus', () => ({ useHallStatus: () => doppel.status }));
vi.mock('../../useLaufendeSpiele', () => ({ useLaufendeSpiele: () => new Map<number, number>() }));
vi.mock('../../useHallLautsprecher', () => ({ useHallLautsprecher: () => doppel.lautsprecher }));
vi.mock('../../lautsprecherGeraet', () => ({
  geraetStand: () => doppel.stand,
  abonniereGeraet: () => () => undefined,
}));

import { AuthContext } from '../../../auth/context/authContextInstance';
import { CockpitSlimHeader } from '../../../../components/live-cockpit/frame/CockpitSlimHeader';
import { HallGeraetStreifen } from '../HallGeraetStreifen';
import { HallStatusZeile } from '../HallStatusZeile';
import { baueStatusEintraege, hallentonZiel } from '../hallStatusEintraege';

const T1 = 't1';
const ABGEMELDET = 'Feld 1: als Hallen-Lautsprecher abgemeldet';
const setzeMarke = (m: Marke): void => {
  doppel.marke = m;
  doppel.stand = { einschaltung: null, abgeloest: m }; // stabiles Objekt je Stand (useSyncExternalStore)
  doppel.lautsprecher = { rolle: 'keiner', felder: [], name: null, laufzeit: null, abgeloest: m, tonAktivieren: vi.fn(() => Promise.resolve(true)) };
};
const marke = (...felder: Array<[number, 'abgeloest' | 'abgemeldet']>): Marke => ({ turnierId: T1, felder: felder.map(([feld, art]) => ({ feld, art })), um: 1 });
const Ort = () => <span data-testid="ort">{useLocation().pathname}</span>;
const zeige = (ui: React.ReactElement) => render(<AuthContext.Provider value={{} as never}><MemoryRouter>{ui}<Ort /></MemoryRouter></AuthContext.Provider>);
const texte = () => screen.queryAllByRole('button').map((b) => b.textContent);

beforeEach(() => {
  doppel.darf = true; doppel.kiosk = false;
  doppel.status = { stand: 'aktuell', antwort: null, felder: {}, lautsprecherBekannt: false, testtonAnfordern: vi.fn(), gehoert: vi.fn() };
  setzeMarke(null);
});

describe('@HT-057 Eintrag „abgemeldet“ in der Verwaltung (Ansicht mit Kopf)', () => {
  it('Marke „abgemeldet“ für Feld 1 → die Zeile zeigt „Feld 1: als Hallen-Lautsprecher abgemeldet“; ein Klick führt zum Unterpunkt „Hallenton“', () => {
    setzeMarke(marke([1, 'abgemeldet']));
    zeige(<HallStatusZeile tournamentId={T1} />);
    expect(texte()).toEqual([ABGEMELDET]);
    fireEvent.click(screen.getByRole('button', { name: ABGEMELDET }));
    expect(screen.getByTestId('ort')).toHaveTextContent(hallentonZiel(T1));
  });
  it('der Eintrag hat den Rang einer Störung: er steht vor „bereit“ des anderen Felds', () => {
    doppel.status = { stand: 'aktuell', antwort: null, felder: { 2: { art: 'bereit', pruefen: false } }, lautsprecherBekannt: true, testtonAnfordern: vi.fn(), gehoert: vi.fn() };
    setzeMarke(marke([1, 'abgemeldet']));
    zeige(<HallStatusZeile tournamentId={T1} />);
    expect(texte()).toEqual([ABGEMELDET, 'Lautsprecher Feld 2 bereit']);
  });
  it('mehrere Felder: „Feld 1, 2: …“; nur die abgemeldeten, nicht die übernommenen', () => {
    setzeMarke(marke([1, 'abgemeldet'], [2, 'abgemeldet'], [3, 'abgeloest']));
    zeige(<HallStatusZeile tournamentId={T1} />);
    expect(texte()).toEqual(['Feld 1, 2: als Hallen-Lautsprecher abgemeldet']);
  });
  it('Gegenbeispiel Wettlauf: B hat übernommen (Marke „abgeloest“) → kein Eintrag „abgemeldet“', () => {
    setzeMarke(marke([1, 'abgeloest']));
    zeige(<HallStatusZeile tournamentId={T1} />);
    expect(screen.queryByTestId('hallenton-status-zeile')).toBeNull();
    expect(document.body.textContent).not.toContain('abgemeldet');
  });
  it('Gegenbeispiel: nach „Verstanden“ (keine Marke) steht nichts mehr', () => {
    setzeMarke(marke([1, 'abgemeldet']));
    const r = zeige(<HallStatusZeile tournamentId={T1} />);
    expect(screen.getByTestId('hallenton-status-zeile')).toBeInTheDocument();
    setzeMarke(null);
    r.rerender(<AuthContext.Provider value={{} as never}><MemoryRouter><HallStatusZeile tournamentId={T1} /></MemoryRouter></AuthContext.Provider>);
    expect(screen.queryByTestId('hallenton-status-zeile')).toBeNull();
  });
  it('Gegenbeispiel: ein anderes Gerät (keine Marke in dessen Ablage) sieht ihn nicht', () => {
    setzeMarke(null);
    doppel.status = { stand: 'aktuell', antwort: null, felder: { 1: { art: 'bereit', pruefen: false } }, lautsprecherBekannt: true, testtonAnfordern: vi.fn(), gehoert: vi.fn() };
    zeige(<HallStatusZeile tournamentId={T1} />);
    expect(texte()).toEqual(['Lautsprecher Feld 1 bereit']);
  });
  it('die Marke eines anderen Turniers erscheint hier nicht (der Hook liefert sie nur für dieses Turnier)', () => {
    setzeMarke(null);
    doppel.marke = { turnierId: 't2', felder: [{ feld: 1, art: 'abgemeldet' }], um: 1 };
    doppel.stand = { einschaltung: null, abgeloest: doppel.marke };
    zeige(<HallStatusZeile tournamentId={T1} />);
    expect(screen.queryByTestId('hallenton-status-zeile')).toBeNull();
  });
  it('im Unterpunkt „Hallenton“ selbst (ohneLautsprecher) steht er nicht doppelt: dort steht der Hinweis mit „Verstanden“', () => {
    setzeMarke(marke([1, 'abgemeldet']));
    zeige(<HallStatusZeile tournamentId={T1} ohneLautsprecher />);
    expect(screen.queryByTestId('hallenton-status-zeile')).toBeNull();
  });
  it('ohne manageScreens (Helfer) keine Zeile', () => {
    doppel.darf = false;
    setzeMarke(marke([1, 'abgemeldet']));
    zeige(<HallStatusZeile tournamentId={T1} />);
    expect(screen.queryByTestId('hallenton-status-zeile')).toBeNull();
  });
});

describe('@HT-057 Eintrag „abgemeldet“ im Cockpit (schmaler Kopf)', () => {
  const kopf = <CockpitSlimHeader tournamentId={T1} turnierName="Hallencup Süd" felder={1} feld={1} onFeld={() => undefined} verbindung={null} statuszeile={<HallStatusZeile tournamentId={T1} />} />;
  it('im schmalen Kopf des Cockpits steht der Eintrag unter dem Kopf', () => {
    setzeMarke(marke([1, 'abgemeldet']));
    zeige(kopf);
    expect(screen.getByTestId('hallenton-status-zeile')).toHaveTextContent(ABGEMELDET);
  });
  it('die Kurzform für schmale Breite ist „Feld 1 abgemeldet“ (der Eintrag liefert `kurz` und `lesetext`)', () => {
    const t = ((key: string, o?: Record<string, unknown>) => (de.statuszeile as Record<string, string>)[key.replace('statuszeile.', '')].replace('{{feld}}', String(o?.feld))) as never;
    const eintraege = baueStatusEintraege({ felder: [], handyOhneNetz: [], statusUnbekannt: false }, { t, ziel: '/x', tonAktivieren: () => undefined, abgemeldet: [1] });
    expect(eintraege).toHaveLength(1);
    expect(eintraege[0]).toMatchObject({ id: 'abgemeldet', rang: 'stoerung', kurz: 'Feld 1 abgemeldet', lesetext: ABGEMELDET, text: ABGEMELDET });
  });
  it('Gegenbeispiel: ohne Marke nichts', () => {
    zeige(kopf);
    expect(screen.queryByTestId('hallenton-status-zeile')).toBeNull();
  });
});

describe('@HT-057 Eintrag „abgemeldet“ in Ansichten ohne Kopf (Streifen)', () => {
  it('die Rolle ist weg, die Marke „abgemeldet“ steht → der Streifen zeigt den Eintrag, obwohl dieses Gerät kein Lautsprecher mehr ist', () => {
    setzeMarke(marke([1, 'abgemeldet']));
    zeige(<HallGeraetStreifen />);
    expect(screen.getByTestId('hallenton-geraet-streifen')).toHaveTextContent(ABGEMELDET);
  });
  it('Gegenbeispiel Wettlauf: Marke „abgeloest“ → kein Streifen', () => {
    setzeMarke(marke([1, 'abgeloest']));
    zeige(<HallGeraetStreifen />);
    expect(screen.queryByTestId('hallenton-geraet-streifen')).toBeNull();
  });
  it('Gegenbeispiel: ohne Marke und ohne Lautsprecher-Rolle kein Streifen; auf Kiosk-Routen (Monitor) auch bei Marke keiner (@ME-003)', () => {
    zeige(<HallGeraetStreifen />);
    expect(screen.queryByTestId('hallenton-geraet-streifen')).toBeNull();
    setzeMarke(marke([1, 'abgemeldet']));
    doppel.kiosk = true;
    zeige(<HallGeraetStreifen />);
    expect(screen.queryByTestId('hallenton-geraet-streifen')).toBeNull();
  });
  it('mit Kopfzeile als Host steht der Eintrag genau einmal (der Streifen bleibt aus)', () => {
    setzeMarke(marke([1, 'abgemeldet']));
    zeige(<><HallStatusZeile tournamentId={T1} /><HallGeraetStreifen /></>);
    expect(screen.queryByTestId('hallenton-geraet-streifen')).toBeNull();
    expect(screen.getAllByText(ABGEMELDET)).toHaveLength(1);
  });
});
