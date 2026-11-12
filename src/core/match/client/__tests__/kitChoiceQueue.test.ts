/**
 * Warteschlange der Leibchen-Wahl (Leibchen 2b, Punkt 3): „Bestätigen“/„Keine Leibchen“ gehen über `match_kit_set`; ohne Netz wartet die Wahl und geht danach raus,
 * der Server kann abweisen (das Gerät nimmt die Weste zurück und sagt es), zwei Geräte widersprechen sich (die zuletzt angekommene gilt).
 * Szenarien: @SL-202, @SL-216, @SL-220, @SL-228, @SL-229, @SL-230, @SL-221 (Doppeltipp). Testwerte aus dem Gherkin (docs/anforderungen/2026-10-02_spiel-leiten.md).
 */
import { describe, expect, it, vi } from 'vitest';
import { KitChoiceQueue, type KitChoiceDeps, type KitChoiceInput } from '../kitChoiceQueue';
import type { MatchKitSetResult } from '../../../repositories/matchKitSetRpc';

const SPIEL = '00000000-0000-4000-8000-0000000000b2';
const WAGING = '00000000-0000-4000-8000-0000000000a1';
const PETTING = '00000000-0000-4000-8000-0000000000a2';
const GELB = '#FFCC00';
const ORANGE = '#FF9800';

const bestaetigen = (extra: Partial<KitChoiceInput> = {}): KitChoiceInput => ({
  matchId: SPIEL, decision: 'bib', bibSide: 'a', bibColor: GELB, teams: { a: WAGING, b: PETTING }, deviceId: 'gerät-1', controlEpoch: 2, ...extra,
});

function aufbau(antworten: MatchKitSetResult[] = []) {
  const store = new Map<string, string>();
  const send = vi.fn(async (): Promise<MatchKitSetResult> => antworten.shift() ?? { kind: 'saved', phase: 'before', decision: 'bib' });
  const deps: KitChoiceDeps = {
    send,
    storage: { get: (k) => store.get(k) ?? null, set: (k, v) => { store.set(k, v); } },
    storageKey: 'konto-1',
    now: () => 1_000,
  };
  return { queue: new KitChoiceQueue(deps), send, store, deps };
}

describe('@SL-230 die Zeile zeigt, ob die Wahl den Server schon erreicht hat', () => {
  it('@SL-230 ohne Netz bestätigt: Eintrag „pending“ (wird gesendet), die Wahl wartet', async () => {
    const { queue } = aufbau([{ kind: 'offline' }]);
    queue.submit(bestaetigen());
    await queue.flush();
    expect(queue.entries()).toHaveLength(1);
    expect(queue.entries()[0]).toMatchObject({ matchId: SPIEL, status: 'pending', decision: 'bib', bibSide: 'a', bibColor: GELB });
  });

  it('@SL-230 sobald der Server die Wahl hat, steht der Eintrag auf „sent“ (gesendet)', async () => {
    const { queue } = aufbau();
    queue.submit(bestaetigen());
    await queue.flush();
    expect(queue.entries()[0].status).toBe('sent');
  });

  it('@SL-216 nach der Rückkehr des Netzes geht dieselbe Wahl raus (zweiter Versuch), nicht doppelt gespeichert', async () => {
    const { queue, send } = aufbau([{ kind: 'offline' }, { kind: 'saved', phase: 'before', decision: 'bib' }]);
    queue.submit(bestaetigen());
    await queue.flush();
    await queue.flush();
    expect(send).toHaveBeenCalledTimes(2);
    expect(queue.entries()).toHaveLength(1);
    expect(queue.entries()[0].status).toBe('sent');
  });

  it('@SL-216 Gegenbeispiel: ein gesendeter Eintrag wird nicht erneut gesendet', async () => {
    const { queue, send } = aufbau();
    queue.submit(bestaetigen());
    await queue.flush();
    await queue.flush();
    expect(send).toHaveBeenCalledTimes(1);
  });
});

describe('@SL-209 @SL-228 die zuletzt bestätigte Wahl gilt: nie Gelb nach Orange', () => {
  it('@SL-202 Zeile 4: ohne Netz erst Gelb bestätigt, dann über „Ändern“ Orange – es bleibt nur Orange und es geht nur Orange raus', async () => {
    const { queue, send } = aufbau([{ kind: 'offline' }]);
    queue.submit(bestaetigen());
    await queue.flush();
    queue.submit(bestaetigen({ bibColor: ORANGE }));
    expect(queue.entries()).toHaveLength(1);
    expect(queue.entries()[0].bibColor).toBe(ORANGE);
    await queue.flush();
    expect(send).toHaveBeenCalledTimes(2);
    expect(send).toHaveBeenLastCalledWith(expect.objectContaining({ decision: 'bib', bibColor: ORANGE }));
  });

  it('@SL-218 „Bestätigen“ und dann „Ändern“ + „Keine Leibchen“: die Wahl ist aufgegeben (decision none)', async () => {
    const { queue } = aufbau();
    queue.submit(bestaetigen());
    await queue.flush();
    queue.submit({ matchId: SPIEL, decision: 'none', teams: { a: WAGING, b: PETTING }, deviceId: 'gerät-1', controlEpoch: 2 });
    expect(queue.entries()[0]).toMatchObject({ decision: 'none', status: 'pending' });
  });

  it('@SL-221 ein Doppeltipp unter einer Sekunde auf dieselbe Wahl löst keine zweite Sendung aus', async () => {
    const { queue, send } = aufbau([{ kind: 'offline' }]);
    queue.submit(bestaetigen());
    queue.submit(bestaetigen());
    await queue.flush();
    expect(send).toHaveBeenCalledTimes(1);
    expect(queue.entries()).toHaveLength(1);
  });
});

describe('@SL-229 weist der Server ab, nimmt das Gerät seine Weste zurück und sagt es', () => {
  it.each([
    { code: 'MATCH_FINISHED' as const, reason: undefined, fall: 'ein anderes Gerät hat das Spiel inzwischen angepfiffen / es ist beendet' },
    { code: 'TEAMS_CHANGED' as const, reason: undefined, fall: 'inzwischen ist ein anderes Team auf die Seite gekommen' },
    { code: 'NOT_CONTROLLER' as const, reason: 'STALE_EPOCH', fall: 'das Feld wurde inzwischen von einem anderen Gerät übernommen' },
  ])('@SL-229 $fall: der Eintrag verschwindet, die Meldung „nicht übernommen“ steht da', async ({ code, reason }) => {
    const { queue } = aufbau([{ kind: 'rejected', code, ...(reason === undefined ? {} : { reason }) }]);
    queue.submit(bestaetigen());
    await queue.flush();
    expect(queue.entries()).toHaveLength(0);
    expect(queue.notices()).toEqual([{ id: expect.any(String), matchId: SPIEL, kind: 'rejected', code, ...(reason === undefined ? {} : { reason }) }]);
  });

  it('@SL-227 Paul (Helfer, anderes Gerät hält Feld 1): NOT_CONTROLLER OTHER_DEVICE → Meldung für „Nur das steuernde Gerät kann Leibchen bestätigen.“', async () => {
    const { queue } = aufbau([{ kind: 'rejected', code: 'NOT_CONTROLLER', reason: 'OTHER_DEVICE' }]);
    queue.submit(bestaetigen());
    await queue.flush();
    expect(queue.notices()[0]).toMatchObject({ code: 'NOT_CONTROLLER', reason: 'OTHER_DEVICE' });
  });

  it('@SL-229 kein Recht mehr (42501): Eintrag weg, Meldung, keine Wiederholung', async () => {
    const { queue, send } = aufbau([{ kind: 'forbidden' }]);
    queue.submit(bestaetigen());
    await queue.flush();
    await queue.flush();
    expect(send).toHaveBeenCalledTimes(1);
    expect(queue.entries()).toHaveLength(0);
    expect(queue.notices()[0]).toMatchObject({ kind: 'failed' });
  });

  it('@SL-229 Gegenbeispiel: „offline“ ist keine Abweisung – der Eintrag bleibt, keine Meldung', async () => {
    const { queue } = aufbau([{ kind: 'offline' }]);
    queue.submit(bestaetigen());
    await queue.flush();
    expect(queue.entries()).toHaveLength(1);
    expect(queue.notices()).toHaveLength(0);
  });

  it('Meldung wegklicken: dismissNotice entfernt sie', async () => {
    const { queue } = aufbau([{ kind: 'rejected', code: 'LEAD_ONLY' }]);
    queue.submit(bestaetigen());
    await queue.flush();
    queue.dismissNotice(queue.notices()[0].id);
    expect(queue.notices()).toHaveLength(0);
  });
});

describe('@SL-228 zwei Geräte: ändert ein anderes Gerät die Wahl, zeigt dieses Gerät den neuen Stand und sagt es', () => {
  it('@SL-228 der Server hat unsere Wahl (sent); die Zeile zeigt dann etwas anderes: Eintrag weg, Meldung „von einem anderen Gerät geändert“', async () => {
    const { queue } = aufbau();
    queue.submit(bestaetigen(), { decision: undefined }); // die Zeile war offen, als Tom bestätigte
    await queue.flush();
    queue.reconcile(new Map([[SPIEL, { decision: 'bib' as const, bibSide: 'b' as const, bibColor: ORANGE, teams: { a: WAGING, b: PETTING } }]]));
    expect(queue.entries()).toHaveLength(0);
    expect(queue.notices()[0]).toMatchObject({ matchId: SPIEL, kind: 'changedElsewhere' });
  });

  it('@SL-228 die Zeile zeigt unsere Wahl: Eintrag weg, keine Meldung (der Server hat nachgezogen)', async () => {
    const { queue } = aufbau();
    queue.submit(bestaetigen());
    await queue.flush();
    queue.reconcile(new Map([[SPIEL, { decision: 'bib' as const, bibSide: 'a' as const, bibColor: GELB, teams: { a: WAGING, b: PETTING } }]]));
    expect(queue.entries()).toHaveLength(0);
    expect(queue.notices()).toHaveLength(0);
  });

  it('@SL-228 Gegenbeispiel: solange die Zeile noch den Stand von vor unserer Sendung zeigt (offen), bleibt der Eintrag und es gibt keine Meldung', async () => {
    const { queue } = aufbau();
    queue.submit(bestaetigen(), { decision: undefined });
    await queue.flush();
    queue.reconcile(new Map([[SPIEL, { decision: undefined, teams: { a: WAGING, b: PETTING } }]]));
    expect(queue.entries()).toHaveLength(1);
    expect(queue.notices()).toHaveLength(0);
  });

  it('@SL-212 stehen inzwischen andere Teams im Spiel (Zeile), ist die Wahl zurückgenommen: Eintrag weg, Meldung', async () => {
    const { queue } = aufbau([{ kind: 'offline' }]);
    queue.submit(bestaetigen());
    await queue.flush();
    queue.reconcile(new Map([[SPIEL, { decision: undefined, teams: { a: WAGING, b: '00000000-0000-4000-8000-0000000000a9' } }]]));
    expect(queue.entries()).toHaveLength(0);
    expect(queue.notices()[0]).toMatchObject({ kind: 'rejected', code: 'TEAMS_CHANGED' });
  });
});

describe('@SL-216 @SL-220 die Wahl übersteht das Neuladen', () => {
  it('@SL-216 ohne Netz bestätigt, Gerät neu geladen: der Eintrag ist wieder da und geht raus, sobald Netz ist', async () => {
    const a = aufbau([{ kind: 'offline' }]);
    a.queue.submit(bestaetigen());
    await a.queue.flush();
    const neu = new KitChoiceQueue({ ...a.deps, send: vi.fn((): Promise<MatchKitSetResult> => Promise.resolve({ kind: 'saved', phase: 'before', decision: 'bib' })) });
    expect(neu.entries()).toHaveLength(1);
    expect(neu.entries()[0]).toMatchObject({ matchId: SPIEL, status: 'pending', bibColor: GELB });
    await neu.flush();
    expect(neu.entries()[0].status).toBe('sent');
  });

  it('@SL-216 Gegenbeispiel: kaputter Speicherinhalt wird ignoriert, nicht geworfen', () => {
    const { deps } = aufbau();
    deps.storage.set('hf-kit-choices-v1:konto-1', '{kaputt');
    expect(() => new KitChoiceQueue(deps)).not.toThrow();
    expect(new KitChoiceQueue(deps).entries()).toEqual([]);
  });
});

describe('Abonnenten', () => {
  it('jede Änderung benachrichtigt, ohne Änderung nicht', async () => {
    const { queue } = aufbau();
    const horcher = vi.fn();
    queue.subscribe(horcher);
    queue.submit(bestaetigen());
    expect(horcher).toHaveBeenCalled();
    const n = horcher.mock.calls.length;
    queue.reconcile(new Map());
    expect(horcher).toHaveBeenCalledTimes(n);
  });
});

describe('@SL-202 @SL-230 eine Wahl, die während einer Sendung dazukommt, geht im selben Lauf raus', () => {
  function blockiert() {
    const loesen: Array<(r: MatchKitSetResult) => void> = [];
    const send = vi.fn(() => new Promise<MatchKitSetResult>((ok) => { loesen.push(ok); }));
    const store = new Map<string, string>();
    const queue = new KitChoiceQueue({ send, storage: { get: (k) => store.get(k) ?? null, set: (k, v) => { store.set(k, v); } }, storageKey: 'k', now: () => 1 });
    return { queue, send, loesen };
  }
  const gespeichert: MatchKitSetResult = { kind: 'saved', phase: 'before', decision: 'bib' };

  it('@SL-202 Gelb geht raus, währenddessen tippt Tom Orange: nach Gelb geht Orange raus, ohne dass ein neuer Auslöser nötig ist', async () => {
    const { queue, send, loesen } = blockiert();
    queue.submit(bestaetigen());
    const lauf = queue.flush();
    queue.submit(bestaetigen({ bibColor: ORANGE }));
    loesen[0](gespeichert);
    await vi.waitFor(() => { expect(send).toHaveBeenCalledTimes(2); });
    loesen[1](gespeichert);
    await lauf;
    expect(send).toHaveBeenLastCalledWith(expect.objectContaining({ bibColor: ORANGE }));
    expect(queue.entries()[0]).toMatchObject({ bibColor: ORANGE, status: 'sent' });
  });

  it('@SL-230 das Ergebnis der älteren Wahl setzt die neuere nicht auf „gesendet“: sie bleibt „wird gesendet“, bis ihre eigene Sendung zurück ist', async () => {
    const { queue, loesen } = blockiert();
    queue.submit(bestaetigen());
    const lauf = queue.flush();
    queue.submit(bestaetigen({ bibColor: ORANGE }));
    loesen[0](gespeichert);
    await vi.waitFor(() => { expect(loesen).toHaveLength(2); });
    expect(queue.entries()[0]).toMatchObject({ bibColor: ORANGE, status: 'pending' });
    loesen[1]({ kind: 'offline' });
    await lauf;
    expect(queue.entries()[0].status).toBe('pending');
  });

  it('@SL-229 die Abweisung der älteren Wahl (inzwischen ersetzt) meldet nichts und trifft die neuere nicht', async () => {
    const { queue, loesen } = blockiert();
    queue.submit(bestaetigen());
    const lauf = queue.flush();
    queue.submit(bestaetigen({ bibColor: ORANGE }));
    loesen[0]({ kind: 'rejected', code: 'LEAD_ONLY' });
    await vi.waitFor(() => { expect(loesen).toHaveLength(2); });
    expect(queue.notices()).toHaveLength(0);
    expect(queue.entries()).toHaveLength(1);
    loesen[1](gespeichert);
    await lauf;
  });

  it('@SL-221 Doppeltipp während der Sendung: dieselbe Wahl wird nicht ein zweites Mal gesendet', async () => {
    const { queue, send, loesen } = blockiert();
    queue.submit(bestaetigen());
    const lauf = queue.flush();
    queue.submit(bestaetigen());
    loesen[0](gespeichert);
    await lauf;
    expect(send).toHaveBeenCalledTimes(1);
    expect(queue.entries()).toHaveLength(1);
  });
});

describe('@SL-229 Zeile 1 eine alte Wahl vor dem Anpfiff wird nicht zum Nachtrag', () => {
  const zeile = (kickedOff: boolean) => new Map([[SPIEL, { decision: undefined, teams: { a: WAGING, b: PETTING }, kickedOff }]]);

  it('@SL-229 ein anderes Gerät hat angepfiffen, unsere Wahl vom Vorabend wartet noch: Eintrag weg, Meldung „zu spät“, nichts geht als Nachtrag raus', async () => {
    const { queue, send } = aufbau([{ kind: 'offline' }]);
    queue.submit(bestaetigen({ phase: 'before' }));
    await queue.flush();
    queue.reconcile(zeile(true));
    expect(queue.entries()).toHaveLength(0);
    expect(queue.notices()[0]).toMatchObject({ kind: 'tooLate', matchId: SPIEL });
    await queue.flush();
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('@SL-202 Gegenbeispiel: haben wir selbst angepfiffen, entfällt der Eintrag still (der Anpfiff trägt die Wahl)', async () => {
    const { queue } = aufbau([{ kind: 'offline' }]);
    queue.submit(bestaetigen({ phase: 'before' }));
    queue.discardStarted(new Set([SPIEL]));
    expect(queue.entries()).toHaveLength(0);
    expect(queue.notices()).toHaveLength(0);
  });

  it('@SL-150 Gegenbeispiel: ein Nachtrag der Turnierleitung im laufenden Spiel (phase live) bleibt', async () => {
    const { queue } = aufbau([{ kind: 'offline' }]);
    queue.submit(bestaetigen({ phase: 'live' }));
    await queue.flush();
    queue.reconcile(zeile(true));
    queue.discardStarted(new Set([SPIEL]));
    expect(queue.entries()).toHaveLength(1);
  });

  it('@SL-214 Gegenbeispiel: ist das Spiel nach „Anpfiff rückgängig“ nicht mehr angepfiffen, bleibt die danach bestätigte Wahl', async () => {
    const { queue } = aufbau([{ kind: 'offline' }]);
    queue.submit(bestaetigen({ phase: 'before' }));
    queue.discardStarted(new Set());
    queue.reconcile(zeile(false));
    expect(queue.entries()).toHaveLength(1);
  });
});
