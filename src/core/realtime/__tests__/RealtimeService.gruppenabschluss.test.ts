/**
 * GA4 A-13b-C Punkt 5: Realtime für „Gruppe abschließen“ – `group_completions`, `bracket_notices`, `clarifications` laufen im
 * selben Kanal wie die Spiele (`tournament-<id>`). Ändert ein anderes Gerät einen Abschluss, bekommt die Turnierverwaltung
 * den Anstoß zum Neuladen (@TM-116, @TM-071). Ohne Rückruf bindet der Dienst nichts (A-08f3b2: eine Bindung auf eine Tabelle
 * außerhalb der Publikation ließe den ganzen Kanal ablehnen).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

interface MockChannel {
  on: ReturnType<typeof vi.fn>;
  subscribe: ReturnType<typeof vi.fn>;
}

const hoisted = vi.hoisted(() => {
  const channels: MockChannel[] = [];
  const supabaseMock = {
    channel: vi.fn(() => {
      const channel: MockChannel = { on: vi.fn(() => channel), subscribe: vi.fn(() => channel) };
      channels.push(channel);
      return channel;
    }),
    removeChannel: vi.fn(() => Promise.resolve('ok')),
  };
  return { channels, supabaseMock };
});

vi.mock('../../../lib/supabase', () => ({ supabase: hoisted.supabaseMock, isSupabaseConfigured: true }));

import { RealtimeService } from '../RealtimeService';

type Binding = [kind: string, filter: { table?: string; filter?: string }, handler: (payload: unknown) => void];
const bindings = (): Binding[] => hoisted.channels[0].on.mock.calls as unknown as Binding[];
const tables = (): string[] => bindings().filter(([kind]) => kind === 'postgres_changes').map(([, f]) => f.table ?? '');

describe('Realtime: Abschlüsse, Hinweise und Klärungen im Kanal des Turniers (A-13b-C Punkt 5)', () => {
  beforeEach(() => { hoisted.channels.length = 0; vi.clearAllMocks(); });

  it('mit Rückruf: alle drei Tabellen werden im Kanal des Turniers abonniert, gefiltert auf das Turnier', () => {
    new RealtimeService().subscribeTournament({ tournamentId: 't1', onMatchChange: vi.fn(), onBracketChange: vi.fn() });
    expect(hoisted.supabaseMock.channel).toHaveBeenCalledWith('tournament-t1');
    expect(tables()).toEqual(expect.arrayContaining(['matches', 'group_completions', 'bracket_notices', 'clarifications']));
    for (const table of ['group_completions', 'bracket_notices', 'clarifications']) {
      const [, filter] = bindings().find(([, f]) => f.table === table) ?? [];
      expect(filter).toMatchObject({ schema: 'public', event: '*', filter: 'tournament_id=eq.t1' });
    }
  });

  it('eine Änderung an einer der Tabellen ruft onBracketChange mit der Tabelle und der Art', () => {
    const onBracketChange = vi.fn();
    new RealtimeService().subscribeTournament({ tournamentId: 't1', onBracketChange });
    for (const table of ['group_completions', 'bracket_notices', 'clarifications']) {
      const handler = bindings().find(([, f]) => f.table === table)?.[2];
      handler?.({ eventType: 'UPDATE', new: { stale: true }, old: {} });
    }
    expect(onBracketChange.mock.calls.map(([payload]) => (payload as { table: string }).table))
      .toEqual(['group_completions', 'bracket_notices', 'clarifications']);
    expect(onBracketChange.mock.calls[0][0]).toMatchObject({ eventType: 'UPDATE', schema: 'public', new: { stale: true } });
  });

  it('Gegenbeispiel: ohne onBracketChange wird keine der drei Tabellen gebunden (der Kanal bleibt, wie er war)', () => {
    new RealtimeService().subscribeTournament({ tournamentId: 't1', onMatchChange: vi.fn() });
    expect(tables()).toEqual(['matches']);
  });
});
