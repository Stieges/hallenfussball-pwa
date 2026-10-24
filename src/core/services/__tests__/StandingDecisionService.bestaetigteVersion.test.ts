/**
 * R2 PR 1 (Befund C-ENTSCHEIDUNG-GEGEN-ANZEIGEVERSION): Eine Gleichstands-Entscheidung prüft am Server gegen die zuletzt vom
 * Server bestätigte Version der eigenen Kopie (`serverVersion`), nie gegen die lokal gestempelte Version der Ansicht.
 *
 * Anforderung @W2A-060 (Record `2026-09-27_wizard-regelinhalte`):
 *   Gegeben Olli und Maria (Co-Admin) sehen TSV Waging rot und DJK Kammer als „gleichauf – Entscheidung nötig“
 *   Wenn Olli 4:3 für TSV Waging rot und kurz danach Maria 5:4 für DJK Kammer einträgt
 *   Dann gilt Ollis Eintrag
 * Hier aus Marias Sicht: Ihr Gerät kennt Ollis Entscheidung noch nicht (eigene Änderung wartet, die ganze Cloud-Kopie wird
 * nicht übernommen), ihre Kopie trägt eine gestempelte Version, die zufällig der Server-Version nach Ollis Eintrag gleicht.
 * Der Server (Fake) nimmt nur die richtige Basis an.
 */
import { describe, expect, it } from 'vitest';
import { StandingDecisionService } from '../StandingDecisionService';
import type { ITournamentRepository } from '../../repositories/ITournamentRepository';
import type { RecordDecisionRequest, RecordDecisionResult } from '../../repositories/groupCompletionCloud';
import type { Tournament } from '../../../types/tournament';
import { MemoryRepo, nikolaus, shootout } from '../../standings/__tests__/decisionTestKit';

/** Server mit Version `serverAt`: nimmt eine Entscheidung nur gegen genau diese Version an (CAS wie `record_standing_decision`). */
function serverFake(copy: Tournament, serverAt: number) {
  const calls: number[] = [];
  let version = serverAt;
  const repo = {
    get: () => Promise.resolve(copy),
    recordStandingDecision: (_id: string, _request: RecordDecisionRequest, expectedVersion: number): Promise<RecordDecisionResult> => {
      calls.push(expectedVersion);
      if (expectedVersion !== version) {
        return Promise.resolve({ status: 'rejected', code: 'STALE', version });
      }
      version += 1;
      return Promise.resolve({ status: 'ok', alreadyApplied: false, version });
    },
  } as unknown as ITournamentRepository;
  return { calls, service: new StandingDecisionService(repo, { groupClosed: () => false, newId: () => 'e-maria' }) };
}

describe('R2 T1: die Entscheidung prüft gegen die bestätigte Server-Version (C-ENTSCHEIDUNG-GEGEN-ANZEIGEVERSION)', () => {
  it('@W2A-060 die erste gilt: Marias Kopie ist auf Version 8 bestätigt, lokal 9 gestempelt, der Server steht nach Ollis Eintrag auf 9 → Marias Eintrag wird nicht angenommen', async () => {
    const maria: Tournament = { ...new MemoryRepo(nikolaus()).tournament, version: 9, serverVersion: 8 };
    const { service, calls } = serverFake(maria, 9);

    const result = await service.decide(maria.id, shootout('D', 'P', 5, 4));

    expect(result).toEqual({ ok: false, code: 'STALE' });
    expect(calls.every((v) => v === 8)).toBe(true); // nie gegen die gestempelte 9
  });

  it('@W2A-060 Gegenbeispiel: ohne fremde Änderung (Server auf der bestätigten Version 8) gilt der Eintrag', async () => {
    const olli: Tournament = { ...new MemoryRepo(nikolaus()).tournament, version: 9, serverVersion: 8 };
    const { service, calls } = serverFake(olli, 8);

    expect((await service.decide(olli.id, shootout('D', 'P', 4, 3))).ok).toBe(true);
    expect(calls).toEqual([8]);
  });

  it('@W2A-060 Gegenbeispiel: ein Cloud-Objekt ohne `serverVersion` prüft gegen seine Version', async () => {
    const cloud: Tournament = { ...new MemoryRepo(nikolaus()).tournament, version: 5, serverVersion: undefined };
    const { service, calls } = serverFake(cloud, 5);

    expect((await service.decide(cloud.id, shootout('D', 'P', 4, 3))).ok).toBe(true);
    expect(calls).toEqual([5]);
  });

  it('@W2A-070 Zurücknehmen prüft ebenfalls gegen die bestätigte Version', async () => {
    const base = new MemoryRepo(nikolaus());
    const decided = await new StandingDecisionService(base as unknown as ITournamentRepository, { groupClosed: () => false, newId: () => 'e1' })
      .decide(base.tournament.id, shootout('D', 'P', 4, 3));
    expect(decided.ok).toBe(true);
    const copy: Tournament = { ...base.tournament, version: 12, serverVersion: 11 };
    const { service, calls } = serverFake(copy, 11);

    expect(await service.withdraw(copy.id, 'e1')).toEqual({ ok: true });
    expect(calls).toEqual([11]);
  });
});
