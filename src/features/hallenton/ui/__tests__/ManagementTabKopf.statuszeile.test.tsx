/**
 * @HT-059 Einbaustelle: der ECHTE `ManagementTabKopf` (mit echtem `CockpitSlimHeader` und echter `HallStatusZeile`) zeigt im Cockpit-Kopf bei „Feld 1 bereit“ keine
 * Statuszeile und bei „nicht bereit“ die Pille. Fällt `nurStoerungen` im Kopf weg, wird dieser Test rot (die Prüfstand-Specs laufen in der CI nicht).
 * Die Hooks sind Doppel; Texte aus den echten deutschen Sprachdateien.
 */
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import common from '../../../../i18n/locales/de/common.json';
import de from '../../../../i18n/locales/de/hallenton.json';
import type { Tournament } from '../../../../types/tournament';
import type { HallLautsprecher } from '../../useHallLautsprecher';
import type { HallStatus } from '../../useHallStatus';
import type { LautsprecherLage } from '../../runtime/hallStatusAuswertung';

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

vi.mock('../../../../components/live-cockpit/frame/ConnectionPill', () => ({ ConnectionPill: () => <span data-testid="verbindung" /> }));
vi.mock('../../../klaerungsliste/KlaerungslisteEinstieg', () => ({ KLAERUNG_IM_COCKPIT_KOPF: false, KlaerungslisteEinstieg: () => null }));
vi.mock('../../../../hooks/useBreakpoint', () => ({ useBreakpoint: () => ({ isMobile: true, isTablet: false, isDesktop: false, width: 360 }) }));

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

const turnier = { id: 't1', title: 'Hallencup Süd', numberOfFields: 2, matches: [], teams: [] } as unknown as Tournament;
const status = (felder: Record<number, LautsprecherLage>): HallStatus => ({
  stand: 'aktuell', antwort: null, felder, lautsprecherBekannt: true, letzteSprecher: [], testtonAnfordern: vi.fn(), gehoert: vi.fn(),
});
const kopf = () => render(
  <AuthContext.Provider value={{} as never}><MemoryRouter>
    <ManagementTabKopf tournament={turnier} feld={1} onFeld={() => undefined} halter={{}} onTastenkuerzel={() => undefined} />
  </MemoryRouter></AuthContext.Provider>,
);

beforeEach(() => {
  doppel.angepfiffen = new Set<number>();
  doppel.lautsprecher = { rolle: 'keiner', felder: [], name: null, laufzeit: null, tonAktivieren: vi.fn(), abgeloest: null } as unknown as HallLautsprecher;
  geraet.einschaltung = null;
});

describe('@HT-059 ManagementTabKopf (Einbaustelle im Cockpit)', () => {
  it('Feld 1 bereit: der Kopf des Cockpits hat keine Statuszeile und kein Wort „bereit“', () => {
    doppel.status = status({ 1: { art: 'bereit', pruefen: false } });
    kopf();
    expect(screen.getByTestId('cockpit-slim-header')).toBeInTheDocument();
    expect(screen.queryByTestId('hallenton-status-zeile')).toBeNull();
    // die Statuszeile steht neben dem `<header>`, nicht darin: darum der ganze Kopfbereich, nicht nur `cockpit-slim-header`
    expect(document.body.textContent).not.toContain('bereit');
  });
  it('Feld 1 bereit, Feld 2 nicht bereit: im Kopf steht nur die Pille „Lautsprecher Feld 2 nicht bereit“', () => {
    doppel.status = status({ 1: { art: 'bereit', pruefen: false }, 2: { art: 'nichtBereit', grund: 'background', pruefen: false } });
    kopf();
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toContain('Lautsprecher Feld 2 nicht bereit');
    expect(screen.queryByText('Lautsprecher Feld 1 bereit')).toBeNull();
    expect(screen.getByTestId('hallenton-status-zeile').textContent).toBe('Lautsprecher Feld 2 nicht bereit');
  });
});
