/**
 * Task 3 — Das bloße Öffnen der Sichtbarkeits-Einstellungen darf die Sichtbarkeit nicht ändern.
 *
 * Vorher (Visibility/index.tsx ~223-280): ein Effekt erzeugte beim Mounten einen Share-Code für
 * jedes Turnier mit `(tournament.isPublic ?? true) && !tournament.shareCode` — ein fehlendes
 * Feld galt also als "öffentlich". Ein unfertiger Entwurf war damit allein durchs Hinschauen
 * geteilt.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import type { Tournament } from '../../../../../types/tournament';
import { ToastProvider } from '../../../../../components/ui/Toast';

const makeTournamentPublic = vi.fn(() =>
  Promise.resolve({ shareCode: 'ABC123', createdAt: '2026-02-01T10:00:00.000Z' })
);
const makeTournamentPrivate = vi.fn(() => Promise.resolve());
const regenerateShareCode = vi.fn(() =>
  Promise.resolve({ shareCode: 'DEF456', createdAt: '2026-02-01T10:00:00.000Z' })
);

vi.mock('../../../../../hooks/useRepository', () => ({
  useRepository: () => ({ makeTournamentPublic, makeTournamentPrivate, regenerateShareCode }),
}));

vi.mock('../../../../../lib/supabase', () => ({
  isSupabaseConfigured: true,
}));

import { VisibilityCategory } from '../index';

function createTournament(overrides: Partial<Tournament> = {}): Tournament {
  return {
    id: 't1',
    title: 'Test-Turnier',
    status: 'draft',
    teams: [],
    matches: [],
    ...overrides,
  } as unknown as Tournament;
}

function renderCategory(tournament: Tournament) {
  return render(
    <ToastProvider>
      <VisibilityCategory
        tournamentId={tournament.id}
        tournament={tournament}
        onTournamentUpdate={vi.fn()}
      />
    </ToastProvider>
  );
}

describe('VisibilityCategory — Entwurf ist nicht teilbar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('ein Entwurf löst NULL makeTournamentPublic-Aufrufe aus und zeigt den Hinweis', async () => {
    renderCategory(createTournament({ status: 'draft' }));

    await waitFor(() => {
      expect(screen.getByTestId('visibility-draft-hint')).toBeInTheDocument();
    });
    expect(makeTournamentPublic).not.toHaveBeenCalled();
  });

  it('auch ein veröffentlichtes Turnier ohne Share-Code wird beim Öffnen nicht automatisch geteilt', async () => {
    renderCategory(createTournament({ status: 'published', isPublic: true }));

    await waitFor(() => {
      expect(screen.queryByTestId('visibility-draft-hint')).not.toBeInTheDocument();
    });
    expect(makeTournamentPublic).not.toHaveBeenCalled();
  });
});
