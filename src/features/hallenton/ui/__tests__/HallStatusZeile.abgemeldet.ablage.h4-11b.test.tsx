/**
 * H4-11b Fixrunde 1: der Eintrag „abgemeldet“ in der Statuszeile folgt der echten Geräte-Ablage (`lautsprecherGeraet`, `localStorage` + `storage` wie der Browser): er steht in jedem Fenster des
 * Rechners, bis „Verstanden“ getippt ist – auch wenn „Verstanden“ in einem ANDEREN Fenster getippt wird (@HT-057 „auch in den anderen Fenstern des Rechners“).
 */
import { act, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import common from '../../../../i18n/locales/de/common.json';
import de from '../../../../i18n/locales/de/hallenton.json';
import { FalscherSpeicher } from '../../../../test/hallenton/falschesGeraet';
import type { HallStatus } from '../../useHallStatus';

vi.mock('react-i18next', () => ({
  useTranslation: (ns: string) => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      const wert = key.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], ns === 'common' ? common : de);
      const text = typeof wert === 'string' ? wert : `FEHLT:${key}`;
      return text.replace(/\{\{(\w+)\}\}/g, (_, n: string) => String(opts?.[n] ?? `{{${n}}}`));
    },
  }),
}));
vi.mock('../../../../lib/supabase', () => ({ supabase: null, isSupabaseConfigured: false }));
vi.mock('../../../../hooks/useKioskRoute', () => ({ useKioskRoute: () => false }));
vi.mock('../../useLaufendeSpiele', () => ({ useLaufendeSpiele: () => new Map<number, number>() }));
vi.mock('../../useHallStatus', () => ({
  useHallStatus: () => ({ stand: 'aktuell', antwort: null, felder: {}, lautsprecherBekannt: false, testtonAnfordern: vi.fn(), gehoert: vi.fn() } as unknown as HallStatus),
}));

import { ABGELOEST_SCHLUESSEL, __setzeGeraetFuerTests, abgeloestVerstanden, merkeAbloesung } from '../../lautsprecherGeraet';
import { HallGeraetStreifen } from '../HallGeraetStreifen';

let speicher: FalscherSpeicher;
const ABGEMELDET = 'Feld 1: als Hallen-Lautsprecher abgemeldet';
const zeige = () => render(<MemoryRouter><HallGeraetStreifen /></MemoryRouter>);
const anderesFenster = (wert: string | null): void => {
  if (wert === null) { speicher.removeItem(ABGELOEST_SCHLUESSEL); } else { speicher.setItem(ABGELOEST_SCHLUESSEL, wert); }
  act(() => { window.dispatchEvent(new StorageEvent('storage', { key: ABGELOEST_SCHLUESSEL, newValue: wert })); });
};

beforeEach(() => {
  speicher = new FalscherSpeicher();
  vi.mocked(localStorage.getItem).mockImplementation((k: string) => speicher.getItem(k));
  vi.mocked(localStorage.setItem).mockImplementation((k: string, w: string) => speicher.setItem(k, w));
  vi.mocked(localStorage.removeItem).mockImplementation((k: string) => speicher.removeItem(k));
  __setzeGeraetFuerTests();
});
afterEach(() => { __setzeGeraetFuerTests(); vi.restoreAllMocks(); });

describe('@HT-057 der Eintrag folgt der Geräte-Ablage', () => {
  it('die Rolle endet mit der Marke „abgemeldet“ → der Streifen zeigt den Eintrag, auch ohne Einschaltung in diesem Fenster', () => {
    zeige();
    expect(screen.queryByTestId('hallenton-geraet-streifen')).toBeNull();
    act(() => { merkeAbloesung('t1', [{ feld: 1, art: 'abgemeldet' }], 1); });
    expect(screen.getByTestId('hallenton-geraet-streifen')).toHaveTextContent(ABGEMELDET);
  });
  it('„Verstanden“ in DIESEM Fenster nimmt ihn weg und löscht die Marke für alle', () => {
    merkeAbloesung('t1', [{ feld: 1, art: 'abgemeldet' }], 1);
    zeige();
    expect(screen.getByTestId('hallenton-geraet-streifen')).toBeInTheDocument();
    act(() => { abgeloestVerstanden(); });
    expect(screen.queryByTestId('hallenton-geraet-streifen')).toBeNull();
    expect(speicher.getItem(ABGELOEST_SCHLUESSEL)).toBeNull();
  });
  it('„Verstanden“ in einem ANDEREN Fenster (Schlüssel weg, `storage`-Ereignis) → der Eintrag verschwindet auch hier', () => {
    merkeAbloesung('t1', [{ feld: 1, art: 'abgemeldet' }], 1);
    zeige();
    expect(screen.getByTestId('hallenton-geraet-streifen')).toBeInTheDocument();
    anderesFenster(null);
    expect(screen.queryByTestId('hallenton-geraet-streifen')).toBeNull();
  });
  it('ein anderes Fenster meldet den Verlust (Schlüssel neu) → der Eintrag erscheint hier ohne eigenes Lebenszeichen', () => {
    zeige();
    anderesFenster(JSON.stringify({ turnierId: 't1', felder: [{ feld: 1, art: 'abgemeldet' }], um: 1 }));
    expect(screen.getByTestId('hallenton-geraet-streifen')).toHaveTextContent(ABGEMELDET);
  });
  it('Gegenbeispiel Wettlauf: nur „übernommen“ (abgeloest) → kein Eintrag', () => {
    zeige();
    act(() => { merkeAbloesung('t1', [{ feld: 1, art: 'abgeloest' }], 1); });
    expect(screen.queryByTestId('hallenton-geraet-streifen')).toBeNull();
  });
});
