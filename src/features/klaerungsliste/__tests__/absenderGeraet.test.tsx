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
import { applyResolution, type MatchCopy } from '../../../core/match/client/matchCopy';
import { countCopyLists } from '../../../core/match/client/outboxStatus';
import { emptyOutboxStatus } from '../../../core/match/client/outboxTypes';
import type { EngineEvent } from '../../../core/match';
import { OutboxNotice } from '../../collaboration/outbox/OutboxNotice';
import { zugriffEntzogenFor } from '../zugriffEntzogen';

await initRealDeI18n();

const ctx = { matchId: 'spiel-9', teamAId: 'nord', teamBId: 'sued' };
const tor = (id: string): EngineEvent => ({ id, type: 'GOAL', actor: 'helper', at: 1, section: 1, clockMs: 1000, teamId: 'nord', targetId: null, payload: {} });

function copyAfter(code: string, ids: string[]): MatchCopy {
  const events = ids.map(tor);
  const copy: MatchCopy = {
    formatVersion: 2, accountId: 'tom', matchId: 'spiel-9', tournamentId: 'live-cup', ctx,
    confirmed: [], watermarkSeq: 0, acked: [], pending: events, rejected: [], review: [], updatedAt: 0,
  };
  const { resolution } = buildResolution(events, events.map((event) => ({ id: event.id, status: 'review' as const, code })), 5);
  applyResolution(copy, resolution);
  return copy;
}

describe('@FU-038 Toms Gerät zeigt „wird geprüft“', () => {
  it('Grund CONTROL_LOST: Hinweis „wird geprüft (1)“, kein „keinen Zugriff“', () => {
    const status = { ...emptyOutboxStatus(), ...countCopyLists([copyAfter('CONTROL_LOST', ['t1'])]) };
    render(<OutboxNotice status={status} matchId="spiel-9" onReload={vi.fn()} />);
    expect(screen.getByTestId('outbox-notice')).toHaveTextContent('wird geprüft (1)');
    expect(zugriffEntzogenFor(status, 'live-cup')).toBeNull();
  });
});

describe('@HE-056 / @FU-017 Recht entzogen, während Toms Gerät kein Netz hatte', () => {
  it('@HE-056: 1 Eintrag → „Du hast keinen Zugriff mehr – 1 Eintrag an die Turnierleitung übergeben“', () => {
    const status = { ...emptyOutboxStatus(), ...countCopyLists([copyAfter('RIGHTS_REVOKED', ['t1'])]) };
    expect(zugriffEntzogenFor(status, 'live-cup')).toEqual({ uebergebeneEintraege: 1 });
  });

  it('@FU-017: 2 wartende Einträge → 2 übergeben; Gegenbeispiel anderes Turnier → kein Hinweis', () => {
    const status = { ...emptyOutboxStatus(), ...countCopyLists([copyAfter('RIGHTS_REVOKED', ['t1', 't2'])]) };
    expect(zugriffEntzogenFor(status, 'live-cup')).toEqual({ uebergebeneEintraege: 2 });
    expect(zugriffEntzogenFor(status, 'anderes-turnier')).toBeNull();
  });
});
