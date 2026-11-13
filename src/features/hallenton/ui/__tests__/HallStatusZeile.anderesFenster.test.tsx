/**
 * H4-8 (@HT-033 Zeile 8, Nachtrag 13.11.) in der Statuszeile: das zweite Fenster zeigt gleich „Lautsprecher läuft schon in einem anderen
 * Fenster“ (ruhig, ohne Klick), wenn ein anderes Fenster die Sperre `hallenton` hält; „Ton nicht aktiv – hier klicken“ nur, wenn kein
 * Fenster tönt; ohne `navigator.locks` wie bisher.
 */
import { act, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import common from '../../../../i18n/locales/de/common.json';
import de from '../../../../i18n/locales/de/hallenton.json';
import type { HallLautsprecher } from '../../useHallLautsprecher';
import type { HallStatus } from '../../useHallStatus';
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
const doppel = vi.hoisted(() => ({ lautsprecher: null as unknown as HallLautsprecher }));
vi.mock('../../../auth/hooks/useCan', () => ({ useCan: () => true }));
vi.mock('../../useHallStatus', () => ({
  useHallStatus: (): HallStatus => ({ stand: 'laedt', antwort: null, felder: {}, lautsprecherBekannt: false, testtonAnfordern: vi.fn(), gehoert: vi.fn() }),
}));
vi.mock('../../useAngepfiffeneFelder', () => ({ useAngepfiffeneFelder: () => new Set<number>() }));
vi.mock('../../useHallLautsprecher', () => ({ useHallLautsprecher: () => doppel.lautsprecher }));

import { AuthContext } from '../../../auth/context/authContextInstance';
import { HallStatusZeile } from '../HallStatusZeile';

const laufzeit: LaufzeitSnapshot = {
  rolle: 'wartet', turnierId: 't1', felder: [1], geraeteZustand: 'not_activated', zustandJeFeld: { 'field-1': 'not_activated' },
  naechsterTon: null, taktFehler: false, warAngehalten: false, verfuegbarkeit: null,
};
const zeige = () => render(<AuthContext.Provider value={{} as never}><MemoryRouter><HallStatusZeile tournamentId="t1" /></MemoryRouter></AuthContext.Provider>);
const buttons = () => screen.getAllByRole('button').map((b) => b.textContent);

beforeEach(() => {
  doppel.lautsprecher = { rolle: 'diesesTurnier', felder: [1], name: 'Laptop', laufzeit, tonAktivieren: vi.fn(() => Promise.resolve(true)) } as unknown as HallLautsprecher;
});
afterEach(() => Reflect.deleteProperty(navigator, 'locks'));

const locks = (...namen: string[]) => Object.defineProperty(navigator, 'locks', { configurable: true, value: { query: () => Promise.resolve({ held: namen.map((name) => ({ name })) }) } });

describe('@HT-033 Zeile 8 zweites Fenster', () => {
  it('ein anderes Fenster tönt → gleich „Lautsprecher läuft schon in einem anderen Fenster“, ohne Klick, nie „Ton nicht aktiv“', async () => {
    locks('hallenton');
    zeige();
    await act(async () => { await Promise.resolve(); });
    expect(buttons()).toEqual(['Lautsprecher läuft schon in einem anderen Fenster']);
  });
  it('Gegenbeispiel: kein Fenster tönt → „Ton nicht aktiv – hier klicken“', async () => {
    locks();
    zeige();
    await act(async () => { await Promise.resolve(); });
    expect(buttons()).toEqual(['Ton nicht aktiv – hier klicken']);
  });
  it('Gegenbeispiel: ohne navigator.locks wie bisher „Ton nicht aktiv – hier klicken“', async () => {
    zeige();
    await act(async () => { await Promise.resolve(); });
    expect(buttons()).toEqual(['Ton nicht aktiv – hier klicken']);
  });
});
