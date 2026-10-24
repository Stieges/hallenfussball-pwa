/**
 * B-50 Klärungsliste – Gerät des Absenders, aus dem Gherkin:
 * - @FU-038: „Toms Gerät zeigt „wird geprüft““ (Grund CONTROL_LOST).
 * - @HE-056: „Toms Gerät zeigt „Du hast keinen Zugriff mehr – 1 Eintrag an die Turnierleitung übergeben““.
 * - @FU-017: „Toms Gerät zeigt „an die Turnierleitung übergeben““ (2 Einträge, Recht entzogen).
 * Weg: Server-Antwort `review` mit Grund → Ausgang merkt sich den Grund → Status zählt → Anzeige (echte DE-Texte).
 */
import { describe, expect, it, vi } from 'vitest';
vi.unmock('i18next');
vi.unmock('react-i18next');
import { render, screen } from '@testing-library/react';
import { initRealDeI18n } from '../../../test/realDeI18n';
import { buildResolution } from '../../../core/match/client/outboxResolution';
import { applyResolution, closeHandedOverEntries, type MatchCopy } from '../../../core/match/client/matchCopy';
import { countCopyLists } from '../../../core/match/client/outboxStatus';
import { emptyOutboxStatus } from '../../../core/match/client/outboxTypes';
import type { EngineEvent } from '../../../core/match';
import { OutboxNotice } from '../../collaboration/outbox/OutboxNotice';
import { uebergabeFor } from '../zugriffEntzogen';

await initRealDeI18n();

const ctx = { matchId: 'spiel-9', teamAId: 'nord', teamBId: 'sued' };
const tor = (id: string): EngineEvent => ({ id, type: 'GOAL', actor: 'helper', at: 1, section: 1, clockMs: 1000, teamId: 'nord', targetId: null, payload: {} });

function copyAfter(code: string, ids: string[], change?: string, existing?: MatchCopy): MatchCopy {
  const events = ids.map(tor);
  const copy: MatchCopy = existing ?? {
    formatVersion: 2, accountId: 'tom', matchId: 'spiel-9', tournamentId: 'live-cup', ctx,
    confirmed: [], watermarkSeq: 0, acked: [], pending: [], rejected: [], review: [], updatedAt: 0,
  };
  copy.pending = copy.pending.concat(events);
  const detail = change === undefined ? undefined : { change };
  const { resolution } = buildResolution(events, events.map((event) => ({ id: event.id, status: 'review' as const, code, ...(detail ? { detail } : {}) })), 5);
  applyResolution(copy, resolution);
  return copy;
}
const statusOf = (copies: MatchCopy[]) => ({ ...emptyOutboxStatus(), ...countCopyLists(copies) });

describe('@FU-038 Toms Gerät zeigt „wird geprüft“', () => {
  it('Grund CONTROL_LOST: Hinweis „wird geprüft (1)“, keine Übergabe-Sperre', () => {
    const status = statusOf([copyAfter('CONTROL_LOST', ['t1'])]);
    render(<OutboxNotice status={status} matchId="spiel-9" onReload={vi.fn()} />);
    expect(screen.getByTestId('outbox-notice')).toHaveTextContent('wird geprüft (1)');
    expect(uebergabeFor(status, 'spiel-9', false)).toBeNull();
  });
});

describe('@HE-056 / @FU-017 Recht entzogen, während Toms Gerät kein Netz hatte', () => {
  it('@HE-056 entfernt: 1 Eintrag → Sperre „keinen Zugriff“ mit 1 übergebenem Eintrag', () => {
    const status = statusOf([copyAfter('RIGHTS_REVOKED', ['t1'], 'revoked')]);
    expect(uebergabeFor(status, 'spiel-9', false)).toEqual({ art: 'sperre', count: 1 });
  });

  it('@FU-017 zum Zuschauer gemacht: 2 übergeben, Lesesicht bleibt (zusehen statt Sperre)', () => {
    const status = statusOf([copyAfter('RIGHTS_REVOKED', ['t1', 't2'], 'watch_only')]);
    expect(uebergabeFor(status, 'spiel-9', false)).toEqual({ art: 'zusehen', count: 2 });
  });

  it('Gegenbeispiel @FU-017 aus dem Turnier entfernt: keine Lesesicht, Sperre', () => {
    const status = statusOf([copyAfter('RIGHTS_REVOKED', ['t1', 't2'], 'removed')]);
    expect(uebergabeFor(status, 'spiel-9', false)).toEqual({ art: 'sperre', count: 2 });
  });

  it('Gegenbeispiel: nur Spiele mit übergebenen Einträgen sind betroffen – Spiel 10 bleibt frei', () => {
    const status = statusOf([copyAfter('RIGHTS_REVOKED', ['t1'], 'revoked')]);
    expect(uebergabeFor(status, 'spiel-10', false)).toBeNull();
  });
});

describe('B-50 Review M2: Recht zurück', () => {
  it('Tom darf wieder schreiben → abschließen; danach sind die übergebenen Einträge weg, kein Hinweis mehr', () => {
    const copy = copyAfter('RIGHTS_REVOKED', ['t1'], 'revoked');
    expect(uebergabeFor(statusOf([copy]), 'spiel-9', true)).toEqual({ art: 'abschliessen', count: 1 });
    closeHandedOverEntries(copy);
    expect(copy.review).toEqual([]);
    expect(uebergabeFor(statusOf([copy]), 'spiel-9', false)).toBeNull();
  });

  it('Gegenbeispiel: Abschließen lässt andere Klärungseinträge (Steuer verloren) „wird geprüft“', () => {
    const copy = copyAfter('RIGHTS_REVOKED', ['t1'], 'revoked');
    copyAfter('CONTROL_LOST', ['t2'], undefined, copy);
    closeHandedOverEntries(copy);
    expect(copy.review.map((event) => event.id)).toEqual(['t2']);
    expect(statusOf([copy]).reviewByMatch['spiel-9']).toBe(1);
  });
});
