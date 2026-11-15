/**
 * @OB-088 Zeile 1: Tom öffnet Spiel 11 ohne Netz und liest „Spiel konnte nicht vorbereitet werden“. Hat das Gerät wieder Netz, bereitet die App
 * das Spiel von selbst vor und zeigt das Cockpit – ohne dass Tom etwas antippt. „Erneut versuchen“ bleibt (`handleRetryEngineReady`).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { ScheduledMatch } from '../../../../core/generators';
import { MatchAwaitingTeamsError } from '../../../../core/errors';
import { useEngineMatchInit } from '../useEngineMatchInit';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));
vi.mock('../../../../lib/sentry', () => ({ captureFeatureError: vi.fn() }));
vi.mock('../../../../components/ui/Toast/ToastContext', () => ({ useToast: () => ({ showError: vi.fn() }) }));

const spiel11 = { id: 'match-11' } as unknown as ScheduledMatch;
const keinNetz = new Error('Failed to fetch');
const live = new Map<string, unknown>();

beforeEach(() => { live.clear(); });

describe('@OB-088 Spiel vorbereiten: Netz zurück', () => {
  it('@OB-088 Zeile 1: scheitert das Vorbereiten, versucht die App es bei Netzrückkehr von selbst noch einmal und das Cockpit erscheint', async () => {
    const lade = vi.fn<(m: ScheduledMatch) => Promise<unknown>>().mockRejectedValueOnce(keinNetz).mockImplementation(() => { live.set('match-11', {}); return Promise.resolve({}); });
    const { result, rerender } = renderHook(() => useEngineMatchInit({ currentMatchData: spiel11, liveMatches: live, getLiveMatchData: lade }));
    await waitFor(() => expect(result.current.engineReadyError).toBe(true));
    expect(lade).toHaveBeenCalledTimes(1);

    await act(async () => { window.dispatchEvent(new Event('online')); });
    rerender();
    await waitFor(() => expect(result.current.engineReadyError).toBe(false));
    expect(lade).toHaveBeenCalledTimes(2);
    expect(result.current.isInitializingMatch).toBe(false);
  });

  it('@OB-088 Zeile 1: kommt das Netz zurück und es scheitert wieder, bleibt der Hinweis mit der Taste stehen; die Taste versucht es weiter', async () => {
    const lade = vi.fn<(m: ScheduledMatch) => Promise<unknown>>().mockRejectedValue(keinNetz);
    const { result } = renderHook(() => useEngineMatchInit({ currentMatchData: spiel11, liveMatches: live, getLiveMatchData: lade }));
    await waitFor(() => expect(result.current.engineReadyError).toBe(true));
    await act(async () => { window.dispatchEvent(new Event('online')); });
    await waitFor(() => expect(lade).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(result.current.engineReadyError).toBe(true));
    await act(async () => { result.current.handleRetryEngineReady(); });
    await waitFor(() => expect(lade).toHaveBeenCalledTimes(3));
  });

  it('@OB-088 Zeile 1 Gegenbeispiel: ohne Fehler löst die Netzrückkehr keinen zweiten Versuch aus', async () => {
    const lade = vi.fn<(m: ScheduledMatch) => Promise<unknown>>().mockImplementation(() => { live.set('match-11', {}); return Promise.resolve({}); });
    const { result } = renderHook(() => useEngineMatchInit({ currentMatchData: spiel11, liveMatches: live, getLiveMatchData: lade }));
    await waitFor(() => expect(lade).toHaveBeenCalledTimes(1));
    await act(async () => { window.dispatchEvent(new Event('online')); });
    expect(lade).toHaveBeenCalledTimes(1);
    expect(result.current.engineReadyError).toBe(false);
  });

  it('@OB-088 Zeile 1 Gegenbeispiel: „wartet auf Teams“ ist kein Fehler – die Netzrückkehr versucht nichts neu', async () => {
    const lade = vi.fn<(m: ScheduledMatch) => Promise<unknown>>().mockRejectedValue(new MatchAwaitingTeamsError('match-11', ['B']));
    const { result } = renderHook(() => useEngineMatchInit({ currentMatchData: spiel11, liveMatches: live, getLiveMatchData: lade }));
    await waitFor(() => expect(result.current.awaitingTeams).toBe(true));
    await act(async () => { window.dispatchEvent(new Event('online')); });
    expect(lade).toHaveBeenCalledTimes(1);
  });

  it('@OB-088 Zeile 1: nach dem Verlassen der Ansicht hört die Netz-Wiederholung auf', async () => {
    const lade = vi.fn<(m: ScheduledMatch) => Promise<unknown>>().mockRejectedValue(keinNetz);
    const { result, unmount } = renderHook(() => useEngineMatchInit({ currentMatchData: spiel11, liveMatches: live, getLiveMatchData: lade }));
    await waitFor(() => expect(result.current.engineReadyError).toBe(true));
    unmount();
    window.dispatchEvent(new Event('online'));
    expect(lade).toHaveBeenCalledTimes(1);
  });
});
