/**
 * Task C2b, Aufgabe 1: Klartext je Ablehnungscode (D-C1).
 * Prueft die Pflichtcodes gegen de/en und `describeEvent` (Typ, Team, Minute).
 */
import { describe, expect, it } from 'vitest';
import type { EngineEvent, MatchContext } from '../../../../core/match/types';
import type { RejectedEntry } from '../../../../core/match/client/matchCopy';
import { EventTypeSchema } from '../../../../core/match/types';
import deCommon from '../../../../i18n/locales/de/common.json';
import enCommon from '../../../../i18n/locales/en/common.json';
import { describeEvent, rejectionReasonKey } from '../rejectionText';

const REQUIRED_CODES = [
  'INVALID_TRANSITION',
  'FORBIDDEN_ACTOR',
  'UNKNOWN_TARGET',
  'ALREADY_RETRACTED',
  'STALE_BASE',
  'INVALID_PAYLOAD',
  'MATCH_FINISHED',
  'NO_WINNER',
  'DEPENDS_ON_REJECTED',
  'ID_CONFLICT',
  'NOT_CONTROLLER',
  'MATCH_FULL',
  'MATCH_GONE',
];

type JsonValue = Record<string, unknown>;

function hasKey(root: JsonValue, dottedKey: string): boolean {
  let node: unknown = root;
  for (const part of dottedKey.split('.')) {
    if (typeof node !== 'object' || node === null || Array.isArray(node)) {
      return false;
    }
    node = (node as JsonValue)[part];
    if (node === undefined) {
      return false;
    }
  }
  return typeof node === 'string' && node.length > 0;
}

function makeEvent(overrides: Partial<EngineEvent> = {}): EngineEvent {
  return {
    id: 'e1',
    type: 'GOAL',
    actor: 'helper',
    at: 1727000000000,
    section: 1,
    clockMs: 11 * 60_000 + 30_000,
    teamId: 'team-a',
    payload: {},
    ...overrides,
  };
}

function makeEntry(overrides: Partial<EngineEvent> = {}): RejectedEntry {
  return { event: makeEvent(overrides), code: 'STALE_BASE', rejectedAt: 1727000001000 };
}

const TEAMS: MatchContext = { matchId: 'm1', teamAId: 'team-a', teamBId: 'team-b' };

describe('rejectionReasonKey', () => {
  it.each(REQUIRED_CODES)('hat fuer %s einen Schluessel in de und en', (code) => {
    const key = rejectionReasonKey(code);
    expect(hasKey(deCommon, key)).toBe(true);
    expect(hasKey(enCommon, key)).toBe(true);
  });

  it('unbekannter Code zeigt auf den Schluessel fuer unbekannten Grund', () => {
    expect(rejectionReasonKey('ETWAS_NEUES')).toBe('outbox.rejection.unknown');
    expect(hasKey(deCommon, 'outbox.rejection.unknown')).toBe(true);
    expect(hasKey(enCommon, 'outbox.rejection.unknown')).toBe(true);
  });
});

// Fixrunde 1 (Review I1): 9 Klartexte waren sachlich falsch oder irrefuehrend (verwechselten
// Code-Semantik, siehe Review-Tabelle). Diese Werte sind jetzt fest verankert, damit ein
// Ruecksprung auf die alten (falschen) Texte hier rot wird.
function valueAt(root: JsonValue, dottedKey: string): string | undefined {
  let node: unknown = root;
  for (const part of dottedKey.split('.')) {
    if (typeof node !== 'object' || node === null || Array.isArray(node)) {
      return undefined;
    }
    node = (node as JsonValue)[part];
  }
  return typeof node === 'string' ? node : undefined;
}

describe('rejectionReasonKey — korrigierte Klartexte (Review I1)', () => {
  it.each([
    ['INVALID_TRANSITION', 'Die Eingabe passt nicht zum aktuellen Spielablauf.'],
    ['FORBIDDEN_ACTOR', 'Das darf nur die Turnierleitung eingeben.'],
    ['UNKNOWN_TARGET', 'Die Eingabe, auf die sich das bezieht, wurde nicht gefunden.'],
    ['NO_WINNER', 'Das Strafstoßschießen hat noch keinen Sieger.'],
    ['DEPENDS_ON_REJECTED', 'Eine vorherige Eingabe wurde nicht übernommen, daher auch diese nicht.'],
    ['ID_CONFLICT', 'Es gibt schon eine andere Eingabe mit derselben Kennung. Bitte neu eingeben.'],
    ['NOT_CONTROLLER', 'Ein anderes Gerät steuert dieses Spiel gerade.'],
    ['MATCH_FULL', 'Für dieses Spiel sind keine weiteren Eingaben möglich. Bitte die Turnierleitung informieren.'],
    ['MATCH_GONE', 'Das Spiel wurde gelöscht.'],
  ])('DE-Text fuer %s entspricht der Review-Vorgabe', (code, expected) => {
    expect(valueAt(deCommon, rejectionReasonKey(code))).toBe(expected);
  });

  it.each([
    ['INVALID_TRANSITION', 'The entry does not match the current course of play.'],
    ['FORBIDDEN_ACTOR', 'Only tournament control may enter this.'],
    ['UNKNOWN_TARGET', 'The entry this refers to was not found.'],
    ['NO_WINNER', 'The penalty shootout does not have a winner yet.'],
    ['DEPENDS_ON_REJECTED', 'A previous related entry was not accepted, so this one was not either.'],
    ['ID_CONFLICT', 'There is already a different entry with the same id. Please enter it again.'],
    ['NOT_CONTROLLER', 'Another device is currently controlling this game.'],
    ['MATCH_FULL', 'No further entries are possible for this game. Please inform tournament control.'],
    ['MATCH_GONE', 'The game was deleted.'],
  ])('EN-Text fuer %s entspricht der Review-Vorgabe (sinngemaess)', (code, expected) => {
    expect(valueAt(enCommon, rejectionReasonKey(code))).toBe(expected);
  });
});

// Fixrunde 1 (Review m6): "Weiter" (resume) ist als Substantiv in der Ereigniszeile holprig
// ("Weiter, 12. Minute") und "Pause" ist mit der Halbzeitpause verwechselbar. En "Understood all"
// klingt seltsam fuer einen Sammel-Knopf -- "Dismiss all" wie an anderen Stellen im Repo.
describe('Wortwahl-Korrekturen (Review m6)', () => {
  it('DE eventType.resume/pause sind fuer die Ereigniszeile eindeutig', () => {
    expect(valueAt(deCommon, 'outbox.eventType.resume')).toBe('Spiel fortgesetzt');
    expect(valueAt(deCommon, 'outbox.eventType.pause')).toBe('Unterbrechung');
  });

  it('EN dismissAll ist ein Sammel-Knopf-Text, kein Bestaetigungssatz', () => {
    expect(valueAt(enCommon, 'outbox.rejected.dismissAll')).toBe('Dismiss all');
  });
});

describe('describeEvent', () => {
  it('liefert Typ, Team A und Minute fuer Tor frueh im Spiel', () => {
    const desc = describeEvent(makeEntry(), TEAMS);
    expect(desc.key).toBe('outbox.eventLine.teamAndMinute');
    expect(desc.values).toEqual({ typeKey: 'outbox.eventType.goal', team: 'A', minute: 12 });
  });

  it('ordnet teamBId als Team B zu', () => {
    const desc = describeEvent(makeEntry({ teamId: 'team-b' }), TEAMS);
    expect(desc.values.team).toBe('B');
  });

  it('ohne Team-Zuordnung faellt Team aus der Zeile heraus', () => {
    const desc = describeEvent(makeEntry({ teamId: null }), TEAMS);
    expect(desc.key).toBe('outbox.eventLine.minute');
    expect(desc.values.team).toBeNull();
  });

  it('ohne clockMs faellt die Minute aus der Zeile heraus', () => {
    const desc = describeEvent(makeEntry({ clockMs: null }), TEAMS);
    expect(desc.key).toBe('outbox.eventLine.team');
    expect(desc.values.minute).toBeNull();
  });

  it('ohne Teams und ohne clockMs bleibt nur der Typ', () => {
    const desc = describeEvent(makeEntry({ teamId: 'team-a', clockMs: null }));
    expect(desc.key).toBe('outbox.eventLine.plain');
    expect(desc.values).toEqual({ typeKey: 'outbox.eventType.goal', team: null, minute: null });
  });

  it('Minute wird aus clockMs als Spielminute gebildet', () => {
    expect(describeEvent(makeEntry({ clockMs: 45_000 }), TEAMS).values.minute).toBe(1);
    expect(describeEvent(makeEntry({ clockMs: 0 }), TEAMS).values.minute).toBe(1);
    expect(describeEvent(makeEntry({ clockMs: 25 * 60_000 + 30_000 }), TEAMS).values.minute).toBe(26);
  });

  it('jeder Ereignistyp hat einen Typ-Schluessel in de und en', () => {
    for (const type of EventTypeSchema.options) {
      const desc = describeEvent(makeEntry({ type, teamId: null, clockMs: null }), TEAMS);
      expect(hasKey(deCommon, desc.values.typeKey), `de ${type}`).toBe(true);
      expect(hasKey(enCommon, desc.values.typeKey), `en ${type}`).toBe(true);
    }
  });

  it('unbekannter Typ zeigt auf den Schluessel fuer unbekannten Typ', () => {
    const desc = describeEvent(makeEntry({ type: 'UNBEKANNT' as EngineEvent['type'], teamId: null, clockMs: null }));
    expect(desc.values.typeKey).toBe('outbox.eventType.unknown');
    expect(hasKey(deCommon, desc.values.typeKey)).toBe(true);
    expect(hasKey(enCommon, desc.values.typeKey)).toBe(true);
  });

  it('die Zeilenschluessel selbst existieren in de und en', () => {
    for (const key of [
      'outbox.eventLine.teamAndMinute',
      'outbox.eventLine.team',
      'outbox.eventLine.minute',
      'outbox.eventLine.plain',
    ]) {
      expect(hasKey(deCommon, key), `de ${key}`).toBe(true);
      expect(hasKey(enCommon, key), `en ${key}`).toBe(true);
    }
  });
});
