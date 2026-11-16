/**
 * H4-11b @HT-057, Seite des abgemeldeten Rechners (Hinweis): „Dann zeigt der Rechner „Die Turnierleitung hat dieses Gerät als Hallen-Lautsprecher für Feld 1 abgemeldet.“ mit der
 * Taste „Verstanden“ – und er zeigt nicht „von einem anderen Gerät übernommen“ – und nach „Verstanden“ verschwindet der Hinweis, auch in den anderen Fenstern des Rechners.“
 * Hier mit dem ECHTEN Hook und der echten Geräte-Ablage (`lautsprecherGeraet`, `localStorage` + `storage` wie der Browser); nur der Stand am Server und die Seite drumherum sind Doppel.
 * Dass der Rechner für Feld 1 keinen Ton mehr gibt und den Verlust als „abgemeldet“ meldet, steht in `runtime/__tests__/abmelden.geraet.h4-11b.test.ts`.
 */
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import de from '../../../../i18n/locales/de/hallenton.json';
import type { HallStatusVoll } from '../../../../core/repositories/hallentonRpc';
import { FalscherSpeicher } from '../../../../test/hallenton/falschesGeraet';
import { lautsprecherLage } from '../../runtime/hallStatusAuswertung';
import { ABGELOEST_SCHLUESSEL, __setzeGeraetFuerTests, merkeAbloesung } from '../../lautsprecherGeraet';
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
vi.mock('../../../../lib/supabase', () => ({ supabase: null, isSupabaseConfigured: false }));
const doppel = vi.hoisted(() => ({ status: null as unknown as HallStatus }));
vi.mock('../../../auth/hooks/useCan', () => ({ useCan: () => true }));
vi.mock('../../../../hooks/useTournamentClosed', () => ({ useTournamentClosed: () => false }));
vi.mock('../../useHallStatus', () => ({ useHallStatus: () => doppel.status }));
vi.mock('../../useLaufendeSpiele', () => ({ useLaufendeSpiele: () => new Map<number, number>() }));
vi.mock('../../lokalesTurnier', () => ({ ladeTurnierLokal: () => Promise.resolve(null) }));

import { HallentonSeite } from '../HallentonSeite';

const TID = 't-sued';
const SERVER_JETZT = new Date(2026, 10, 15, 14, 2, 30).getTime();
let speicher: FalscherSpeicher;

function setzeServer(sprecher: ReadonlyArray<{ feld: number; name: string }>): void {
  const antwort: HallStatusVoll = {
    sicht: 'voll', serverNow: SERVER_JETZT, closed: false, leads: [],
    settings: { halftimeSound: 'horn-1', halftimeCustomPath: null, endCustomPath: null, goalToneFields: [], goalAnthemPaths: [] },
    speakers: sprecher.map((s) => ({ field: s.feld, deviceName: s.name, isThisDevice: false, state: 'ready' as const, assignedAt: 1, outputHint: false, hintAt: null, lastSeen: null, ageMs: 3000, test: null })),
  };
  doppel.status = {
    stand: 'aktuell', antwort, felder: Object.fromEntries(antwort.speakers.map((s) => [s.field, lautsprecherLage({ state: s.state, ageMs: s.ageMs, outputHint: s.outputHint }, antwort.serverNow)])),
    lautsprecherBekannt: sprecher.length > 0, testtonAnfordern: vi.fn(), gehoert: vi.fn(),
  } as unknown as HallStatus;
}
/** Ein anderes Fenster des Rechners hat den Schlüssel geändert: der Browser meldet es als `storage`-Ereignis. */
function anderesFenster(wert: string | null): void {
  if (wert === null) { speicher.removeItem(ABGELOEST_SCHLUESSEL); } else { speicher.setItem(ABGELOEST_SCHLUESSEL, wert); }
  act(() => { window.dispatchEvent(new StorageEvent('storage', { key: ABGELOEST_SCHLUESSEL, newValue: wert })); });
}
const seite = () => <HallentonSeite tournamentId={TID} felderAnzahl={2} />;
const ABGEMELDET = 'Die Turnierleitung hat dieses Gerät als Hallen-Lautsprecher für Feld 1 abgemeldet.';

beforeEach(() => {
  speicher = new FalscherSpeicher();
  vi.mocked(localStorage.getItem).mockImplementation((k: string) => speicher.getItem(k));
  vi.mocked(localStorage.setItem).mockImplementation((k: string, w: string) => speicher.setItem(k, w));
  vi.mocked(localStorage.removeItem).mockImplementation((k: string) => speicher.removeItem(k));
  __setzeGeraetFuerTests();
  setzeServer([]); // Feld 1 hat nach dem Abmelden keinen Lautsprecher mehr
});
afterEach(() => { __setzeGeraetFuerTests(); vi.restoreAllMocks(); });

describe('@HT-057 der abgemeldete Rechner zeigt den Hinweis mit „Verstanden“', () => {
  it('Marke „abgemeldet“ für Feld 1 → der Wortlaut des Records mit der Taste „Verstanden“; nicht „von einem anderen Gerät übernommen“', () => {
    merkeAbloesung(TID, [{ feld: 1, art: 'abgemeldet' }], SERVER_JETZT);
    render(seite());
    const hinweis = screen.getByTestId('geraet-banner-abgemeldet');
    expect(hinweis).toHaveTextContent(ABGEMELDET);
    expect(screen.getByTestId('geraet-verstanden')).toHaveTextContent('Verstanden');
    expect(screen.queryByTestId('geraet-banner-uebernommen')).toBeNull();
    expect(document.body.textContent).not.toMatch(/von einem anderen Gerät übernommen/);
    expect(screen.getByTestId('lautsprecher-feld-1-zustand')).toHaveTextContent('kein Hallen-Lautsprecher'); // der Rechner ist es nicht mehr
  });

  it('Gegenbeispiel Wettlauf (@HT-015): Gerät B hat übernommen, bevor der Rechner sich meldet → Marke „abgeloest“ → „Feld 1 von einem anderen Gerät übernommen“, nicht „abgemeldet“', () => {
    setzeServer([{ feld: 1, name: 'Tablet Halle' }]);
    merkeAbloesung(TID, [{ feld: 1, art: 'abgeloest' }], SERVER_JETZT);
    render(seite());
    expect(screen.getByTestId('geraet-banner-uebernommen')).toHaveTextContent('Feld 1 von einem anderen Gerät übernommen');
    expect(screen.getByTestId('geraet-banner-uebernommen')).toHaveTextContent('Tablet Halle gibt jetzt den Ton für Feld 1');
    expect(screen.queryByTestId('geraet-banner-abgemeldet')).toBeNull();
    expect(document.body.textContent).not.toContain('abgemeldet');
  });

  it('beide Arten zugleich (Feld 1 abgemeldet, Feld 2 übernommen) → zwei Hinweise, je Art mit dem richtigen Feld', () => {
    setzeServer([{ feld: 2, name: 'Tablet Halle' }]);
    merkeAbloesung(TID, [{ feld: 1, art: 'abgemeldet' }, { feld: 2, art: 'abgeloest' }], SERVER_JETZT);
    render(seite());
    expect(screen.getByTestId('geraet-banner-abgemeldet')).toHaveTextContent('für Feld 1 abgemeldet');
    expect(screen.getByTestId('geraet-banner-uebernommen')).toHaveTextContent('Feld 2 von einem anderen Gerät übernommen');
  });

  it('Gegenbeispiel: ohne Marke steht kein Hinweis „abgemeldet“', () => {
    render(seite());
    expect(screen.queryByTestId('geraet-banner-abgemeldet')).toBeNull();
    expect(screen.queryByTestId('geraet-verstanden')).toBeNull();
  });

  it('die Marke eines anderen Turniers erscheint hier nicht', () => {
    merkeAbloesung('t-anderes', [{ feld: 1, art: 'abgemeldet' }], SERVER_JETZT);
    render(seite());
    expect(screen.queryByTestId('geraet-banner-abgemeldet')).toBeNull();
  });
});

describe('@HT-057 nach „Verstanden“ verschwindet der Hinweis, auch in den anderen Fenstern des Rechners', () => {
  it('„Verstanden“ nimmt den Hinweis weg und löscht die Marke im gemeinsamen Speicher (so sehen es die anderen Fenster)', () => {
    merkeAbloesung(TID, [{ feld: 1, art: 'abgemeldet' }], SERVER_JETZT);
    render(seite());
    expect(speicher.getItem(ABGELOEST_SCHLUESSEL)).not.toBeNull();
    fireEvent.click(screen.getByTestId('geraet-verstanden'));
    expect(screen.queryByTestId('geraet-banner-abgemeldet')).toBeNull();
    expect(speicher.getItem(ABGELOEST_SCHLUESSEL)).toBeNull();
  });

  it('ein anderes Fenster tippt „Verstanden“ (der Schlüssel verschwindet, das `storage`-Ereignis kommt an) → der Hinweis in DIESEM Fenster verschwindet ohne eigenen Tipp', () => {
    merkeAbloesung(TID, [{ feld: 1, art: 'abgemeldet' }], SERVER_JETZT);
    render(seite());
    expect(screen.getByTestId('geraet-banner-abgemeldet')).toBeInTheDocument();
    anderesFenster(null);
    expect(screen.queryByTestId('geraet-banner-abgemeldet')).toBeNull();
  });

  it('Gegenbeispiel: ein anderes Fenster ändert nur etwas anderes → der Hinweis bleibt', () => {
    merkeAbloesung(TID, [{ feld: 1, art: 'abgemeldet' }], SERVER_JETZT);
    render(seite());
    act(() => { window.dispatchEvent(new StorageEvent('storage', { key: 'hallenton:ausgang', newValue: null })); });
    expect(screen.getByTestId('geraet-banner-abgemeldet')).toBeInTheDocument();
  });
});
