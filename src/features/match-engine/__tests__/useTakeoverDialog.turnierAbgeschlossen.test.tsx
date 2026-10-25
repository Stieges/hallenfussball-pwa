/**
 * R3-2a (Plan H-9, @HE-070 Z. 1): Ist das Turnier abgeschlossen, lehnt der Server „Spielleitung übernehmen“ ab. Der Dialog nennt
 * „Das Turnier ist abgeschlossen – Übernehmen ist nicht mehr möglich“ und sperrt die Haupttaste: kein zweiter, sinnloser Versuch.
 * Gegenbeispiel: ohne Netz bleibt die Taste frei („Übernehmen geht nur mit Netz“, @FU-028 – mit Netz klappt es danach).
 * Echte i18next-Instanz (DE/EN), echter Dialog.
 */
import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { createInstance } from 'i18next';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import type { ReactNode } from 'react';
import deCockpit from '../../../i18n/locales/de/cockpit.json';
import enCockpit from '../../../i18n/locales/en/cockpit.json';
import deCommon from '../../../i18n/locales/de/common.json';
import enCommon from '../../../i18n/locales/en/common.json';
import type { TakeFieldControlResult } from '../../../core/repositories/fieldControlRpc';
import { useTakeoverDialog } from '../useTakeoverDialog';

vi.unmock('i18next');
vi.unmock('react-i18next');

async function wrapperFor(lng: 'de' | 'en') {
  const instance = createInstance();
  await instance.use(initReactI18next).init({
    lng, fallbackLng: 'de', defaultNS: 'cockpit', ns: ['cockpit', 'common'],
    resources: { de: { cockpit: deCockpit, common: deCommon }, en: { cockpit: enCockpit, common: enCommon } },
    interpolation: { escapeValue: false }, returnNull: false,
  });
  return ({ children }: { children: ReactNode }) => <I18nextProvider i18n={instance}>{children}</I18nextProvider>;
}

async function tryTakeover(result: TakeFieldControlResult, lng: 'de' | 'en' = 'de') {
  const takeOver = vi.fn(async () => result);
  const wrapper = await wrapperFor(lng);
  const hook = renderHook(() => useTakeoverDialog(takeOver), { wrapper });
  act(() => { hook.result.current.open({ field: 2, feldName: 'Feld 2', epoch: 1, halter: 'Tom (Handy)' }); });
  const view = render(<>{hook.result.current.dialog}</>, { wrapper });
  await act(async () => { fireEvent.click(screen.getByTestId('takeover-confirm')); });
  view.rerender(<>{hook.result.current.dialog}</>);
  return { takeOver };
}

describe('R3-2a Übernahme nach dem Abschluss (@HE-070)', () => {
  it('@HE-070 „Turnier ist abgeschlossen“, Haupttaste gesperrt, kein zweiter Aufruf', async () => {
    const { takeOver } = await tryTakeover({ kind: 'tournamentFinished' });

    expect(screen.getByTestId('takeover-fehler').textContent).toBe('Das Turnier ist abgeschlossen – Übernehmen ist nicht mehr möglich');
    expect(screen.getByTestId('takeover-confirm')).toBeDisabled();
    fireEvent.click(screen.getByTestId('takeover-confirm'));
    expect(takeOver).toHaveBeenCalledTimes(1);
  });

  it('@HE-070 auf Englisch', async () => {
    await tryTakeover({ kind: 'tournamentFinished' }, 'en');

    expect(screen.getByTestId('takeover-fehler').textContent).toBe('The tournament is finished – taking over is no longer possible');
  });

  it('@FU-028 Gegenbeispiel: ohne Netz bleibt die Haupttaste frei', async () => {
    await tryTakeover({ kind: 'offline' });

    expect(screen.getByTestId('takeover-fehler').textContent).toBe('Übernehmen geht nur mit Netz');
    expect(screen.getByTestId('takeover-confirm')).not.toBeDisabled();
  });
});
