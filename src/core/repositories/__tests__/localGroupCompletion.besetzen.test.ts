/**
 * GA4 A-13c (Review #336 A1): „Gruppe abschließen“ im lokalen Speicher (Gast) besetzt die Finalrunde – die Seite des Halbfinals
 * selbst ist danach ein Team (nicht nur die Rangfolge im Abschluss). Hallencup Nord als echt erzeugte Cloud-Zeilen.
 * @TM-016 (Plätze nach dem Abschluss), @TM-047 (jede Gruppe für sich), @TM-145 (offene Plätze bleiben offen), @TM-073 (nie still überschreiben).
 */
import { describe, expect, it } from 'vitest';
import type { Tournament } from '../../../types/tournament';
import { applyCompleteGroup } from '../localGroupCompletion';
import type { CompleteGroupRequest } from '../groupCompletionCloud';
import { expectedState } from '../../services/GroupCompletionService';
import { slotTeamId, teamSlot } from '../../models/matchSlot';
import { HC, matchLabelled, tournamentFromFixture } from '../../standings/__tests__/groupCompletionKit';

const RANG = [HC.nord, HC.sued, HC.west, HC.ost];
const anfrage = (t: Tournament, extra: Partial<CompleteGroupRequest> = {}): CompleteGroupRequest => ({
  groupId: 'A', ranking: RANG, openRanks: [], tieDecisions: [], knownDecisionIds: [], expectedState: expectedState(t, 'A'), ...extra,
});
const seite = (t: Tournament, label: string, side: 'slotA' | 'slotB') => matchLabelled(t, label)[side];

describe('@TM-016 lokaler Abschluss besetzt die Seiten der Finalrunde', () => {
  it('Gruppe A abgeschlossen: Halbfinale 1 Heim ist das Team FC Nord mit Herkunft „Erster A“, Halbfinale 2 Gast SV Süd; Gruppe B bleibt offen', () => {
    const t = tournamentFromFixture('hallencup');
    const { tournament, result } = applyCompleteGroup(t, anfrage(t));
    expect(tournament).toBeDefined();
    const nachher = tournament!;
    expect(seite(nachher, '1. Halbfinale', 'slotA')).toMatchObject({ kind: 'team', teamId: HC.nord, resolvedFrom: { kind: 'groupRank', group: 'A', rank: 1 } });
    expect(slotTeamId(seite(nachher, '2. Halbfinale', 'slotB'))).toBe(HC.sued);
    expect(seite(nachher, '1. Halbfinale', 'slotB').kind).toBe('pending'); // „Zweiter Gruppe B“ (@TM-047)
    expect(result).toMatchObject({ status: 'ok', changed: [{ side: 'A' }, { side: 'B' }] });
    expect(result.status === 'ok' && result.changed.map((c) => c.matchId).sort()).toEqual([matchLabelled(t, '1. Halbfinale').id, matchLabelled(t, '2. Halbfinale').id].sort());
  });

  it('@TM-145 Gegenbeispiel: ein offener Platz 2 bleibt leer (pending), Platz 1 wird besetzt', () => {
    const t = tournamentFromFixture('hallencup');
    const nachher = applyCompleteGroup(t, anfrage(t, { openRanks: [2] })).tournament!;
    expect(seite(nachher, '2. Halbfinale', 'slotB').kind).toBe('pending');
    expect(slotTeamId(seite(nachher, '1. Halbfinale', 'slotA'))).toBe(HC.nord);
  });

  it('@TM-073 Gegenbeispiel: eine von Hand besetzte Seite wird nicht überschrieben', () => {
    const t = tournamentFromFixture('hallencup');
    const hf1 = matchLabelled(t, '1. Halbfinale');
    const manuell = { ...t, matches: t.matches.map((m) => (m.id === hf1.id ? { ...m, slotA: teamSlot(HC.ost) } : m)) };
    const { tournament, result } = applyCompleteGroup(manuell, anfrage(manuell));
    expect(slotTeamId(seite(tournament!, '1. Halbfinale', 'slotA'))).toBe(HC.ost);
    expect(result.status === 'ok' && result.changed).toHaveLength(1);
  });
});
