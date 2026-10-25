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

/**
 * R2 PR 2 – Befund C-LOKALER-NEUABSCHLUSS-KEIN-ZWILLING: der erneute Abschluss im lokalen Speicher (Gast) besetzt wie der Server.
 * @TM-071: Gruppe A war abgeschlossen mit 1. SV Süd, 2. FC Nord; nach der Korrektur ist FC Nord Erster → Halbfinale 1 Heim FC Nord,
 * Halbfinale 2 Gast SV Süd (beide nicht angepfiffen). Gegenbeispiele @TM-099 (angepfiffen bleibt), @TM-073 (von Hand bleibt),
 * @TM-145 (offener Platz geht auf die Herkunft zurück), @EK-017 (gleiche Rangfolge ändert nichts).
 */
describe('placeFollowUps beim erneuten Abschluss (@TM-071, Gast-Zwilling)', () => {
  const ALT = [HC.sued, HC.nord, HC.west, HC.ost];
  const abgeschlossen = () => placeFollowUps(t(), 'A', ALT).tournament;

  it('@TM-071 neue Rangfolge Nord, Süd: Halbfinale 1 Heim FC Nord, Halbfinale 2 Gast SV Süd, beide neu besetzt', () => {
    const { tournament, changed } = placeFollowUps(abgeschlossen(), 'A', RANG);
    expect(seite(tournament, '1. Halbfinale', 'slotA')).toBe(HC.nord);
    expect(seite(tournament, '2. Halbfinale', 'slotB')).toBe(HC.sued);
    expect(changed.map((c) => c.result)).toEqual(['reassigned', 'reassigned']);
    expect(matchLabelled(tournament, '1. Halbfinale').slotA).toMatchObject({ resolvedFrom: { kind: 'groupRank', group: 'A', rank: 1 } });
  });

  it('@TM-099 Gegenbeispiel: Halbfinale 1 schon angepfiffen → seine Heimseite bleibt SV Süd, Halbfinale 2 wird neu besetzt', () => {
    const start = abgeschlossen();
    const hf1 = matchLabelled(start, '1. Halbfinale');
    const angepfiffen = { ...start, matches: start.matches.map((m) => (m.id === hf1.id ? { ...m, matchStatus: 'running' as const } : m)) };
    const { tournament } = placeFollowUps(angepfiffen, 'A', RANG);
    expect(seite(tournament, '1. Halbfinale', 'slotA')).toBe(HC.sued);
    expect(seite(tournament, '2. Halbfinale', 'slotB')).toBe(HC.sued);
  });

  it('@TM-145 Platz 2 offen: Halbfinale 2 Gast geht zurück auf „Zweiter Gruppe A“ (Herkunft), Halbfinale 1 neu besetzt', () => {
    const { tournament, changed } = placeFollowUps(abgeschlossen(), 'A', RANG, [2]);
    expect(matchLabelled(tournament, '2. Halbfinale').slotB).toMatchObject({ kind: 'pending', source: { kind: 'groupRank', group: 'A', rank: 2 } });
    expect(changed).toContainEqual(expect.objectContaining({ result: 'released' }));
  });

  it('@EK-017 Gegenbeispiel: gleiche Rangfolge → nichts neu besetzt, dasselbe Turnier', () => {
    const start = abgeschlossen();
    const result = placeFollowUps(start, 'A', ALT);
    expect(result.changed).toEqual([]);
    expect(result.tournament).toBe(start);
  });
});
