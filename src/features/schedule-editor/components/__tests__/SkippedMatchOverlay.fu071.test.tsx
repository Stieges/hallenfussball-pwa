/**
 * A-08f3e4 – @FU-071 Zeile „übersprungen · Tom · wieder einplanen · wird abgelehnt mit „nur Turnierleitung““ im
 * Spielplan-Editor: Spielkarte (`DraggableMatch` → `SkippedMatchOverlay`) mit dem echten `useScheduleEditor` und
 * `useMatchSkip`, echte Spiel-Engine (fake-indexeddb), echte DE-Texte. Verdrahtung wie `ScheduleEditor.tsx`.
 */
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.unmock('i18next');
vi.unmock('react-i18next');
const role = vi.hoisted(() => ({ actor: 'leitung' }));
vi.mock('../../../../hooks/useActorRole', () => ({ useActorRole: () => role.actor }));

import { initRealDeI18n } from '../../../../test/realDeI18n';
import { MatchEngineContext } from '../../../match-engine/matchEngineContextInstance';
import { MatchCommands } from '../../../../core/match/client';
import { buildValidMatches } from '../../../../hooks/engineMatchModel';
import { makeScheduleEngine, scheduleTournament, settle, SPIEL_9, type ScheduleEngine } from '../../../../test/scheduleEngineHarness';
import type { Tournament } from '../../../../types/tournament';
import { useScheduleEditor } from '../../hooks/useScheduleEditor';
import { DraggableMatch } from '../DraggableMatch';

await initRealDeI18n();

function EditorCard({ tournament }: { tournament: Tournament }) {
  const { unskipMatch } = useScheduleEditor({ tournament, onTournamentUpdate: vi.fn() });
  const match = tournament.matches.find((m) => m.id === SPIEL_9);
  if (!match) { return null; }
  return <DraggableMatch match={match} teams={tournament.teams} tournament={tournament} isEditing draggable={false} onUnskip={() => unskipMatch(SPIEL_9)} />;
}

/** Spiel 9 ist am Gerät abgesetzt (Olli, über den Server-Weg). */
async function skipSpiel9(h: ScheduleEngine): Promise<Tournament> {
  const tournament = scheduleTournament({ [SPIEL_9]: { matchStatus: 'skipped', skippedReason: 'Team fehlt' } });
  const entry = buildValidMatches(tournament).find((e) => e.externalId === SPIEL_9);
  if (!entry) { throw new Error('Spiel 9 fehlt'); }
  await h.engine.ensureMatch(entry.matchId, entry.ctx, 'T');
  await new MatchCommands({ engine: h.engine, store: h.store, sender: h.value.sender, accountId: h.value.accountId }).skip(entry.matchId, entry.ctx, 'leitung', 'Team fehlt');
  await settle();
  return tournament;
}

const sentTypes = (h: ScheduleEngine): string[][] => h.api.mock.calls.map(([, events]) => events.map((event) => event.type));

describe('A-08f3e4 Spielplan-Editor: wieder einplanen nur durch die Turnierleitung (@FU-071)', () => {
  let h: ScheduleEngine;

  beforeEach(async () => {
    vi.stubGlobal('indexedDB', new IDBFactory());
    h = await makeScheduleEngine();
  });
  afterEach(() => {
    role.actor = 'leitung';
    h.engine.stop();
    vi.unstubAllGlobals();
  });

  it('@FU-071 übersprungen · Tom · wieder einplanen → „nur Turnierleitung“ an der Karte, nichts gesendet', async () => {
    const tournament = await skipSpiel9(h);
    role.actor = 'helper';
    const user = userEvent.setup();
    render(<MatchEngineContext.Provider value={h.value}><EditorCard tournament={tournament} /></MatchEngineContext.Provider>);

    await user.click(screen.getByRole('button', { name: 'Wiederherstellen' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('nur Turnierleitung');
    expect(sentTypes(h)).toEqual([['SKIP']]);
    expect(h.engine.view(SPIEL_9)?.result.state.status).toBe('skipped');
  });

  it('@FU-071 Gegenbeispiel: Olli plant wieder ein → UNSKIP im Ausgang, kein Hinweis', async () => {
    const tournament = await skipSpiel9(h);
    const user = userEvent.setup();
    render(<MatchEngineContext.Provider value={h.value}><EditorCard tournament={tournament} /></MatchEngineContext.Provider>);

    await user.click(screen.getByRole('button', { name: 'Wiederherstellen' }));
    await settle();

    expect(sentTypes(h)).toEqual([['SKIP'], ['UNSKIP']]);
    expect(h.engine.view(SPIEL_9)?.result.state.status).toBe('scheduled');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
