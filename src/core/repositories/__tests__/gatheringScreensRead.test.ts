/**
 * A1b Lese-Seite der Bildschirme der Veranstaltung (gatheringScreensRead.ts). Testwerte aus dem Gherkin der Funktionalität G
 * (Record Veranstaltung): Nikolausturnier, Bildschirm „Halle“, F1-/F2-/D-Junioren; Antworten in der Form des Vertrags der
 * Migration 20261120_002 (die echte Server-Antwort prüft scripts/gathering-screens-check.sh).
 */
import { describe, it, expect } from 'vitest';
import {
  parseGatheringScreenDisplay,
  parseGatheringScreenStatus,
  parsePublicGatheringOnScreen,
  parseSetGatheringOnScreen,
} from '../gatheringScreensRead';

const SCREEN = {
  id: 'screen-halle',
  name: 'Halle',
  defaultSlideDuration: 15,
  transition: 'fade',
  overscanPercent: 5,
  slides: [
    { id: 's1', type: 'live', config: { fieldId: 'field-1' }, duration: null, order: 0 },
    { id: 's2', type: 'sponsor', config: { sponsorId: 'sp-bergader' }, duration: null, order: 1 },
  ],
};
const SPONSORS = [{ id: 'sp-bergader', name: 'Bergader', logoUrl: 'https://example.test/bergader.png' }];
const GATHERING = { name: 'Nikolausturnier', share_code: 'HALLE1' };
const F1_FULL_PAYLOAD = {
  state: 'full',
  tournament: {
    id: 't-f1', title: 'F1-Junioren Hallenturnier', date: '2026-11-28', number_of_fields: 1, number_of_teams: 2,
    group_phase_duration: 10, is_public: true, share_code: 'F1JUNI', config: {},
  },
  teams: [],
  matches: [],
};

describe('parseGatheringScreenDisplay', () => {
  it('@VA-036 Z. 6 @VA-043 ungültiger Schlüssel: invalid', () => {
    expect(parseGatheringScreenDisplay({ state: 'invalid' })).toEqual({ kind: 'invalid' });
  });

  it('@VA-036 Z. 2 Folie der Veranstaltung mit Folien, Sponsoren und den Turnieren für „Als Nächstes“', () => {
    const reply = parseGatheringScreenDisplay({
      state: 'gathering', version: 100, server_now: 1_800_000_000_000, gathering: GATHERING, screen: SCREEN, sponsors: SPONSORS,
      tournaments: [
        { title: 'F1-Junioren Hallenturnier', date: '2026-11-28', begin: '13:00:00', state: 'finished', last_match_started: true },
        { title: 'D-Junioren Hallenturnier', date: '2026-11-28', begin: '16:30:00', state: 'planned', last_match_started: false },
        { title: 'G-Junioren Hallenturnier', date: '2026-11-29', state: 'planned', last_match_started: false },
      ],
    });
    expect(reply.kind).toBe('gathering');
    if (reply.kind !== 'gathering') {return;}
    expect(reply.setup.screen.slides).toHaveLength(2);
    expect(reply.setup.gatheringCode).toBe('HALLE1');
    expect(reply.tournaments.map((t) => [t.title, t.begin, t.state])).toEqual([
      ['F1-Junioren Hallenturnier', '13:00:00', 'finished'],
      ['D-Junioren Hallenturnier', '16:30:00', 'planned'],
      ['G-Junioren Hallenturnier', null, 'planned'],
    ]);
  });

  it('@VA-035 Turnier in der Halle: volle Monitor-Antwort mit der Version des Bildschirms', () => {
    const reply = parseGatheringScreenDisplay({
      state: 'tournament', version: 200, server_now: 1_800_000_000_000,
      on_screen: { tournament_id: 't-f1', since: '2026-11-28T12:00:00+00:00' },
      gathering: GATHERING, screen: SCREEN, sponsors: SPONSORS, payload: F1_FULL_PAYLOAD,
    });
    expect(reply.kind).toBe('tournament');
    if (reply.kind !== 'tournament') {return;}
    expect(reply.tournamentId).toBe('t-f1');
    expect(reply.setup?.screen.name).toBe('Halle');
    expect(reply.payload.kind).toBe('full');
    expect(reply.payload.version).toBe(200);
    if (reply.payload.kind === 'full') {expect(reply.payload.tournament.title).toBe('F1-Junioren Hallenturnier');}
  });

  it('Delta des Turniers in der Halle ohne Folien (sie gelten weiter)', () => {
    const reply = parseGatheringScreenDisplay({
      state: 'tournament', version: 300, server_now: 1, on_screen: { tournament_id: 't-f1', since: null },
      payload: { state: 'delta', base_version: 200, tournament_date: '2026-11-28', matches: [] },
    });
    expect(reply.kind === 'tournament' && reply.setup === null && reply.payload.kind === 'delta').toBe(true);
  });

  it('@ZM-180 unchanged trägt die Version, nie Inhalt', () => {
    expect(parseGatheringScreenDisplay({ state: 'unchanged', version: 300, server_now: 5 }))
      .toEqual({ kind: 'unchanged', version: 300, serverNowMs: 5 });
  });

  it('@ME-032 Antwort außerhalb des Vertrags wirft: unbekannter Zustand, volle Antwort ohne Folien, fehlende Version', () => {
    expect(() => parseGatheringScreenDisplay({ state: 'moved' })).toThrow();
    expect(() => parseGatheringScreenDisplay({
      state: 'tournament', version: 1, server_now: 1, on_screen: { tournament_id: 't-f1' }, payload: F1_FULL_PAYLOAD,
    })).toThrow();
    expect(() => parseGatheringScreenDisplay({ state: 'gathering', server_now: 1, gathering: GATHERING, screen: SCREEN, sponsors: [], tournaments: [] }))
      .toThrow();
  });

  it('@VA-043 unbekannte Felder (etwa ein Schlüssel) fallen beim Prüfen weg', () => {
    const reply = parseGatheringScreenDisplay({
      state: 'gathering', version: 1, server_now: 1, gathering: GATHERING, screen: { ...SCREEN, key: 'geheim' },
      sponsors: [{ ...SPONSORS[0], contact: 'vertrieb@bergader.test' }], tournaments: [],
    });
    expect(JSON.stringify(reply)).not.toContain('geheim');
    expect(JSON.stringify(reply)).not.toContain('vertrieb@');
  });
});

describe('parseGatheringScreenStatus und parseSetGatheringOnScreen', () => {
  it('@VA-039 Maria (Co-Admin F1), F2 steht in der Halle: zulässig, nicht selbst, anderes Turnier ohne Titel', () => {
    const status = parseGatheringScreenStatus({
      in_gathering: true, has_screens: true, eligible: true, reason: null, on_screen_self: false,
      on_screen: { other: true, since: '2026-11-28T08:00:00+00:00' }, handed_over_monitor_ids: [],
    });
    expect(status.onScreen).toEqual({ kind: 'other', since: '2026-11-28T08:00:00+00:00' });
    expect(status.eligible && !status.onScreenSelf).toBe(true);
  });

  it('@VA-041 Turnier ohne Veranstaltung: nicht zulässig mit Grund; @VA-042 übernommener Monitor genannt', () => {
    const status = parseGatheringScreenStatus({
      in_gathering: false, has_screens: false, eligible: false, reason: 'not_in_gathering', on_screen_self: false,
      on_screen: null, handed_over_monitor_ids: ['mon-halle'],
    });
    expect([status.reason, status.onScreen, status.handedOverMonitorIds]).toEqual(['not_in_gathering', null, ['mon-halle']]);
    expect(() => parseGatheringScreenStatus({ ...status, reason: 'unbekannt' })).toThrow();
  });

  it('@VA-038 Antwort des Umschaltens nennt das Turnier danach', () => {
    expect(parseSetGatheringOnScreen({ on_screen: { tournament_id: 't-d', title: 'D-Junioren Hallenturnier', since: null } }))
      .toEqual({ kind: 'known', tournamentId: 't-d', title: 'D-Junioren Hallenturnier', since: null });
    expect(parseSetGatheringOnScreen({ on_screen: null })).toBeNull();
  });
});

describe('parsePublicGatheringOnScreen', () => {
  it('@VA-045 „Jetzt in der Halle: D-Junioren · Spiel 7 läuft 2:1“', () => {
    expect(parsePublicGatheringOnScreen({
      state: 'full', on_screen: { share_code: 'DJUNIO', title: 'D-Junioren Hallenturnier',
        live_matches: [{ match_number: 7, field: 1, status: 'running', score_a: 2, score_b: 1 }] },
    })).toEqual({ shareCode: 'DJUNIO', title: 'D-Junioren Hallenturnier',
      liveMatches: [{ matchNumber: 7, field: 1, status: 'running', score: { a: 2, b: 1 } }] });
  });

  it('@VA-045 Kindermodus: „Spiel 7 läuft“ ohne Stand', () => {
    const onScreen = parsePublicGatheringOnScreen({
      state: 'full', on_screen: { share_code: 'DJUNIO', title: 'D-Junioren Hallenturnier',
        live_matches: [{ match_number: 7, field: 1, status: 'running' }] },
    });
    expect(onScreen?.liveMatches[0].score).toBeNull();
  });

  it('@VA-047 nichts auf den Bildschirmen: kein on_screen -> null (Hinweis nach Uhrzeit)', () => {
    expect(parsePublicGatheringOnScreen({ state: 'full', tournaments: [] })).toBeNull();
    expect(parsePublicGatheringOnScreen({ state: 'pending' })).toBeNull();
  });
});
