/**
 * UR (brief-UR.md § 6/§ 8 Fall 6/8): Protokoll-Zeile eines Direkteintrags im Cockpit -- Sidebar (Desktop) und
 * Ereignisprotokoll (Handy). Echte DE-Texte, echter Engine-Kontext (scheduleEngineHarness), Server-Lesefunktion
 * gemockt mit ihrer Antwort.
 * @FU-080: „Gegeben Spiel 9 ist geplant und wurde auf Papier geleitet · Wenn Olli im Spielplan 3:1 einträgt ·
 * … Und das Protokoll zeigt ‚Ergebnis eingetragen von Olli‘“. @FU-065: Trainer sieht keine Konto-Angabe. L4: Gast ohne Namen.
 */
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';

vi.unmock('i18next');
vi.unmock('react-i18next');
const auth = vi.hoisted(() => ({ isAuthenticated: true, name: 'Olli', role: 'owner' }));
vi.mock('../../../features/auth/hooks/useAuth', () => ({
  useAuth: () => ({ isAuthenticated: auth.isAuthenticated, user: auth.isAuthenticated ? { id: 'olli', name: auth.name } : null }),
}));
vi.mock('../../../features/auth/hooks/useMyTournamentRole', () => ({
  useMyTournamentRole: () => ({ role: auth.role, isLoading: false }),
}));
const authors = vi.hoisted(() => ({ read: vi.fn() }));
vi.mock('../../../core/repositories/eventAuthorNamesRpc', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../core/repositories/eventAuthorNamesRpc')>()),
  readEventAuthorNames: authors.read,
}));

import { initRealDeI18n } from '../../../test/realDeI18n';
import { MatchEngineContext } from '../../../features/match-engine/matchEngineContextInstance';
import { resetEventAuthorsCache } from '../../../features/match-engine/useEventAuthors';
import { MatchCommands, toRuntimeEvents, type EngineEventWithSeq } from '../../../core/match/client';
import { FC_NORD, NOW, SPIEL_9, SV_SUED, makeScheduleEngine, settle, type ScheduleEngine } from '../../../test/scheduleEngineHarness';
import { Sidebar } from '../components/Sidebar';
import { EventLogBottomSheet } from '../components/EventLogBottomSheet';

await initRealDeI18n();

const CTX = { matchId: SPIEL_9, teamAId: SV_SUED, teamBId: FC_NORD };
const olliEntry: EngineEventWithSeq = {
  id: 'e1', type: 'RESULT_ENTRY', actor: 'leitung', at: NOW - 60_000, section: null, clockMs: null, teamId: null,
  payload: { scores: { [SV_SUED]: 3, [FC_NORD]: 1 } }, seq: 1,
};

function inEngine(h: ScheduleEngine, ui: ReactNode) {
  return render(<MatchEngineContext.Provider value={h.value}>{ui}</MatchEngineContext.Provider>);
}
const sidebar = (matchId?: string) => (
  <Sidebar activePenalties={[]} events={[]} homeTeamName="SV Süd" awayTeamName="FC Nord" homeTeamId={SV_SUED} awayTeamId={FC_NORD} matchId={matchId} />
);
const sheet = (matchId?: string) => (
  <EventLogBottomSheet isOpen onClose={() => undefined} events={[]} homeTeamName="SV Süd" awayTeamName="FC Nord" homeTeamId={SV_SUED} awayTeamId={FC_NORD} matchId={matchId} />
);

/** Spiel 9: Ollis Direkteintrag 3:1 ist am Server bestätigt (nachgeladen), die Lesefunktion nennt Olli. */
async function spiel9Eingetragen(h: ScheduleEngine): Promise<void> {
  h.fetchConfirmed.mockResolvedValueOnce({ events: [olliEntry], newWatermark: 1 });
  await h.engine.ensureMatch(SPIEL_9, CTX, 'T');
  await h.engine.catchUp(SPIEL_9);
  authors.read.mockResolvedValue(new Map([['e1', { name: 'Olli', role: 'owner' }]]));
}

describe('UR Protokoll-Zeile „Ergebnis eingetragen von …“ (@FU-080)', () => {
  let h: ScheduleEngine;

  beforeEach(async () => {
    vi.stubGlobal('indexedDB', new IDBFactory());
    auth.isAuthenticated = true;
    auth.name = 'Olli';
    auth.role = 'owner';
    authors.read.mockReset();
    authors.read.mockResolvedValue(new Map());
    resetEventAuthorsCache();
    h = await makeScheduleEngine();
  });
  afterEach(() => {
    h.engine.stop();
    vi.unstubAllGlobals();
  });

  it('@FU-080 Sidebar (Desktop): Olli sieht „Ergebnis eingetragen von Olli“ statt „Noch keine Ereignisse“', async () => {
    await spiel9Eingetragen(h);
    inEngine(h, sidebar(SPIEL_9));

    expect(await screen.findByText('Ergebnis eingetragen von Olli')).toBeTruthy();
    expect(screen.getByTestId('protocol-result-entry')).toBeTruthy();
    expect(screen.queryByText('Noch keine Ereignisse')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull(); // kein Bearbeiten-Knopf an dieser Zeile
  });

  it('@FU-080 Ereignisprotokoll (Handy): „Ergebnis eingetragen von Olli“', async () => {
    await spiel9Eingetragen(h);
    inEngine(h, sheet(SPIEL_9));

    expect(await screen.findByText('Ergebnis eingetragen von Olli')).toBeTruthy();
    expect(screen.queryByText('Noch keine Ereignisse aufgezeichnet')).toBeNull();
  });

  it('@FU-065 Gegenbeispiel: Trainer öffnet dasselbe Protokoll → „Ergebnis eingetragen“ ohne Namen, kein Aufruf der Lesefunktion', async () => {
    auth.role = 'trainer';
    await spiel9Eingetragen(h);
    inEngine(h, sidebar(SPIEL_9));

    expect(await screen.findByText('Ergebnis eingetragen')).toBeTruthy();
    await act(async () => { await settle(); });
    expect(screen.queryByText(/von Olli/)).toBeNull();
    expect(authors.read).not.toHaveBeenCalled();
  });

  it('Fehlerpolitik: Lesefunktion scheitert → „Ergebnis eingetragen“ ohne Namen, keine Fehlermeldung', async () => {
    await spiel9Eingetragen(h);
    authors.read.mockRejectedValue(new Error('Zeitlimit'));
    inEngine(h, sidebar(SPIEL_9));

    expect(await screen.findByText('Ergebnis eingetragen')).toBeTruthy();
    await act(async () => { await settle(); });
    expect(screen.queryByText(/von /)).toBeNull();
  });

  it('Z1: Olli trägt 3:1 ohne Netz ein → sofort „Ergebnis eingetragen von Olli“ (wartender Eintrag)', async () => {
    h.engine.stop();
    h = await makeScheduleEngine(undefined, { offline: true });
    await h.engine.ensureMatch(SPIEL_9, CTX, 'T');
    const commands = new MatchCommands({ engine: h.engine, store: h.store, sender: h.sender, accountId: h.value.accountId });
    await commands.enterResult(SPIEL_9, CTX, 'leitung', { [SV_SUED]: 3, [FC_NORD]: 1 }, undefined, false);
    authors.read.mockRejectedValue(new TypeError('Failed to fetch'));
    inEngine(h, sidebar(SPIEL_9));

    expect(await screen.findByText('Ergebnis eingetragen von Olli')).toBeTruthy();
  });

  it('L4 Gegenbeispiel: Gast-Turnier → „Ergebnis eingetragen“ ohne Namen', async () => {
    auth.isAuthenticated = false;
    h.engine.stop();
    h = await makeScheduleEngine('guest');
    await h.engine.ensureMatch(SPIEL_9, CTX, 'T');
    const commands = new MatchCommands({ engine: h.engine, store: h.store, sender: h.sender, accountId: h.value.accountId });
    await commands.enterResult(SPIEL_9, CTX, 'leitung', { [SV_SUED]: 3, [FC_NORD]: 1 }, undefined, false);
    inEngine(h, sheet(SPIEL_9));

    expect(await screen.findByText('Ergebnis eingetragen')).toBeTruthy();
    expect(authors.read).not.toHaveBeenCalled();
  });

  it('Gegenbeispiel: ohne Spiel-ID (Bestand) → keine Direkteintrag-Zeile, „Noch keine Ereignisse“', async () => {
    await spiel9Eingetragen(h);
    inEngine(h, sidebar(undefined));
    await act(async () => { await settle(); });

    expect(screen.getByText('Noch keine Ereignisse')).toBeTruthy();
    expect(screen.queryByTestId('protocol-result-entry')).toBeNull();
  });

  it('Regression R-UR-3: LiveMatch.events eines Spiels mit RESULT_ENTRY bleibt leer (Tore, Fouls, scoreAfter unverändert)', async () => {
    await spiel9Eingetragen(h);
    const view = h.engine.view(SPIEL_9);
    expect(view?.result.state.status).toBe('finished');
    expect(toRuntimeEvents(view!.result.state, view!.log, CTX)).toEqual([]);
  });
});
