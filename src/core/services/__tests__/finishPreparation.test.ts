/**
 * R3-2b Abschluss vorbereiten (Plan R3 E4, E5, S1): was die App vor „Turnier abschließen“ prüft und sendet. Erwartungen aus dem
 * Gherkin docs/anforderungen/2026-10-01_turnier-lebenszyklus.md (Nikolaus statt der 16 Spiele mit Finalrunde – Finalrunde
 * ist Teil F), nicht am Code abgelesen. Das Turnier ist echt erzeugt (finishKit).
 *
 * Szenarien: @LZ-009, @LZ-010, @LZ-012, @LZ-013, @LZ-018 (Warnung sperrt nicht), @LZ-029; Plan E4 (bestätigter Stand,
 * „Erst übertragen“ / „Stand neu laden“), E5 (offene Klärung). S1 steht in useFinishTournament.test.tsx (Rechte-Datei liegt in features/).
 */
import { describe, expect, it } from 'vitest';
import type { Tournament } from '../../../types/tournament';
import { review } from '../../match/review/__tests__/reviewFixtures';
import { FinalStandingsSnapshotSchema } from '../../models/schemas/FinalStandingsSchema';
import { matchOf, NK, withMatch } from '../../standings/__tests__/groupCompletionKit';
import { prepareFinish, type FinishPreparationInput } from '../finishPreparation';
import { N7C, nikolausFertig, preflightFor } from './finishKit';

const NOW = '2026-11-28T17:30:00.000Z';

async function input(over: Partial<FinishPreparationInput> = {}): Promise<FinishPreparationInput> {
  const tournament = await nikolausFertig();
  return { tournament, preflight: preflightFor(tournament), reviews: [], ownPending: 0, appVersion: 'build-abc', computedAt: NOW, ...over };
}

/** Ein Tor mehr im Spiel Kammer – Waging rot, nur auf dem Gerät (optimistisch, noch nicht beim Server). */
function torLokal(t: Tournament): Tournament {
  const m = matchOf(t, NK.kammer, NK.wagingRot);
  return withMatch(t, m.id, { scoreA: (m.scoreA ?? 0) + 1 });
}

describe('@LZ-009 Turnier abschließen, wenn alles entschieden ist', () => {
  it('alles entschieden, nichts offen: gesendet wird der bestätigte Stand und der feste Endstand mit App-Version', async () => {
    const i = await input();
    const result = prepareFinish(i);
    expect(result.ok).toBe(true);
    if (!result.ok) { return; }
    expect(result.ready.expectedState).toBe(i.preflight.state);
    expect(result.ready.snapshot.ranking.map((row) => row.teamName)).toEqual(N7C);
    expect(result.ready.snapshot).toMatchObject({ format: 1, appVersion: 'build-abc', computedAt: NOW });
    expect(FinalStandingsSnapshotSchema.safeParse(result.ready.snapshot).success).toBe(true);
  });

  it('@LZ-018 eine Warnung „Feld 2: 3 Einträge noch nicht übertragen“ sperrt nicht, sie reist mit in die Bestätigung', async () => {
    const tournament = await nikolausFertig();
    const warnings = [{ kind: 'outbox_pending' as const, field: 2, pending: 3, reportedAt: NOW, deviceId: 'clara-handy' }];
    const result = prepareFinish(await input({ tournament, preflight: preflightFor(tournament, { warnings }) }));
    expect(result).toMatchObject({ ok: true, ready: { warnings } });
  });
});

describe('@LZ-010 @LZ-012 @LZ-013 Abschluss wird verweigert, solange etwas offen ist', () => {
  const zeilen: Array<[string, unknown]> = [
    ['das Spiel um Platz 3 läuft auf Feld 2', { kind: 'match_running', matchId: 'p3', matchNumber: 15, field: 2, finalType: 'thirdPlace' }],
    ['das Spiel um Platz 3 ist noch nicht angepfiffen', { kind: 'match_undecided', matchId: 'p3', matchNumber: 15, field: 2, finalType: 'thirdPlace' }],
    ['@LZ-013 die Gruppe ist noch nicht abgeschlossen', { kind: 'group_open', groupId: '' }],
    ['der Folgen-Hinweis ist offen', { kind: 'notice_open', noticeId: 3, matchId: 'hf1', side: 'A' }],
    ['ein offener Gleichstand in der Gruppe', { kind: 'tie_open', groupId: '', places: [3, 4], teamIds: [NK.petting, NK.otting] }],
  ];
  it.each(zeilen)('%s → ein Eintrag in der Liste, nichts gesendet', async (_lage, item) => {
    const tournament = await nikolausFertig();
    const items = [item] as FinishPreparationInput['preflight']['items'];
    expect(prepareFinish(await input({ tournament, preflight: preflightFor(tournament, { canFinish: false, items }) })))
      .toEqual({ ok: false, blocker: { code: 'OPEN_ITEMS', items } });
  });

  it('@LZ-010 (Klärung) ein offener Eintrag „Tor Heim, von Tom“ in der Klärungsliste hält den Abschluss auf (E5)', async () => {
    const offen = review({ eventId: 'tor-tom', matchId: 'hf2', matchNumber: 14, field: 1, author: 'Tom' });
    expect(prepareFinish(await input({ reviews: [offen] })))
      .toEqual({ ok: false, blocker: { code: 'OPEN_ITEMS', items: [{ kind: 'review_open', eventId: 'tor-tom', matchId: 'hf2', matchNumber: 14, field: 1 }] } });
  });

  it('@LZ-012 Spiel um Platz 3 läuft und 2 Klärungen offen → die Liste zeigt 3 Einträge', async () => {
    const tournament = await nikolausFertig();
    const laeuft = { kind: 'match_running' as const, matchId: 'p3', matchNumber: 15, field: 2, finalType: 'thirdPlace' };
    const result = prepareFinish(await input({
      tournament, preflight: preflightFor(tournament, { canFinish: false, items: [laeuft] }), reviews: [review({ eventId: 'k1' }), review({ eventId: 'k2' })],
    }));
    expect(result.ok).toBe(false);
    if (result.ok || result.blocker.code !== 'OPEN_ITEMS') { throw new Error('erwartet: OPEN_ITEMS'); }
    expect(result.blocker.items.map((item) => item.kind)).toEqual(['match_running', 'review_open', 'review_open']);
  });

  it('Gegenbeispiel E5: entschiedene Klärungen und Hinweise (kind notice) halten nicht auf', async () => {
    const entschieden = review({ decision: { type: 'REVIEW_ACCEPT', eventId: 'x', at: 1, by: 'olli' } });
    const hinweis = review({ kind: 'notice' });
    expect(prepareFinish(await input({ reviews: [entschieden, hinweis] })).ok).toBe(true);
  });
});

describe('Plan R3 E4: die App rechnet nur auf dem bestätigten Serverstand', () => {
  it('eigener Ausgang: das Gerät zeigt ein Tor, das noch wartet → „Erst übertragen“, kein Abschluss (kein STALE_STATE-Kreis)', async () => {
    const server = await nikolausFertig();
    const result = prepareFinish(await input({ tournament: torLokal(server), preflight: preflightFor(server), ownPending: 1 }));
    expect(result).toEqual({ ok: false, blocker: { code: 'OWN_OUTBOX', pending: 1 } });
  });

  it('@LZ-029 der Server hat einen neueren Stand (Korrektur von Maria), das Gerät wartet auf nichts → „Stand neu laden“', async () => {
    const geraet = await nikolausFertig();
    const result = prepareFinish(await input({ tournament: geraet, preflight: preflightFor(torLokal(geraet)), ownPending: 0 }));
    expect(result).toEqual({ ok: false, blocker: { code: 'STALE_STATE' } });
  });

  it('Gegenbeispiel: eigene wartende Einträge ohne Unterschied im Stand (z. B. eine Karte) halten nicht auf', async () => {
    expect(prepareFinish(await input({ ownPending: 2 })).ok).toBe(true);
  });

  it('vorläufiger Endstand (Gruppe nicht abgeschlossen, Server meldet nichts offen) → „Endstand ist noch vorläufig“', async () => {
    const t = { ...(await nikolausFertig()), groupCompletions: [] };
    expect(prepareFinish(await input({ tournament: t, preflight: preflightFor(t) }))).toEqual({ ok: false, blocker: { code: 'PROVISIONAL' } });
  });
});

describe('Zustand: nur „Läuft“ lässt sich abschließen', () => {
  it('schon abgeschlossen → ALREADY_FINISHED mit Zeit; festgelegt ohne Anpfiff → NOT_RUNNING', async () => {
    const t = await nikolausFertig();
    expect(prepareFinish(await input({ preflight: preflightFor(t, { lifecycle: 'finished', finishedAt: NOW, canFinish: false }) })))
      .toEqual({ ok: false, blocker: { code: 'ALREADY_FINISHED', at: NOW } });
    expect(prepareFinish(await input({ preflight: preflightFor(t, { lifecycle: 'fixed', canFinish: false }) })))
      .toEqual({ ok: false, blocker: { code: 'NOT_RUNNING', lifecycle: 'fixed' } });
  });
});
