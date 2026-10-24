/**
 * A-15b (R2 PR 2): Anbindung des Auslösers an Recht, Netz und Repository. @TM-071/@TM-150 Zeile 2: die Turnierleitung schließt
 * ohne Zutun erneut ab; Gegenbeispiel Helfer (kein `manageLifecycle`); Gast (lokaler Speicher) gilt als „mit Netz“ und lokal.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import type { Tournament } from '../../types/tournament';
import { completion } from '../../core/standings/__tests__/groupCompletionKit';
import { id, league } from '../../core/standings/__tests__/fixtures';

const mocks = vi.hoisted(() => ({ repo: {}, can: { value: true }, online: { value: true } }));
vi.mock('../../core/contexts/RepositoryContext', () => ({ useRepositories: () => ({ tournamentRepository: mocks.repo }) }));
vi.mock('../../features/auth/hooks/useCan', () => ({ useCan: () => mocks.can.value }));
vi.mock('../useOnlineStatus', () => ({ useIsOnline: () => mocks.online.value }));

import { useAutoRecompletion } from '../useAutoRecompletion';
import { LocalStorageRepository } from '../../core/repositories/LocalStorageRepository';

/** @TM-150 Zeile 2: Platz 1 auszuspielen, abgeschlossen und veraltet, nach der Korrektur SC Ost allein vorn. */
function ostAllein(stale = true): Tournament {
  const { tournament } = league('WONB', 'W–O 0:1; W–N 2:0; W–B 1:0; O–N 2:0; O–B 1:0; N–B 1:0', { group: undefined });
  return { ...tournament, placementsToPlayOut: [1], groupCompletions: [completion('', [id('W'), id('O'), id('N'), id('B')], { stale })] };
}

const ok = { status: 'ok', alreadyCompleted: false, changed: [] };

describe('useAutoRecompletion (A-15b)', () => {
  beforeEach(() => { mocks.can.value = true; mocks.online.value = true; });

  it('@TM-150 Zeile 2: Turnierleitung mit Netz → complete_group mit SC Ost vorn, danach frisch geladen', async () => {
    const completeGroup = vi.fn(() => Promise.resolve(ok));
    mocks.repo = { completeGroup };
    const reload = vi.fn();
    const t = ostAllein();
    renderHook(() => { useAutoRecompletion(t.id, t, reload); });
    await waitFor(() => { expect(completeGroup).toHaveBeenCalledTimes(1); });
    expect(completeGroup.mock.calls[0]).toEqual([t.id, expect.objectContaining({ groupId: '', openRanks: [] })]);
    await waitFor(() => { expect(reload).toHaveBeenCalled(); });
  });

  it('Gegenbeispiel Helfer (kein manageLifecycle): kein Aufruf', async () => {
    const completeGroup = vi.fn(() => Promise.resolve(ok));
    mocks.repo = { completeGroup };
    mocks.can.value = false;
    const t = ostAllein();
    renderHook(() => { useAutoRecompletion(t.id, t, vi.fn()); });
    await new Promise((r) => { setTimeout(r, 20); });
    expect(completeGroup).not.toHaveBeenCalled();
  });

  it('Gast (lokaler Speicher, ohne Netz-Angabe): nicht als veraltet markiert, Rangfolge passt nicht mehr → erneut abgeschlossen', async () => {
    const repo = new LocalStorageRepository({ viewer: 'guest' });
    const completeGroup = vi.spyOn(repo, 'completeGroup').mockResolvedValue(ok as never);
    mocks.repo = repo;
    mocks.online.value = false;
    const t = ostAllein(false);
    renderHook(() => { useAutoRecompletion(t.id, t, vi.fn()); });
    await waitFor(() => { expect(completeGroup).toHaveBeenCalledTimes(1); });
  });
});
