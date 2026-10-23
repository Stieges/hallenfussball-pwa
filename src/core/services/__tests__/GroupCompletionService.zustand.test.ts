/**
 * GA4 A-13a (Plan `task-GA4-plan-v2.md` § 5, Nachtrag 2026-10-21): Zustand von Gruppe und Phase, Vorschlag
 * „Gruppe abschließen“. Aus dem Gherkin abgeleitet, nicht am Code abgelesen. Turniere ECHT ERZEUGT
 * (publish → mapTournamentToSupabase → Mapper zurück, Fixture `group-state.json`).
 * Record `2026-10-01_turniermodi` (@TM-044, @TM-045, @TM-050, @TM-054, @TM-057, @TM-058, @TM-059, @TM-069, @TM-148),
 * `2026-09-27_wizard-regelinhalte` (@W2A-055).
 */
import { describe, expect, it } from 'vitest';
import type { Match, Tournament } from '../../../types/tournament';
import {
  everCompleted, groupClosedFromCompletions, groupState, groupStateLabel, phaseState, prepareGroupCompletion,
  proposeGroupCompletion, type GroupStateWord,
} from '../GroupCompletionService';
import { completion, HC, matchLabelled, matchOf, NK, tournamentFromFixture, withMatch } from '../../standings/__tests__/groupCompletionKit';

const hallencup = (): Tournament => tournamentFromFixture('hallencup');
const nikolaus = (): Tournament => tournamentFromFixture('nikolaus');
const groupMatchesOf = (t: Tournament, g: string): Match[] => t.matches.filter((m) => m.isFinal !== true && m.group === g);
const finished = (scoreA: number, scoreB: number): Partial<Match> => ({ matchStatus: 'finished', scoreA, scoreB, decidedBy: 'regular' });
const word = (t: Tournament, g: string): GroupStateWord => groupStateLabel(groupState(t, g)).word;

/** Alle Spiele von `g` entschieden (offene/laufende 1:0 abgepfiffen). */
function decideGroup(t: Tournament, g: string): Tournament {
  return groupMatchesOf(t, g).reduce((acc, m) => (['finished', 'skipped'].includes(m.matchStatus ?? '') ? acc : withMatch(acc, m.id, finished(1, 0))), t);
}

const withCompletions = (t: Tournament, ...groups: string[]): Tournament => ({
  ...t, groupCompletions: groups.map((g) => completion(g, t.teams.filter((team) => (team.group ?? '') === g).map((team) => team.id))),
});

/** Spiele der Finalrunde setzen: `labels` → Status. */
function finals(t: Tournament, status: Record<string, Partial<Match>>): Tournament {
  return Object.entries(status).reduce((acc, [label, change]) => withMatch(acc, matchLabelled(acc, label).id, change), t);
}

const skipped: Partial<Match> = { matchStatus: 'skipped', skippedReason: 'Hallenzeit abgelaufen' };

describe('A-13a @TM-059 Zustand von Gruppe und Phase', () => {
  it.each<{ lage: string; build: () => Tournament; teil: 'A' | 'groups' | 'finals'; zustand: GroupStateWord }>([
    { lage: 'in Gruppe A ist noch kein Spiel angepfiffen', build: () => tournamentFromFixture('hallencup', { results: false }), teil: 'A', zustand: 'open' },
    {
      lage: 'das erste Spiel von Gruppe A ist angepfiffen',
      build: () => { const t = tournamentFromFixture('hallencup', { results: false }); return withMatch(t, matchOf(t, HC.nord, HC.sued).id, { matchStatus: 'running', scoreA: 0, scoreB: 0 }); },
      teil: 'A', zustand: 'running',
    },
    { lage: 'alle Spiele von Gruppe A sind entschieden, Gruppe A ist noch nicht abgeschlossen', build: hallencup, teil: 'A', zustand: 'ready' },
    { lage: 'Gruppe A ist abgeschlossen', build: () => withCompletions(hallencup(), 'A'), teil: 'A', zustand: 'completed' },
    { lage: 'Gruppe A ist abgeschlossen, Gruppe B läuft noch', build: () => withCompletions(hallencup(), 'A'), teil: 'groups', zustand: 'running' },
    { lage: 'Gruppe A und Gruppe B sind abgeschlossen', build: () => withCompletions(decideGroup(hallencup(), 'B'), 'A', 'B'), teil: 'groups', zustand: 'completed' },
    {
      lage: 'alle Spiele der Finalrunde außer dem Finale sind entschieden',
      build: () => finals(withCompletions(decideGroup(hallencup(), 'B'), 'A', 'B'), { '1. Halbfinale': finished(2, 1), '2. Halbfinale': finished(1, 0), 'Spiel um Platz 3': finished(3, 2) }),
      teil: 'finals', zustand: 'running',
    },
    {
      lage: 'alle Spiele der Finalrunde sind entschieden',
      build: () => finals(withCompletions(decideGroup(hallencup(), 'B'), 'A', 'B'), { '1. Halbfinale': finished(2, 1), '2. Halbfinale': finished(1, 0), 'Spiel um Platz 3': finished(3, 2), Finale: finished(1, 0) }),
      teil: 'finals', zustand: 'completed',
    },
    {
      lage: 'die Halbfinals sind entschieden, Finale und Spiel um Platz 3 als „nicht ausgetragen“ beendet',
      build: () => finals(withCompletions(decideGroup(hallencup(), 'B'), 'A', 'B'), { '1. Halbfinale': finished(2, 1), '2. Halbfinale': finished(1, 0), 'Spiel um Platz 3': skipped, Finale: skipped }),
      teil: 'finals', zustand: 'completed',
    },
  ])('@TM-059 $lage → $teil „$zustand“', ({ build, teil, zustand }) => {
    const t = build();
    expect(teil === 'A' ? word(t, 'A') : phaseState(t, teil)).toBe(zustand);
  });

  it('@TM-059 genau vier Zustandswörter; „Besetzung prüfen“ und „noch nicht gesendet“ sind Zusatzmarken und ersetzen das Wort nie (Nachtrag 2026-10-21)', () => {
    expect(groupStateLabel('open')).toEqual({ word: 'open', flags: [] });
    expect(groupStateLabel('running')).toEqual({ word: 'running', flags: [] });
    expect(groupStateLabel('finished')).toEqual({ word: 'ready', flags: [] });
    expect(groupStateLabel('completed')).toEqual({ word: 'completed', flags: [] });
    expect(groupStateLabel('stale')).toEqual({ word: 'completed', flags: ['checkSlots'] });
    expect(groupStateLabel('stale', { unsent: true })).toEqual({ word: 'completed', flags: ['checkSlots', 'notSent'] });
    expect(groupStateLabel('finished', { unsent: true })).toEqual({ word: 'ready', flags: ['notSent'] });
    // Gegenbeispiel: ein nach Korrektur veralteter Abschluss bleibt „abgeschlossen“ (mit Marke), nicht „bereit“
    const veraltet = { ...hallencup(), groupCompletions: [completion('A', [HC.nord, HC.west, HC.sued, HC.ost], { stale: true })] };
    expect(groupState(veraltet, 'A')).toBe('stale');
    expect(groupStateLabel(groupState(veraltet, 'A'))).toEqual({ word: 'completed', flags: ['checkSlots'] });
  });

  it('@TM-059 Gegenbeispiele: ohne Spiel der Phase „offen“; ein „nicht ausgetragenes“ Finale allein beendet die Finalrunde nicht', () => {
    const frisch = tournamentFromFixture('hallencup', { results: false });
    expect([phaseState(frisch, 'groups'), phaseState(frisch, 'finals')]).toEqual(['open', 'open']);
    expect(phaseState(nikolaus(), 'finals')).toBe('open'); // Nikolaus hat keine Finalrunde
    expect(phaseState(finals(hallencup(), { Finale: skipped }), 'finals')).toBe('running');
  });
});

describe('A-13a Vorschlag „Gruppe abschließen“', () => {
  it('@TM-044 Hallencup Nord als Cloud-Zeilen: Gruppe A 6/6 → Vorschlag für A; die Plätze mit Herkunft aus Gruppe A bleiben unbesetzt', () => {
    const t = hallencup();
    const vorher = JSON.stringify(t);
    expect(proposeGroupCompletion(t)).toEqual(['A']);
    prepareGroupCompletion(t, 'A');
    expect(JSON.stringify(t)).toBe(vorher); // Vorschlagen und Vorbereiten ändern nichts
    expect([matchLabelled(t, '1. Halbfinale').slotA, matchLabelled(t, '2. Halbfinale').slotB]).toEqual([
      { kind: 'pending', source: { kind: 'groupRank', group: 'A', rank: 1 } },
      { kind: 'pending', source: { kind: 'groupRank', group: 'A', rank: 2 } },
    ]);
  });

  it('@TM-045 @TM-054 Gegenbeispiel: 5 von 6 entschieden, das sechste läuft 1:0 → kein Vorschlag, Abschluss nennt 1 offenes Spiel', () => {
    const t = withMatch(hallencup(), matchOf(hallencup(), HC.west, HC.ost).id, { matchStatus: 'running', scoreA: 1, scoreB: 0 });
    expect(proposeGroupCompletion(t)).toEqual([]);
    expect(groupState(t, 'A')).toBe('running');
    expect(prepareGroupCompletion(t, 'A')).toEqual({ code: 'OPEN_MATCHES', open: 1 });
    // Gegenbeispiel: noch nicht angepfiffen zählt ebenso als offen
    const offen = withMatch(hallencup(), matchOf(hallencup(), HC.west, HC.ost).id, { matchStatus: 'scheduled', scoreA: undefined, scoreB: undefined });
    expect(prepareGroupCompletion(offen, 'A')).toEqual({ code: 'OPEN_MATCHES', open: 1 });
  });

  it('@TM-058 Jeder gegen jeden (Nikolaus echt erzeugt, Spiele „all“): 14/15 → kein Vorschlag; das 15. abgepfiffen → Vorschlag für „“, bereit, Endstand steht noch nicht fest', () => {
    const t = nikolaus();
    const letztes = t.matches[t.matches.length - 1];
    const vierzehn = withMatch(t, letztes.id, { matchStatus: 'running', scoreA: 0, scoreB: 0 });
    expect(proposeGroupCompletion(vierzehn)).toEqual([]);
    expect(groupState(vierzehn, '')).toBe('running');

    expect(proposeGroupCompletion(t)).toEqual(['']);
    expect(groupState(t, '')).toBe('finished');
    expect(groupState(t, '')).not.toBe('completed');
    expect(phaseState(t, 'groups')).toBe('running'); // Endstand erst nach dem Abschluss
    // Die erzeugte Lage ist die Nikolaus-Lage (@W2A-067): Petting und Otting gleich auf 3 – erst entscheiden, dann bereit
    expect(prepareGroupCompletion(t, '')).toEqual({
      code: 'DECISION_REQUIRED',
      blocks: [{ groupId: '', teamIds: [NK.petting, NK.otting], place: 3, size: 2, mayShare: true }],
    });
    expect(groupState(t, 'all')).toBe('open'); // „all“ ist keine eigene Gruppe
  });

  it('@TM-057 Jeder gegen jeden: nach dem Abschluss der einzigen Gruppe ist die Gruppe und die Gruppenphase abgeschlossen', () => {
    const t = { ...nikolaus(), groupCompletions: [completion('', nikolaus().teams.map((team) => team.id))] };
    expect(groupState(t, '')).toBe('completed');
    expect(phaseState(t, 'groups')).toBe('completed');
    expect(proposeGroupCompletion(t)).toEqual([]);
  });

  it('@TM-050 ein ausgefallenes Spiel wird gewertet (SC Ost nicht angetreten) → entschieden, Vorschlag für Gruppe A', () => {
    const base = withMatch(hallencup(), matchOf(hallencup(), HC.west, HC.ost).id, { matchStatus: 'scheduled', scoreA: undefined, scoreB: undefined, decidedBy: undefined });
    expect(proposeGroupCompletion(base)).toEqual([]);
    const gewertet = withMatch(base, matchOf(base, HC.west, HC.ost).id, { matchStatus: 'finished', scoreA: 2, scoreB: 0, decidedBy: 'forfeit', forfeitAbsent: 'B' });
    expect(proposeGroupCompletion(gewertet)).toEqual(['A']);
    expect(groupState(gewertet, 'A')).toBe('finished');
  });

  it('@W2A-055 ein als „nicht ausgetragen“ beendetes Gruppenspiel zählt als entschieden; Gegenbeispiel: ohne Status-Abschluss bleibt es offen', () => {
    const t = withMatch(nikolaus(), nikolaus().matches[0].id, { matchStatus: 'skipped', scoreA: undefined, scoreB: undefined, skippedReason: 'Hallenzeit abgelaufen' });
    expect(proposeGroupCompletion(t)).toEqual(['']);
    expect(prepareGroupCompletion(t, '').code).not.toBe('OPEN_MATCHES');
    const ohne = withMatch(nikolaus(), nikolaus().matches[0].id, { matchStatus: 'scheduled', scoreA: undefined, scoreB: undefined });
    expect(prepareGroupCompletion(ohne, '')).toEqual({ code: 'OPEN_MATCHES', open: 1 });
  });

  it('@TM-069 Korrektur vor dem Abschluss ist folgenlos: Gruppe bleibt „bereit“, kein „Besetzung prüfen“, Vorschlag bleibt', () => {
    const t = hallencup();
    const korrigiert = withMatch(t, matchOf(t, HC.nord, HC.sued).id, finished(1, 2));
    expect(groupState(korrigiert, 'A')).toBe('finished');
    expect(groupStateLabel(groupState(korrigiert, 'A')).flags).toEqual([]);
    expect(proposeGroupCompletion(korrigiert)).toEqual(['A']);
    expect(matchLabelled(korrigiert, '2. Halbfinale').slotB.kind).toBe('pending');
  });

  it('@TM-148 selbst wieder geöffnet: Gruppe ist wieder „bereit“, der Vorschlag heißt „Erneut abschließen“, die Gruppe gilt nicht als abgeschlossen', () => {
    const offen = { ...hallencup(), groupCompletions: [completion('A', [HC.nord, HC.west, HC.sued, HC.ost], { reopenedAt: '2026-11-28T11:30:00Z' })] };
    expect(groupState(offen, 'A')).toBe('finished');
    expect(proposeGroupCompletion(offen)).toEqual(['A']);
    expect(everCompleted(offen, 'A')).toBe(true);
    expect(groupClosedFromCompletions(offen, 'A')).toBe(false);
    // Gegenbeispiel: nie abgeschlossen → „Gruppe abschließen“; abgeschlossen → geschlossen
    expect(everCompleted(hallencup(), 'A')).toBe(false);
    expect(groupClosedFromCompletions(withCompletions(hallencup(), 'A'), 'A')).toBe(true);
  });

  it('Nachtrag 2026-10-21 Punkt 4: zwei Gruppen gleichzeitig fertig – die zuerst fertige Gruppe steht vorn', () => {
    const beide = decideGroup(hallencup(), 'B');
    const zeit = (t: Tournament, g: string, at: string): Tournament =>
      groupMatchesOf(t, g).reduce((acc, m) => withMatch(acc, m.id, { finishedAt: at }), t);
    expect(proposeGroupCompletion(zeit(zeit(beide, 'A', '2026-11-28T10:40:00Z'), 'B', '2026-11-28T10:20:00Z'))).toEqual(['B', 'A']);
    expect(proposeGroupCompletion(zeit(zeit(beide, 'A', '2026-11-28T10:10:00Z'), 'B', '2026-11-28T10:20:00Z'))).toEqual(['A', 'B']);
    expect(proposeGroupCompletion(beide)).toEqual(['A', 'B']); // ohne Zeitpunkt nach Gruppe
  });
});
