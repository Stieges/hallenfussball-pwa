/**
 * Spiel beenden (20261110_009): was Zuschauer nach dem Beenden im Spielplan sehen -- über `buildTournamentView` auf der
 * Fixture „Hallencup Nord“ (Engine → cacheColumns → Mapper, kein von Hand gesetzter Status). Szenarien: @FU-112 („Mama
 * Petra sieht Spiel 9 als ‚Ende‘ mit dem Stand“), @FU-114 („nicht mehr als ‚Live‘“). Die 3 Sekunden misst die Generalprobe
 * (Realtime-Weg wie beim normalen Abpfiff, Review 2.6).
 */
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { buildTournamentView } from '../tournamentView';
import { viewStatusText } from '../status';
import type { TournamentView, ViewAudience, ViewMedium } from '../types';
import { fBEENDEN, GAME, type Hallencup } from '../__fixtures__/hallencupNord';

vi.mock('i18next', async () => (await import('./realI18n')).realI18nModule());

const PUBLIC: Array<[ViewAudience, ViewMedium]> = [['viewer', 'app'], ['screen', 'app'], ['organizer', 'app']];
const build = (cup: Hallencup, audience: ViewAudience = 'viewer', medium: ViewMedium = 'app'): TournamentView =>
  buildTournamentView(cup.tournament, { audience, medium, locale: 'de' });

let vorher: Hallencup;
let nachher: Hallencup;

beforeAll(async () => {
  vorher = await fBEENDEN(false);
  nachher = await fBEENDEN(true);
});

describe('@FU-114 vorher: Spielzeit abgelaufen, Abpfiff vergessen', () => {
  it('Spiel 7 ist für Zuschauer weiter „Live“ mit 1:0 (Gegenbeispiel zum Beenden)', () => {
    const m = build(vorher).byId.get(vorher.tournament.matches[GAME[7]].id);
    expect(m?.isLive).toBe(true);
    expect(m?.badge).toEqual({ kind: 'badge', state: 'live' });
    expect(viewStatusText(m?.status ?? 'scheduled', 'de')).toBe('Live');
  });
});

describe('@FU-112 @FU-114 nachher: im Spielplan beendet mit 2:2', () => {
  it.each(PUBLIC)('Spiel 7 ist „Ende“ mit 2:2, nicht mehr „Live“ (%s·%s)', (audience, medium) => {
    const m = build(nachher, audience, medium).byId.get(nachher.tournament.matches[GAME[7]].id);
    expect(m?.status).toBe('finished');
    expect(m?.isLive).toBe(false);
    expect(m?.badge).toEqual({ kind: 'badge', state: 'ended' });
    expect(viewStatusText(m?.status ?? 'scheduled', 'de')).toBe('Ende');
    expect([m?.score?.a, m?.score?.b]).toEqual([2, 2]);
  });

  it('Spiel 7 steht nicht mehr unter „läuft“ auf seinem Feld', () => {
    const v = build(nachher);
    const id = nachher.tournament.matches[GAME[7]].id;
    expect(v.current.live.map((m) => m.id)).not.toContain(id);
  });
});
