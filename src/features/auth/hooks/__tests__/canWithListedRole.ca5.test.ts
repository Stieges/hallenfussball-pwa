/**
 * CA-5 (@HE-088 „Aber „Löschen“ bietet die App ihr bei diesem Turnier nicht an“; Review CA-3–5 Auflage 4):
 * Rechte-Frage für Listenobjekte der Startseite. Ohne Rolle = eigenes Turnier; unbekannte Rolle wie `useCan` L7.
 */
import { describe, it, expect } from 'vitest';
import type { TournamentRole } from '../../types/auth.types';
import { canWithListedRole } from '../useCan';

describe('CA-5 canWithListedRole', () => {
  it('@HE-088 Co-Admin: kein deleteTournament, aber manageScreens (Rechte aus rolePermissions.json)', () => {
    expect(canWithListedRole('co-admin', 'deleteTournament')).toBe(false);
    expect(canWithListedRole('co-admin', 'manageScreens')).toBe(true);
  });

  it('Eigentümer und Turnier ohne Rolle (Gast, lokal angelegt): alle Rechte', () => {
    expect(canWithListedRole('owner', 'deleteTournament')).toBe(true);
    expect(canWithListedRole(undefined, 'deleteTournament')).toBe(true);
  });

  it('Gegenbeispiel unbekannte Rolle: wie L7 nur der Spielbetrieb, keine Verwaltung', () => {
    const kaputt = 'admin' as unknown as TournamentRole;
    expect(canWithListedRole(kaputt, 'writeMatchData')).toBe(true);
    expect(canWithListedRole(kaputt, 'deleteTournament')).toBe(false);
    expect(canWithListedRole(kaputt, 'manageScreens')).toBe(false);
  });
});
