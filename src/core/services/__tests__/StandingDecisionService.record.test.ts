/**
 * GA4 A-13b-C: Schreibweg der Entscheidungen über `record_standing_decision` (R-GA4v2-1). Aus den Anforderungen:
 * @W2A-004/@ET-027 (Reihenfolge mit Grund), @W2A-063 (Annahme ohne Grund), @W2A-062 (ohne Netz), @W2A-060 (die erste gilt),
 * @W2A-070 (Zurücknehmen), Review A-13b-S Auflage 2 (`40P01`/`55P03` → „Bitte erneut versuchen“).
 */
import { describe, expect, it } from 'vitest';
import { RetryLaterError } from '../../errors';
import { StandingDecisionService } from '../StandingDecisionService';
import type { ITournamentRepository } from '../../repositories/ITournamentRepository';
import type { RecordDecisionRequest, RecordDecisionResult } from '../../repositories/groupCompletionCloud';
import { jgj, MemoryRepo, nikolaus, order, shared, shootout } from '../../standings/__tests__/decisionTestKit';
import { DATA } from '../../standings/__tests__/fixtures';

/** Repository, das nur die Aufrufe festhält und eine feste Antwort gibt. */
function spyRepo(base: MemoryRepo, answer: RecordDecisionResult = { status: 'ok', alreadyApplied: false, version: 2 }) {
  const calls: Array<{ request: RecordDecisionRequest; expectedVersion: number }> = [];
  const repo = {
    get: () => base.get(),
    recordStandingDecision: (_id: string, request: RecordDecisionRequest, expectedVersion: number) => {
      calls.push({ request, expectedVersion });
      return Promise.resolve(answer);
    },
  } as unknown as ITournamentRepository;
  return { repo, calls, service: new StandingDecisionService(repo, { groupClosed: () => false, newId: () => 'e-neu' }) };
}

describe('Grund nur bei einer Reihenfolge (@W2A-063, @W2A-004)', () => {
  it('@W2A-004 Reihenfolge (3 Teams): der getrimmte Grund geht an den Server, die Entscheidung selbst trägt keinen', async () => {
    const base = new MemoryRepo(jgj('WOUMNB', DATA.W2A_044, [1]));
    const { service, calls } = spyRepo(base);
    expect((await service.decide(base.tournament.id, order(['U', 'W', 'O'], '  Strafstoßschießen  '))).ok).toBe(true);
    expect(calls[0].request).toMatchObject({ action: 'decide', reason: 'Strafstoßschießen' });
    expect(calls[0].request.action === 'decide' && 'reason' in calls[0].request.decision).toBe(false);
    expect(calls[0].expectedVersion).toBe(1);
  });

  it('@W2A-063 Annahme: der Dienst schickt keinen Grund – auch dann nicht, wenn der Entwurf einen trägt', async () => {
    const base = new MemoryRepo(nikolaus());
    const { service, calls } = spyRepo(base);
    expect((await service.decide(base.tournament.id, { ...shared(['P', 'D']), reason: 'Hallenzeit zu Ende' })).ok).toBe(true);
    expect(calls[0].request.action === 'decide' && calls[0].request.reason).toBeFalsy();
  });

  it('@ET-027 Strafstoßschießen: kein Grund, das Ergebnis steht in der Entscheidung', async () => {
    const base = new MemoryRepo(nikolaus());
    const { service, calls } = spyRepo(base);
    expect((await service.decide(base.tournament.id, { ...shootout('D', 'P', 4, 3), reason: 'egal' })).ok).toBe(true);
    expect(calls[0].request.action === 'decide' && calls[0].request.reason).toBeFalsy();
    expect(calls[0].request).toMatchObject({ decision: { kind: 'shootout', shootout: { winner: 4, loser: 3 } } });
  });
});

/** Wie aus einer Cloud-Zeile mit `version IS NULL` gelesen (`mapTournamentFromSupabase`: `version` fehlt). */
function ohneVersion(): MemoryRepo {
  const base = new MemoryRepo(nikolaus());
  base.tournament = { ...base.tournament, version: undefined };
  return base;
}

describe('Turnier ohne Version (Zeile mit version IS NULL) – Cloud-E2E N6d (@ET-055, @W2A-067)', () => {
  it('@ET-055 ohne Version schickt der Dienst die erwartete Version 0 (Vertrag mit record_standing_decision ab 20261110_010: NULL gilt als 0)', async () => {
    const base = ohneVersion();
    const { service, calls } = spyRepo(base);
    expect((await service.decide(base.tournament.id, shootout('D', 'P', 4, 3))).ok).toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0].expectedVersion).toBe(0);
  });

  it('@ET-055 Gegenbeispiel: lehnt der Server dennoch zweimal mit STALE ab, meldet der Dienst STALE (die Oberfläche zeigt es) statt still zu scheitern', async () => {
    const base = ohneVersion();
    const { service, calls } = spyRepo(base, { status: 'rejected', code: 'STALE' });
    expect(await service.decide(base.tournament.id, shootout('D', 'P', 4, 3))).toEqual({ ok: false, code: 'STALE' });
    expect(calls).toHaveLength(2); // einmal frisch gelesen und erneut versucht
  });
});

describe('Verklemmung und Wartezeit am Server: „Bitte erneut versuchen“ (Review A-13b-S Auflage 2)', () => {
  it.each(['40P01', '55P03'] as const)('%s beim Eintragen: RETRY_LATER, nichts geschrieben; ein zweiter Versuch gelingt', async (sqlState) => {
    const repo = new MemoryRepo(nikolaus());
    repo.failNextWith = new RetryLaterError('recordStandingDecision', sqlState);
    expect(await repo.service(['e-1']).decide(repo.tournament.id, shootout('D', 'P', 4, 3))).toEqual({ ok: false, code: 'RETRY_LATER' });
    expect(repo.writes).toBe(0);
    expect(repo.tournament.standingDecisions ?? []).toEqual([]);
    // Gegenbeispiel: ein Wiederholversuch ist erlaubt und gelingt
    expect((await repo.service(['e-1']).decide(repo.tournament.id, shootout('D', 'P', 4, 3))).ok).toBe(true);
    expect(repo.writes).toBe(1);
  });

  it('40P01 beim Zurücknehmen: RETRY_LATER, die Entscheidung bleibt', async () => {
    const repo = new MemoryRepo(nikolaus());
    await repo.service(['e-1']).decide(repo.tournament.id, shootout('D', 'P', 4, 3));
    repo.failNextWith = new RetryLaterError('recordStandingDecision', '40P01');
    expect(await repo.service().withdraw(repo.tournament.id, 'e-1')).toEqual({ ok: false, code: 'RETRY_LATER' });
    expect(repo.tournament.standingDecisions?.map((d) => d.id)).toEqual(['e-1']);
  });

  it('ein anderer Fehler des Repositories wird nicht zu „erneut versuchen“ verharmlost, sondern geworfen', async () => {
    const repo = new MemoryRepo(nikolaus());
    repo.failNextWith = new Error('unerwartet');
    await expect(repo.service().decide(repo.tournament.id, shootout('D', 'P', 4, 3))).rejects.toThrow('unerwartet');
  });
});

describe('Antworten des Servers', () => {
  it('@W2A-062 ohne Netz: OFFLINE bei Eintragen und Zurücknehmen, nichts geschrieben', async () => {
    const repo = new MemoryRepo(nikolaus());
    repo.online = false;
    expect(await repo.service().decide(repo.tournament.id, shootout('D', 'P', 4, 3))).toEqual({ ok: false, code: 'OFFLINE' });
    expect(repo.writes).toBe(0);
  });

  it('@W2A-070 der Server kennt den Abschluss schon (WITHDRAW_NOT_ALLOWED), das Gerät noch nicht: der Dienst meldet es, schreibt nichts', async () => {
    const base = new MemoryRepo(nikolaus());
    await base.service(['e-1']).decide(base.tournament.id, shootout('D', 'P', 4, 3));
    const { repo } = spyRepo(base, { status: 'rejected', code: 'WITHDRAW_NOT_ALLOWED' });
    const service = new StandingDecisionService(repo, { groupClosed: () => false });
    expect(await service.withdraw(base.tournament.id, 'e-1')).toEqual({ ok: false, code: 'WITHDRAW_NOT_ALLOWED' });
  });

  it('@W2A-070 die Entscheidung ist am Server schon weg (NOT_FOUND): Zurücknehmen gilt als erledigt', async () => {
    const base = new MemoryRepo(nikolaus());
    await base.service(['e-1']).decide(base.tournament.id, shootout('D', 'P', 4, 3));
    const { repo } = spyRepo(base, { status: 'rejected', code: 'NOT_FOUND' });
    expect(await new StandingDecisionService(repo, { groupClosed: () => false }).withdraw(base.tournament.id, 'e-1')).toEqual({ ok: true });
  });

  it('Versionskonflikt (STALE) bleibt er auch nach dem zweiten Versuch, meldet die App STALE – Gegenbeispiel: beim ersten Mal wird neu gelesen', async () => {
    const base = new MemoryRepo(nikolaus());
    const { repo, calls } = spyRepo(base, { status: 'rejected', code: 'STALE', version: 9 });
    expect(await new StandingDecisionService(repo, { groupClosed: () => false }).decide(base.tournament.id, shootout('D', 'P', 4, 3))).toEqual({ ok: false, code: 'STALE' });
    expect(calls).toHaveLength(2);
  });

  it('kein Recht (42501 → forbidden) ist ein Fehler, den die Oberfläche als „hat nicht geklappt“ zeigt, kein stiller Erfolg', async () => {
    const base = new MemoryRepo(nikolaus());
    const { repo } = spyRepo(base, { status: 'forbidden' });
    await expect(new StandingDecisionService(repo, { groupClosed: () => false }).decide(base.tournament.id, shootout('D', 'P', 4, 3))).rejects.toThrow(/Berechtigung/);
  });
});
