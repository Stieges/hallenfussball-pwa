/**
 * Task C3b-2d (G8) + C3b-2 F2: Verdrahtung Engine-Kontext → Leerlauf-Prüfung.
 * Konto/Store kommen aus `useMatchEngineContextOptional`; ohne Kontext zählt
 * nur die Dialog-Bedingung (Fehlerregel 3).
 *
 * Testumgebung: `useTranslation` liefert JE Render ein neues `t` mit
 * sprachabhängigem Text (Sprachwechsel-Szenario M5), `useToast` eine stabile
 * Funktion; `setupSwAutoReload` ist als Setup-Spion um die echte Funktion
 * gelegt, um Aufrufe pro Seitenladung zu zählen.
 */
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MatchEngineContextValue } from '../../features/match-engine/matchEngineContextInstance';
import { countWaitingEntries } from '../../features/collaboration/outbox/countWaitingEntries';
import { useMatchEngineContextOptional } from '../../features/match-engine/useMatchEngineContext';
import { DEFAULT_RELOAD_DELAY_MS, __resetSwForTests } from '../../lib/swRegistration';
import { IDLE_RECHECK_MS, OBSERVER_DEBOUNCE_MS } from '../../lib/swIdle';
import { __fireNeedRefresh, registerSWMock, updateSWMock } from '../../test/mocks/virtual-pwa-register';
import { useSwAutoReload } from '../useSwAutoReload';

const { showInfoMock, setupSpy, tMock, setLang } = vi.hoisted(() => {
  let lang = 'de';
  return {
    showInfoMock: vi.fn(),
    setupSpy: vi.fn(),
    tMock: (key: string) => `${key}:${lang}`,
    setLang: (next: string): void => {
      lang = next;
    },
  };
});

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => tMock(key) }),
}));

vi.mock('../../lib/swRegistration', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../lib/swRegistration')>();
  return {
    ...original,
    setupSwAutoReload: (options: Parameters<typeof original.setupSwAutoReload>[0]) => {
      setupSpy(options);
      return original.setupSwAutoReload(options);
    },
  };
});

vi.mock('../../components/ui/Toast', () => ({
  useToast: () => ({ showInfo: showInfoMock }),
}));

vi.mock('../../features/match-engine/useMatchEngineContext', () => ({
  useMatchEngineContextOptional: vi.fn(),
}));

vi.mock('../../features/collaboration/outbox/countWaitingEntries', () => ({
  countWaitingEntries: vi.fn(async () => 0),
}));

const useContextMock = vi.mocked(useMatchEngineContextOptional);
const countMock = vi.mocked(countWaitingEntries);

async function mount() {
  const utils = renderHook(() => useSwAutoReload());
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
  return utils;
}

describe('useSwAutoReload', () => {
  beforeEach(() => {
    __resetSwForTests();
    vi.useFakeTimers();
  });

  afterEach(() => {
    __resetSwForTests();
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('ohne Konto/Engine-Kontext zählt nur Bedingung (a) — der Zähler wird nie gerufen', async () => {
    useContextMock.mockReturnValue(null);
    document.body.innerHTML = '<div role="dialog" aria-modal="true"><input /></div>';
    const { result } = await mount();

    act(() => {
      __fireNeedRefresh();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(OBSERVER_DEBOUNCE_MS + IDLE_RECHECK_MS);
    });
    expect(registerSWMock).toHaveBeenCalledTimes(1);
    expect(result.current.updateNow).toBeTypeOf('function');
    expect(updateSWMock).not.toHaveBeenCalled();
    expect(countMock).not.toHaveBeenCalled();

    document.body.innerHTML = '<main>Startseite</main>';
    await act(async () => {
      await vi.advanceTimersByTimeAsync(OBSERVER_DEBOUNCE_MS);
    });
    expect(showInfoMock).toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(DEFAULT_RELOAD_DELAY_MS);
    });
    expect(updateSWMock).toHaveBeenCalledWith(true);
    expect(countMock).not.toHaveBeenCalled();
  });

  it('mit Konto zählt countWaitingEntries(store, accountId); der Knopf lädt sofort und fasst den Ausgang nicht an', async () => {
    const store = { forAccount: vi.fn(async () => []) };
    useContextMock.mockReturnValue({ store, accountId: 'acc1' } as unknown as MatchEngineContextValue);
    countMock.mockResolvedValue(3);
    const { result } = await mount();

    act(() => {
      __fireNeedRefresh();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(IDLE_RECHECK_MS + DEFAULT_RELOAD_DELAY_MS);
    });
    expect(countMock).toHaveBeenCalledWith(store, 'acc1');
    expect(updateSWMock).not.toHaveBeenCalled();

    const vorher = countMock.mock.calls.length;
    act(() => {
      result.current.updateNow?.();
    });
    expect(updateSWMock).toHaveBeenCalledWith(true);
    expect(countMock.mock.calls.length).toBe(vorher);
    expect(store.forAccount).not.toHaveBeenCalled();
  });

  it('Sprachwechsel → registerSW genau 1×, Automatik läuft weiter', async () => {
    useContextMock.mockReturnValue(null);
    const { rerender } = await mount();
    expect(setupSpy).toHaveBeenCalledTimes(1);
    expect(registerSWMock).toHaveBeenCalledTimes(1);

    setLang('fr');
    rerender();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(setupSpy).toHaveBeenCalledTimes(1);
    expect(registerSWMock).toHaveBeenCalledTimes(1);

    act(() => {
      __fireNeedRefresh();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(showInfoMock).toHaveBeenCalledWith('login.appUpdating:fr');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(DEFAULT_RELOAD_DELAY_MS);
    });
    expect(updateSWMock).toHaveBeenCalledWith(true);
  });
});
