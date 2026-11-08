/**
 * Befund C-ZEITVERSCHIEBUNG-NICHT-IN-CLOUD (Diagnose-Lauf 42425425872, PR #470): Olli verschiebt die Zeiten, das Speichern
 * wartet in der Warteschlange, und die App wird neu geladen (Tablet neu gestartet, Seite neu geladen, Browser beendet –
 * @FU-007). Nach dem Neustart liegt das Turnier der Warteschlange als JSON vor: `scheduledTime` und `originalStart` sind
 * ISO-Texte statt Date. Vorher machte der Mapper daraus „2026-11-“ (die ersten 8 Zeichen), der Server lehnte jedes Spiel
 * mit 22007 ab („invalid input syntax for type time“), und die Verschiebung kam nie an (Zuschauer ohne „(war …)“, @ZP-004;
 * am Nikolaus-Turnier das Vorziehen vor dem ersten Anpfiff, @ZP-089, @ZP-090).
 *
 * Gherkin (Record 2026-10-02_zeitplan-rueckt-nach, @ZP-004): „Wenn Olli alle Felder ab 15:30 um 10 Minuten nach hinten
 * verschiebt und bestätigt, dann zeigt Mama Petras Zuschauer-Seite Spiel 15 groß um 15:40 und klein „(war 15:30)““ – auch
 * wenn Ollis Gerät zwischen Bestätigen und Senden neu startet (@FU-007: wartende Einträge überstehen den Neustart).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Tournament } from '../../models/types';
import { mapTournamentToSupabase } from '../../repositories/supabaseMappers';
import { createMockTeams, createMockTournament } from '../../../test/factories';
import { testTeamSlot } from '../../../test/matchSlotFixtures';

vi.mock('../../../lib/sentry', () => ({ captureFeatureError: vi.fn() }));
vi.mock('../../../lib/supabase', () => ({ isSupabaseConfigured: false, supabase: null }));
vi.mock('../../match/client/guestEngineEntries', () => ({ hasGuestEngineEntries: vi.fn(async () => false) }));

class MapStorage {
  private readonly data = new Map<string, string>();
  get length(): number { return this.data.size; }
  clear(): void { this.data.clear(); }
  getItem(key: string): string | null { return this.data.get(key) ?? null; }
  key(index: number): string | null { return [...this.data.keys()][index] ?? null; }
  removeItem(key: string): void { this.data.delete(key); }
  setItem(key: string, value: string): void { this.data.set(key, String(value)); }
}

function setOnline(value: boolean): void {
  Object.defineProperty(globalThis, 'navigator', { value: { onLine: value }, configurable: true, writable: true });
}

async function loadQueueModule(storage: MapStorage) {
  vi.resetModules();
  vi.stubGlobal('window', Object.assign(new EventTarget(), { localStorage: storage, sessionStorage: storage }));
  const { MutationQueue } = await import('../MutationQueue');
  return MutationQueue;
}

async function flush(): Promise<void> {
  for (let i = 0; i < 20; i++) { await new Promise<void>((resolve) => setTimeout(resolve, 0)); }
}

const DAY = '2026-11-28';
const at = (hhmm: string) => new Date(`${DAY}T${hhmm}:00`);

/** Nach der Verschiebung (@ZP-004): Spiel 14 läuft um 15:15, Spiel 15 steht um 15:40 (war 15:30). */
function verschoben(): Tournament {
  const teams = createMockTeams(4, 1);
  return createMockTournament({
    id: 'hallencup-ost', date: DAY, teams, numberOfFields: 1,
    matches: [
      { id: 'm14', round: 1, field: 1, matchNumber: 14, slotA: testTeamSlot(teams[0].id), slotB: testTeamSlot(teams[1].id), scheduledTime: at('15:15'), matchStatus: 'running' },
      { id: 'm15', round: 2, field: 1, matchNumber: 15, slotA: testTeamSlot(teams[2].id), slotB: testTeamSlot(teams[3].id), scheduledTime: at('15:40'), originalStart: at('15:30') },
    ],
  });
}

const zeitSpalten = (t: Tournament) =>
  mapTournamentToSupabase(t, 'olli').matchRows.map((r) => [r.id, r.scheduled_start, r.original_start]);

describe('C-ZEITVERSCHIEBUNG-NICHT-IN-CLOUD: Verschiebung übersteht den Neustart vor dem Senden (@ZP-004, @FU-007)', () => {
  beforeEach(() => { vi.spyOn(console, 'warn').mockImplementation(() => undefined); });
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it('@ZP-004 @FU-007 nach dem Neustart sendet die Warteschlange 15:40 und „war 15:30“, nicht den Datumsanfang', async () => {
    const storage = new MapStorage();
    const MutationQueue = await loadQueueModule(storage);
    const localRepo = { get: vi.fn(async () => null), confirmUpload: vi.fn(async () => undefined) };
    setOnline(false);
    const vorher = new MutationQueue({ save: vi.fn() } as never, localRepo as never);
    vorher.enqueue('SAVE_TOURNAMENT', verschoben());
    vorher.dispose();

    // Neustart mit Netz: das Turnier kommt aus dem Speicher (JSON) und geht über den echten Mapper zum Server
    setOnline(true);
    const gesendet: Array<ReturnType<typeof zeitSpalten>> = [];
    const save = vi.fn(async (payload: Tournament) => { gesendet.push(zeitSpalten(payload)); return 2; });
    const nachher = new MutationQueue({ save } as never, localRepo as never);
    await nachher.process();
    await flush();
    nachher.dispose();

    expect(save).toHaveBeenCalledTimes(1);
    expect(gesendet).toEqual([[['m14', '15:15:00', null], ['m15', '15:40:00', '15:30:00']]]);
  });

  it('Gegenbeispiel: ohne Neustart (Date im Arbeitsspeicher) dieselben Spalten', () => {
    expect(zeitSpalten(verschoben())).toEqual([['m14', '15:15:00', null], ['m15', '15:40:00', '15:30:00']]);
  });

  it('eine reine Uhrzeit bleibt, wie sie ist; ein unlesbarer Wert wird laut abgelehnt statt still als Uhrzeit gesendet', () => {
    const t = verschoben();
    const text = { ...t, matches: [{ ...t.matches[1], scheduledTime: '15:40:00' as unknown as Date, originalStart: undefined }] };
    expect(zeitSpalten(text)).toEqual([['m15', '15:40:00', null]]);
    const kaputt = { ...t, matches: [{ ...t.matches[1], scheduledTime: '2026-11-xx' as unknown as Date }] };
    expect(() => zeitSpalten(kaputt)).toThrow(/Uhrzeit/);
  });
});
