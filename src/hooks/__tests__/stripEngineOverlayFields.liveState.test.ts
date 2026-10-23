/**
 * C-OVERLAY-LIVESTATE-BLEIBT (reines Aufräumen, Bezug @OB-066): Das Leeren des Feinstatus gilt nur der Anzeige.
 * Beim Speichern stellt `stripEngineOverlayFields` den Rohwert von `liveState` wieder her, damit die Überlagerung
 * nie in die Rohdaten gelangt.
 * Gegenbeispiel: ein Spiel ohne Überlagerung bleibt unverändert.
 */
import { describe, it, expect } from 'vitest';
import { stripEngineOverlayFields } from '../useTournamentManager';
import type { Tournament } from '../../types/tournament';

const LIVE_STATE = { engine: true, status: 'section_break', phase: 'regular', section: 1, sections: 2 };

function tournamentWith(matches: Array<Record<string, unknown>>): Tournament {
  return { id: 't1', matches } as unknown as Tournament;
}

describe('C-OVERLAY-LIVESTATE-BLEIBT: Speichern stellt den Rohwert von liveState her (Bezug @OB-066)', () => {
  it('überlagertes Spiel (liveState geleert): gespeichert wird der Rohwert', () => {
    const raw = tournamentWith([{ id: 'm1', matchStatus: 'running', liveState: LIVE_STATE }]);
    const overlaid = tournamentWith([{ id: 'm1', matchStatus: 'finished', liveState: undefined }]);

    const saved = stripEngineOverlayFields(overlaid, raw, new Set(['m1']));

    expect(saved.matches[0]).toMatchObject({ matchStatus: 'running', liveState: LIVE_STATE });
  });

  it('Gegenbeispiel: nicht überlagertes Spiel bleibt unverändert', () => {
    const raw = tournamentWith([{ id: 'm1', liveState: LIVE_STATE }]);
    const updated = tournamentWith([{ id: 'm1', liveState: undefined }]);

    expect(stripEngineOverlayFields(updated, raw, new Set())).toBe(updated);
  });
});
