/**
 * A-08f3e4 Punkt 2 – „Hat das Spiel Einträge?“ für die Sperren (Brief A-08f3e4c1c2 § 3, Plan v4 § 3 „e4“).
 * Quelle: Server-Revision > 1 ∪ lokale Engine-Kopie des Kontos mit Einträgen (Gast: dieselbe Kopie im Gastkonto).
 * Fehlerpolitik: Quelle nicht lesbar → gilt als „hat Einträge“ (sperren) + Fehlermeldung an Sentry.
 * Anforderungen: @FU-090 (Zurücksetzen/Neu erzeugen löschen keine Einträge still), @FU-091 (Wiederherstellen).
 */
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';

vi.unmock('i18next');
vi.unmock('react-i18next');
const revisionSource = vi.hoisted(() => ({ led: new Set<string>() }));
vi.mock('../useServerLedMatchIds', () => ({
  useServerRevisionSource: () => ({ serverLedMatchIds: () => revisionSource.led, subscribeServerRevisions: () => () => undefined }),
}));
const sentry = vi.hoisted(() => ({ captureFeatureError: vi.fn() }));
vi.mock('../../lib/sentry', () => sentry);
const toast = vi.hoisted(() => ({ showWarning: vi.fn(), showInfo: vi.fn() }));
vi.mock('../../components/ui/Toast/ToastContext', () => ({ useOptionalToast: () => toast }));

import { initRealDeI18n } from '../../test/realDeI18n';
import { MatchEngineContext } from '../../features/match-engine/matchEngineContextInstance';
import { makeScheduleEngine, scheduleTournament, SPIEL_7, SPIEL_9, type ScheduleEngine } from '../../test/scheduleEngineHarness';
import { seedEntries } from '../../test/matchEntrySeed';
import { matchesWithEntries } from '../../core/services/matchResultStatusDiff';
import { useMatchEntryGuard } from '../useMatchEntryGuard';

await initRealDeI18n();

/** 2:1 = Anpfiff, drei Tore, Abpfiff = 5 Einträge (@FU-090). */
const ZWEI_ZU_EINS = { home: 2, away: 1 };

const BLOCKED_7 = 'Spiel 7 hat Einträge – nur über Spielplan auf Anfang setzen';

function render(h: ScheduleEngine | null) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MatchEngineContext.Provider value={h?.value ?? null}>{children}</MatchEngineContext.Provider>
  );
  return renderHook(() => useMatchEntryGuard(), { wrapper }).result;
}

describe('A-08f3e4 matchesWithEntries (rein)', () => {
  it('@FU-090 liefert die Spiele mit Einträgen in Spielplan-Reihenfolge, Schreibweise der ID egal', () => {
    const tournament = scheduleTournament();
    const found = matchesWithEntries(tournament, new Set([SPIEL_9.toUpperCase(), SPIEL_7]));
    expect(found.map((m) => m.id)).toEqual([SPIEL_7, SPIEL_9]);
  });

  it('Gegenbeispiel: keine Einträge → leer', () => {
    expect(matchesWithEntries(scheduleTournament(), new Set())).toEqual([]);
  });
});

describe('A-08f3e4 useMatchEntryGuard', () => {
  let h: ScheduleEngine;

  beforeEach(async () => {
    vi.stubGlobal('indexedDB', new IDBFactory());
    revisionSource.led = new Set();
    h = await makeScheduleEngine();
  });
  afterEach(() => {
    h.engine.stop();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('@FU-090 Spiel 7 hat 5 Einträge (lokale Kopie) → gesperrt, Text wörtlich', async () => {
    await seedEntries(h, SPIEL_7, ZWEI_ZU_EINS);
    const guard = render(h);

    let blocked = false;
    await act(async () => { blocked = await guard.current.blocks(scheduleTournament()); });

    expect(blocked).toBe(true);
    expect(toast.showWarning).toHaveBeenCalledWith(BLOCKED_7);
  });

  it('@FU-090 Spiel 9 ist am Server fortgeschrieben (Revision > 1, keine lokale Kopie) → gesperrt mit Spiel 9', async () => {
    revisionSource.led = new Set([SPIEL_9]);
    const guard = render(h);

    let blocked = false;
    await act(async () => { blocked = await guard.current.blocks(scheduleTournament()); });

    expect(blocked).toBe(true);
    expect(toast.showWarning).toHaveBeenCalledWith('Spiel 9 hat Einträge – nur über Spielplan auf Anfang setzen');
  });

  it('Gegenbeispiel: ohne Einträge → nicht gesperrt, kein Hinweis', async () => {
    const guard = render(h);

    let blocked = true;
    await act(async () => { blocked = await guard.current.blocks(scheduleTournament()); });

    expect(blocked).toBe(false);
    expect(toast.showWarning).not.toHaveBeenCalled();
  });

  it('Fehlerpolitik: lokale Kopien nicht lesbar → gesperrt + Sentry', async () => {
    vi.spyOn(h.store, 'forAccount').mockRejectedValue(new Error('IndexedDB weg'));
    const guard = render(h);

    let blocked = false;
    await act(async () => { blocked = await guard.current.blocks(scheduleTournament()); });

    expect(blocked).toBe(true);
    expect(sentry.captureFeatureError).toHaveBeenCalled();
    expect(toast.showWarning).toHaveBeenCalledWith('Einträge konnten nicht geprüft werden – nichts geändert');
  });

  it('Fehlerpolitik: ohne Spiel-Engine → gesperrt', async () => {
    const guard = render(null);

    let blocked = false;
    await act(async () => { blocked = await guard.current.blocks(scheduleTournament()); });

    expect(blocked).toBe(true);
  });
});
