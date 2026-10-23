/**
 * B-04 Paket d – @W2A-030: Nur die Turnierleitung ändert Regeln (Client-Seite).
 *
 * Gegeben ein Helfer ist im Turnier angemeldet
 * Wenn er eine Regel ändern will
 * Dann bietet die App das nicht an
 *
 * UI-Ort: src/features/tournament-management/SettingsTab.tsx („Erweiterte
 * Bearbeitung" / „Im Wizard bearbeiten", Bedienelemente
 * `wizard-edit-change-game-mode` u. a.) — der Weg in die Regel-Bearbeitung.
 * Vorhandene Rechte-Prüfung: useMyTournamentRole +
 * canManageTournament (src/features/auth/utils/permissions.ts,
 * Recht `tournamentSettings`: owner = Turnierleitung immer, co-admin = Co-Admin
 * über die zentrale Rechtetabelle; Helfer-Rollen collaborator/trainer/viewer
 * haben das Recht nicht). Server-Rechte gehören zu Spur A (A-27) — nur Client-Seite.
 *
 * Test:    als Helfer gerendert → kein Regel-Bedienelement.
 * Gegenbeispiel: als Turnierleitung und als Co-Admin vorhanden.
 * Mutation: die Rechte-Prüfung entfernen → rot.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import type { Tournament } from '../../../types/tournament';

const { rolle } = vi.hoisted(() => ({ rolle: { value: 'owner' } }));

vi.mock('../../auth/hooks/useAuth', () => ({
  useAuth: () => ({ isAuthenticated: true }),
}));

vi.mock('../../auth/hooks/useTournamentMembers', () => ({
  useTournamentMembers: () => ({ myMembership: { role: rolle.value }, isLoading: false }),
}));

import { SettingsTab } from '../SettingsTab';

function turnier(): Tournament {
  return {
    id: 't1', title: 'Wintercup', status: 'published',
    teams: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }],
    matches: [{ id: 'm1', matchStatus: 'scheduled' }, { id: 'm2', matchStatus: 'scheduled' }],
    startDate: '2026-03-01', startTime: '10:00',
    ageClass: 'U11',
    location: { name: 'Halle Süd', city: 'Musterstadt' },
    placementLogic: [],
  } as unknown as Tournament;
}

const REGEL_BEDIENELEMENTE = [
  'wizard-edit-change-game-mode',
  'wizard-edit-edit-teams',
  'wizard-edit-groups-and-fields',
] as const;

function rendereSettings(rolleDerPerson: string) {
  rolle.value = rolleDerPerson;
  render(
    <SettingsTab
      tournament={turnier()}
      onTournamentUpdate={vi.fn()}
      onEditInWizard={vi.fn()}
    />
  );
}

beforeEach(() => vi.clearAllMocks());

describe('B-04d @W2A-030 – Nur die Turnierleitung ändert Regeln', () => {
  it('Pflichttest: als Helfer bietet die App kein Regel-Bedienelement an', () => {
    for (const helferRolle of ['collaborator', 'trainer', 'viewer']) {
      rendereSettings(helferRolle);
      for (const testid of REGEL_BEDIENELEMENTE) {
        expect(screen.queryByTestId(testid), `Rolle ${helferRolle}, Element ${testid}`).toBeNull();
      }
      cleanup();
    }
  });

  it('Gegenbeispiel: als Turnierleitung ist das Regel-Bedienelement vorhanden', () => {
    rendereSettings('owner');
    expect(screen.getByTestId('wizard-edit-change-game-mode')).toBeInTheDocument();
  });

  it('Gegenbeispiel: als Co-Admin ist das Regel-Bedienelement vorhanden', () => {
    rendereSettings('co-admin');
    expect(screen.getByTestId('wizard-edit-change-game-mode')).toBeInTheDocument();
  });
});
