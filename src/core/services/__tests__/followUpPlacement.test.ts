/**
 * GA4 A-13c: lokales Besetzen der Finalrunde beim Abschluss (Zwilling von `apply_follow_up`). Aus dem Gherkin:
 * @TM-016 (Plätze nach dem Abschluss), @TM-047 (jede Gruppe für sich), @TM-145 (offene Plätze), @TM-073 (nie still überschreiben).
 */
import { describe, expect, it } from 'vitest';
import { placeFollowUps } from '../followUpPlacement';
import { HC, matchLabelled, tournamentFromFixture } from '../../standings/__tests__/groupCompletionKit';
import { slotTeamId, teamSlot } from '../../models/matchSlot';

const t = () => tournamentFromFixture('hallencup');
const RANG = [HC.nord, HC.sued, HC.west, HC.ost];
const seite = (tour: ReturnType<typeof t>, label: string, side: 'slotA' | 'slotB') => {
  const slot = matchLabelled(tour, label)[side];
  return slotTeamId(slot);
};

describe('placeFollowUps', () => {
  it('@TM-016 @TM-047 Gruppe A abgeschlossen: Halbfinale 1 Heim Nord, Halbfinale 2 Gast Süd; Gruppe B bleibt offen, Herkunft bleibt erhalten', () => {
    const { tournament, changed } = placeFollowUps(t(), 'A', RANG);
    expect(seite(tournament, '1. Halbfinale', 'slotA')).toBe(HC.nord);
    expect(seite(tournament, '2. Halbfinale', 'slotB')).toBe(HC.sued);
    expect(changed).toHaveLength(2);
    expect(matchLabelled(tournament, '1. Halbfinale').slotB.kind).toBe('pending'); // „Zweiter Gruppe B“
    expect(matchLabelled(tournament, '1. Halbfinale').slotA).toMatchObject({ resolvedFrom: { kind: 'groupRank', group: 'A', rank: 1 } });
  });

  it('@TM-145 offener Platz 2 bleibt offen', () => {
    const { tournament } = placeFollowUps(t(), 'A', RANG, [2]);
    expect(seite(tournament, '2. Halbfinale', 'slotB')).toBeUndefined();
    expect(seite(tournament, '1. Halbfinale', 'slotA')).toBe(HC.nord);
  });

  it('@TM-073 Gegenbeispiel: eine schon besetzte Seite wird nie überschrieben', () => {
    const start = t();
    const hf1 = matchLabelled(start, '1. Halbfinale');
    const manuell = { ...start, matches: start.matches.map((m) => (m.id === hf1.id ? { ...m, slotA: teamSlot(HC.ost) } : m)) };
    const { tournament, changed } = placeFollowUps(manuell, 'A', RANG);
    expect(seite(tournament, '1. Halbfinale', 'slotA')).toBe(HC.ost);
    expect(changed).toHaveLength(1);
  });

  it('Gegenbeispiel: Gruppe ohne Herkunft in der Finalrunde (Jeder gegen jeden) ändert nichts und liefert dasselbe Turnier', () => {
    const start = t();
    const result = placeFollowUps(start, '', RANG);
    expect(result.tournament).toBe(start);
    expect(result.changed).toEqual([]);
  });
});
