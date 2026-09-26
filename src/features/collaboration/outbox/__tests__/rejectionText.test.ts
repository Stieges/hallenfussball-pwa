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
