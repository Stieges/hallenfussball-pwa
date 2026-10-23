/**
 * GA4 A-13b-C: Abschlüsse (`group_completions`) und Verlauf (`bracket_log`) haben keine eigene Version und ändern die
 * Turnier-Version nicht (außer bei neuen Entscheidungen). Die lokale Kopie folgt der Cloud darum auch im Feldweg
 * (gleiche Version, Regel Q blockiert die ganze Kopie): Ein Abschluss eines anderen Geräts muss ankommen (@TM-116,
 * @W2A-070 „zurücknehmen“ verschwindet), ohne `version` oder Eigenes zu berühren. Fehlende Cloud-Werte löschen nichts.
 */
import { describe, expect, it } from 'vitest';
import { changedServerTables, decideCloudAdoption } from '../cloudAdoption';
import { liveCup, revisions } from '../../../test/queueGuardFixtures';
import type { GroupCompletion, Tournament } from '../../../types/tournament';

const owned = (t: Tournament): Tournament => ({ ...t, ownerId: 'olli' });
const ABSCHLUSS: GroupCompletion = { groupId: 'A', ranking: ['a', 'b'], openRanks: [], stale: false, completedAt: '2026-12-06T10:00:00Z' };

function feldweg(local: Tournament, cloud: Tournament) {
  return decideCloudAdoption(local, { tournament: cloud, matchRevisions: revisions() }, revisions(), {
    mayCache: true, whole: false, owned, wholeAllowed: () => false,
  });
}

describe('Server-Tabellen im Feldweg (A-13b-C)', () => {
  it('@TM-116 ein Abschluss eines anderen Geräts kommt bei gleicher Version an, ohne die ganze Kopie zu ersetzen', () => {
    const adoption = feldweg(liveCup(7), { ...liveCup(7), groupCompletions: [ABSCHLUSS] });
    expect(adoption.save).toBeUndefined();
    expect(adoption.serverTables).toEqual({ groupCompletions: [ABSCHLUSS] });
  });

  it('@W2A-070 wird die Gruppe wieder geöffnet, kommt auch das an', () => {
    const local = { ...liveCup(7), groupCompletions: [ABSCHLUSS] };
    const adoption = feldweg(local, { ...liveCup(7), groupCompletions: [{ ...ABSCHLUSS, reopenedAt: '2026-12-06T11:00:00Z' }] });
    expect(adoption.serverTables?.groupCompletions?.[0].reopenedAt).toBe('2026-12-06T11:00:00Z');
  });

  it('@W2A-071 der Verlauf folgt der Cloud', () => {
    const log = [{ id: 1, kind: 'complete_group' as const, detail: {}, at: '2026-12-06T10:00:00Z' }];
    expect(feldweg(liveCup(7), { ...liveCup(7), decisionLog: log }).serverTables).toEqual({ decisionLog: log });
  });

  it('Gegenbeispiel: unverändert → nichts zu schreiben (kein Dauer-Schreiben)', () => {
    const local = { ...liveCup(7), groupCompletions: [ABSCHLUSS], decisionLog: [] };
    expect(feldweg(local, { ...liveCup(7), groupCompletions: [ABSCHLUSS], decisionLog: [] }).serverTables).toBeUndefined();
  });

  it('Gegenbeispiel: die Cloud hat den Wert nicht gelesen (undefined: vor _006, ohne Recht) → die lokale Kopie behält ihren Stand', () => {
    const local = { ...liveCup(7), groupCompletions: [ABSCHLUSS] };
    expect(changedServerTables(local, liveCup(7))).toBeUndefined();
  });

  it('Versionsweg: die ganze Kopie bringt Abschlüsse und Verlauf mit', () => {
    const cloud = { ...liveCup(8), groupCompletions: [ABSCHLUSS] };
    const adoption = decideCloudAdoption(liveCup(7), { tournament: cloud, matchRevisions: revisions() }, revisions(), { mayCache: true, whole: false, owned });
    expect(adoption.save?.groupCompletions).toEqual([ABSCHLUSS]);
  });
});
