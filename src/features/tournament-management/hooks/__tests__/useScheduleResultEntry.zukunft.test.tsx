/**
 * @SL-195 Zukunfts-Rückfrage im Hook: liegt der geplante Anstoß (Turnierdatum + Uhrzeit als Wanduhr des Turniers) nach Serverzeit (Wanduhr der Turnier-Zeitzone) noch in der Zukunft, fragt die App
 * „Spiel N ist erst um HH:MM geplant. Ergebnis trotzdem eintragen?“ – die Uhrzeit wie im Spielplan, in jeder Zeitzone des Geräts.
 * Gegenbeispiele: Anstoß in der Vergangenheit, ohne geplante Zeit, Finalrunde (trägt bis G3-Rest R2 unverändert inline ein).
 */
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';

vi.unmock('i18next');
vi.unmock('react-i18next');
vi.mock('../../../../hooks/useActorRole', () => ({ useActorRole: () => 'leitung' }));

import { MatchEngineContext } from '../../../match-engine/matchEngineContextInstance';
import { HALBFINALE_1, SPIEL_7, makeScheduleEngine, scheduleTournament, settle, type ScheduleEngine } from '../../../../test/scheduleEngineHarness';
import { useScheduleResultEntry } from '../useScheduleResultEntry';

/** Serverzeit im Harness: 2026-09-21; das Turnier liegt später. */
const SPAETER = '2026-12-05';
const FRUEHER = '2026-01-10';

function render(h: ScheduleEngine, date: string, withTime = true, uhr = '14:00') {
  const base = scheduleTournament({
    [SPIEL_7]: { scheduledTime: withTime ? new Date(`${date}T${uhr}:00`) : undefined },
    [HALBFINALE_1]: { scheduledTime: new Date(`${date}T${uhr}:00`) },
  });
  const tournament = { ...base, date, startDate: date };
  const showWarning = vi.fn();
  const wrapper = ({ children }: { children: ReactNode }) => <MatchEngineContext.Provider value={h.value}>{children}</MatchEngineContext.Provider>;
  const hook = renderHook(() => useScheduleResultEntry({ tournament, showWarning, lockFinishedResults: false }), { wrapper });
  const enter = (matchId: string) => {
    let done: Promise<boolean> = Promise.resolve(true);
    act(() => { done = hook.result.current.enterScore(matchId, 2, 1); });
    return done;
  };
  const answer = async (value: string | null) => { await act(async () => { hook.result.current.answerPrompt(value); await settle(); }); };
  return { hook, enter, answer };
}

describe.each(['UTC', 'Europe/Berlin', 'America/New_York', 'Pacific/Auckland'])('@SL-195 Zukunfts-Rückfrage (useScheduleResultEntry), Gerät in %s', (geraeteZone) => {
  let h: ScheduleEngine;
  const zone = process.env.TZ;

  beforeEach(async () => {
    process.env.TZ = geraeteZone; // der Anstoß gilt als Wanduhr des Turniers, in jeder Geräte-Zeitzone
    vi.stubGlobal('indexedDB', new IDBFactory());
    h = await makeScheduleEngine();
  });
  afterEach(() => {
    h.engine.stop();
    vi.unstubAllGlobals();
    if (zone === undefined) { delete process.env.TZ; } else { process.env.TZ = zone; }
  });

  it('Anstoß in der Zukunft (Gruppenspiel 14:00 Turnierzeit): Rückfrage „future“ nennt 14:00, wie im Spielplan, nie die Gerätestunde; „Nein“ speichert nichts', async () => {
    const { hook, enter, answer } = render(h, SPAETER);
    const done = enter(SPIEL_7);
    await act(async () => { await settle(); });
    expect(hook.result.current.prompt).toEqual({ kind: 'future', matchNumber: 7, time: '14:00' });
    await answer(null);
    await expect(done).resolves.toBe(false);
    expect(h.api).not.toHaveBeenCalled();
  });

  // Grenzfälle: „jetzt“ ist die Serverzeit als Wanduhr des Turniers (Europe/Berlin, Dezember = UTC+1), der Anstoß die Wanduhr des Turniers
  // (Konvention des Spielplans, `scheduleShiftClock`): beides unabhängig von der Zeitzone des Geräts. Der Unterschied zwischen Berlin und
  // jeder anderen Zone ist ≥ 1 h, die Fälle liegen 20–30 min auseinander und entlarven deshalb den Vergleich mit der rohen Serverzeit.
  it.each([
    ['14:00', '2026-12-05T12:30:00Z', true, 'Anstoß 14:00, jetzt 13:30 (Berlin): 30 min davor, Frage'],
    ['14:00', '2026-12-05T13:30:00Z', false, 'Anstoß 14:00, jetzt 14:30 (Berlin): 30 min danach, keine Frage'],
    ['23:50', '2026-12-05T23:10:00Z', false, 'Anstoß 23:50, jetzt 00:10 am Folgetag (Berlin), keine Frage'],
    ['00:10', '2026-12-04T22:50:00Z', true, 'Anstoß 00:10, jetzt 23:50 am Vortag (Berlin), Frage'],
  ])('Grenzfall: Anstoß %s, Serverzeit %s → Frage %s (%s)', async (uhr, jetzt, fragt) => {
    vi.spyOn(h.engine, 'serverNow').mockReturnValue(new Date(jetzt).getTime());
    const { hook, enter, answer } = render(h, SPAETER, true, uhr);
    const done = enter(SPIEL_7);
    await act(async () => { await settle(); });
    if (fragt) {
      expect(hook.result.current.prompt).toEqual({ kind: 'future', matchNumber: 7, time: uhr });
      await answer(null);
      await expect(done).resolves.toBe(false);
    } else {
      expect(hook.result.current.prompt?.kind).not.toBe('future');
      await done;
    }
  });

  it('Gegenbeispiel: Anstoß in der Vergangenheit fragt nicht', async () => {
    const { hook, enter } = render(h, FRUEHER);
    const done = enter(SPIEL_7);
    await act(async () => { await settle(); });
    expect(hook.result.current.prompt?.kind).not.toBe('future');
    await done;
  });

  it('Gegenbeispiel: ohne geplante Zeit fragt nicht', async () => {
    const { hook, enter } = render(h, SPAETER, false);
    const done = enter(SPIEL_7);
    await act(async () => { await settle(); });
    expect(hook.result.current.prompt?.kind).not.toBe('future');
    await done;
  });

  it('Gegenbeispiel Finalrunde: Halbfinale in der Zukunft fragt nicht (nur Gruppenphase)', async () => {
    const { hook, enter } = render(h, SPAETER);
    const done = enter(HALBFINALE_1);
    await act(async () => { await settle(); });
    expect(hook.result.current.prompt?.kind).not.toBe('future');
    await done;
  });
});
