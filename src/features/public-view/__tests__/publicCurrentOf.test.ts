/**
 * Kopfblock der Zuschauer-Seite (Paket Z2, @ZM-141): was oben steht, entscheidet die gemeinsame Ansicht.
 * Erwartung aus dem Gherkin von @ZM-141 (Grundriss, 4 Lagen), @ZM-041 und der Entscheidung Daniels vom 21.10.
 * („das früheste Spiel ohne Ergebnis, auch wenn es schon gespielt ist“). Fixture „Hallencup Nord“.
 */
import { describe, it, expect } from 'vitest';
import { buildTournamentView } from '../../../core/view';
import type { Tournament } from '../../../types/tournament';
import { fAUS, fPAUSE, fZEIT, publishHallencup, GAME } from '../../../core/view/__fixtures__/hallencupNord';
import { publicCurrentOf } from '../publicCurrentOf';

const view = (t: Tournament) => buildTournamentView(t, { audience: 'viewer', medium: 'app', locale: 'de' });
const idOf = (t: Tournament, index: number): string => t.matches[index].id;

describe('@ZM-141 Kopfblock: läuft gerade / als Nächstes / zuletzt beendet', () => {
  it('@ZM-141 Lage „Spiel 7 und 8 laufen“: beide stehen als laufend, kein nächstes Spiel (@ZM-041)', async () => {
    const { tournament } = await fPAUSE();
    const kopf = publicCurrentOf(view(tournament));
    expect(kopf?.kind).toBe('live');
    expect(kopf?.kind === 'live' ? kopf.matches.map((m) => m.id) : []).toEqual([idOf(tournament, GAME[7]), idOf(tournament, GAME[8])]);
  });

  it('@ZM-141 Lage „kein Spiel läuft, Spiel 9 beginnt um 14:40“: Spiel 9 als nächstes Spiel', async () => {
    const { tournament } = await fZEIT();
    const kopf = publicCurrentOf(view(tournament));
    expect(kopf?.kind).toBe('next');
    expect(kopf?.kind === 'next' ? kopf.match.id : '').toBe(idOf(tournament, GAME[9]));
  });

  it('@ZM-141 Gegenbeispiel (@ZM-104): ein ausgefallenes Spiel 9 ist nie „als Nächstes“, es folgt Spiel 10', async () => {
    const { tournament } = await fAUS();
    const kopf = publicCurrentOf(view(tournament));
    expect(kopf?.kind).toBe('next');
    expect(kopf?.kind === 'next' ? kopf.match.id : '').toBe(idOf(tournament, GAME[10]));
  });

  it('@ZM-141 Entscheidung 21.10.: das früheste Spiel ohne Ergebnis, auch wenn spätere Spiele schon beendet sind', async () => {
    const { tournament } = await fZEIT();
    const luecke = idOf(tournament, GAME[3]);
    const matches = tournament.matches.map((m) => (m.id === luecke ? { ...m, matchStatus: 'scheduled' as const, scoreA: undefined, scoreB: undefined } : m));
    const kopf = publicCurrentOf(view({ ...tournament, matches }));
    expect(kopf?.kind === 'next' ? kopf.match.id : '').toBe(luecke);
  });

  it('@ZM-141 Lage „alle Spiele beendet, Turnier nicht abgeschlossen“: das zuletzt beendete Spiel mit Ergebnis', async () => {
    const { tournament } = await fZEIT();
    const matches = tournament.matches.map((m) => ({ ...m, matchStatus: 'finished' as const, scoreA: 2, scoreB: 1 }));
    const kopf = publicCurrentOf(view({ ...tournament, matches }));
    expect(kopf?.kind).toBe('last');
    expect(kopf?.kind === 'last' ? kopf.match.score : undefined).toMatchObject({ a: 2, b: 1 });
  });

  it('@ZM-141 Gegenbeispiel: im Kindermodus gibt es kein Ergebnis, also keinen Block „zuletzt beendet“', async () => {
    const { tournament } = await fZEIT();
    const matches = tournament.matches.map((m) => ({ ...m, matchStatus: 'finished' as const, scoreA: 2, scoreB: 1 }));
    expect(publicCurrentOf(view({ ...tournament, matches, hideScoresForPublic: true }))).toBeNull();
  });

  it('@ZM-141 Gegenbeispiel: ohne Spiele kein leerer Kasten', async () => {
    const { tournament } = await publishHallencup();
    expect(publicCurrentOf(view({ ...tournament, matches: [] }))).toBeNull();
  });
});
