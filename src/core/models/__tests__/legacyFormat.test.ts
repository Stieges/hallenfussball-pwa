/**
 * A-05: Altformat-Erkennung (@FU-007). Altformat = ein Spiel ohne gueltigen `slotA`/`slotB`.
 * NICHT der Schluessel `teamA`: den tragen bis B-35 alle gueltigen Spiele als Uebergangsfeld.
 */
import { describe, it, expect } from 'vitest';
import { isLegacyTournamentShape } from '../legacyFormat';

const TEAM_A = '11111111-1111-4111-8111-111111111111';
const TEAM_B = '22222222-2222-4222-8222-222222222222';

const validMatch = {
  id: 'm1',
  teamA: TEAM_A,
  teamB: TEAM_B,
  slotA: { kind: 'team', teamId: TEAM_A },
  slotB: { kind: 'team', teamId: TEAM_B },
};

describe('isLegacyTournamentShape (@FU-007)', () => {
  it.each([
    ['@FU-007 Altformat: Spiel nur mit teamA/teamB', { id: 't', matches: [{ id: 'm1', teamA: 'FC Nord', teamB: 'FC Sued' }] }],
    ['@FU-007 Altformat: Spiel ohne Schluessel teamA und ohne Slots', { id: 't', matches: [{ id: 'm1' }] }],
    ['@FU-007 Altformat: nur slotA fehlt', { id: 't', matches: [{ ...validMatch, slotA: undefined }] }],
    ['@FU-007 Altformat: nur slotB fehlt', { id: 't', matches: [{ ...validMatch, slotB: undefined }] }],
    ['@FU-007 Altformat: slotA ist null', { id: 't', matches: [{ ...validMatch, slotA: null }] }],
    ['@FU-007 Altformat: ein gueltiges, ein altes Spiel', { id: 't', matches: [validMatch, { id: 'm2', teamA: 'x', teamB: 'y' }] }],
  ])('%s -> true', (_name, raw) => {
    expect(isLegacyTournamentShape(raw)).toBe(true);
  });

  it.each([
    ['Gegenbeispiel: gueltiges Spiel MIT Uebergangsfeld teamA/teamB', { id: 't', matches: [validMatch] }],
    ['Gegenbeispiel: gueltiges Spiel ohne Uebergangsfelder', { id: 't', matches: [{ id: 'm1', slotA: validMatch.slotA, slotB: validMatch.slotB }] }],
    ['Gegenbeispiel: offene Seite mit Herkunft', { id: 't', matches: [{ id: 'm1', slotA: { kind: 'pending', source: { kind: 'groupRank', group: 'A', rank: 1 } }, slotB: validMatch.slotB }] }],
    ['Entwurf ohne Spiele (leere Liste)', { id: 't', matches: [] }],
    ['Entwurf ohne Spiele-Schluessel', { id: 't' }],
    ['matches ist keine Liste', { id: 't', matches: 'kaputt' }],
    ['kein Objekt (null)', null],
    ['kein Objekt (String)', 'tournament'],
  ])('%s -> false', (_name, raw) => {
    expect(isLegacyTournamentShape(raw)).toBe(false);
  });
});
