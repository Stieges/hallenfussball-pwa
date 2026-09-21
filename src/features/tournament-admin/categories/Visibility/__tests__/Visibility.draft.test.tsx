/**
 * Task 3 — Das bloße Öffnen der Sichtbarkeits-Einstellungen darf die Sichtbarkeit nicht ändern.
 *
 * Vorher (Visibility/index.tsx ~223-280): ein Effekt erzeugte beim Mounten einen Share-Code für
 * jedes Turnier mit `(tournament.isPublic ?? true) && !tournament.shareCode` — ein fehlendes
 * Feld galt also als "öffentlich". Ein unfertiger Entwurf war damit allein durchs Hinschauen
 * geteilt.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import type { Tournament } from '../../../../../types/tournament';
import { ToastProvider } from '../../../../../components/ui/Toast';
import { RepositoryError } from '../../../../../core/errors';

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
    // publishedAt gesetzt: so kommt das Objekt real aus dem Repository (Backfill), sobald
    // status='published' ist. Ohne publishedAt in der Fixture würde Fix 4 (Gate auf
    // publishedAt statt status) dieses Turnier faelschlich als Entwurf behandeln.
    renderCategory(createTournament({
      status: 'published',
      isPublic: true,
      publishedAt: '2026-02-01T10:00:00.000Z',
    }));

    await waitFor(() => {
      expect(screen.queryByTestId('visibility-draft-hint')).not.toBeInTheDocument();
    });
    expect(makeTournamentPublic).not.toHaveBeenCalled();
  });

  // =========================================================================
  // Fix 4 (Review 2026-09-18): Gate auf publishedAt statt status. Ein Turnier, das
  // wegen eines Reloads mitten im Bearbeiten-Wizard bei status='draft' hängengeblieben ist
  // (SettingsTab.tsx setzt beim Öffnen des Wizards zurück), aber bereits ein publishedAt
  // trägt, ist nachweislich online — der Organisator muss den Link/QR-Code weiterhin sehen
  // und nachdrucken können.
  // =========================================================================
  it('ein "stuck-at-draft" Turnier (status draft, aber publishedAt gesetzt) zeigt die Sharing-UI, nicht den Hinweis', async () => {
    renderCategory(createTournament({
      status: 'draft',
      isPublic: true,
      shareCode: 'ABC123',
      publishedAt: '2026-02-01T10:00:00.000Z',
    }));

    await waitFor(() => {
      expect(screen.queryByTestId('visibility-draft-hint')).not.toBeInTheDocument();
    });
    expect(makeTournamentPublic).not.toHaveBeenCalled();
  });

  it('ein echter Entwurf (kein publishedAt) zeigt weiterhin den Hinweis, unabhängig vom status-Wert', async () => {
    renderCategory(createTournament({ status: 'draft' }));

    await waitFor(() => {
      expect(screen.getByTestId('visibility-draft-hint')).toBeInTheDocument();
    });
  });
});

// =========================================================================
// Fix 5 (Review 2026-09-18): Die Freigabe-Ablehnung des RPC (make_tournament_public) muss als
// deutscher i18n-Text erscheinen, nicht als rohe englische Postgres-Meldung. Jeder andere
// Fehler zeigt weiterhin den rohen Text (Fallback bleibt unverändert).
// =========================================================================
describe('VisibilityCategory — Freigabe-Ablehnung zeigt deutschen Text', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('zeigt den i18n-Text für "nicht freigegeben" statt der rohen RPC-Meldung', async () => {
    makeTournamentPublic.mockRejectedValueOnce(
      new RepositoryError(
        'makePublic',
        'Tournament has not been released yet and cannot be made public',
        { code: 'HF001' }
      )
    );

    renderCategory(createTournament({
      status: 'published',
      isPublic: false,
      publishedAt: '2026-02-01T10:00:00.000Z',
    }));

    // "Sichtbarkeit"-Sektion ist standardmäßig eingeklappt (kein defaultOpen), erst
    // aufklappen, dann die "Mit Link teilbar"-Option anklicken, die handleMakePublic auslöst.
    fireEvent.click(screen.getByText('admin:visibility.tournamentVisibility'));
    fireEvent.click(screen.getByText('admin:visibility.shareable'));

    // Der Text erscheint doppelt (Inline-Fehlermeldung + Toast) — getAllByText statt getByText.
    await waitFor(() => {
      expect(screen.getAllByText('admin:visibility.errorNotReleased').length).toBeGreaterThan(0);
    });
    expect(screen.queryByText(/has not been released/)).not.toBeInTheDocument();
  });

  it('zeigt bei einem anderen Fehler weiterhin die rohe Meldung (Fallback unverändert)', async () => {
    makeTournamentPublic.mockRejectedValueOnce(new Error('Failed to fetch'));

    renderCategory(createTournament({
      status: 'published',
      isPublic: false,
      publishedAt: '2026-02-01T10:00:00.000Z',
    }));

    fireEvent.click(screen.getByText('admin:visibility.tournamentVisibility'));
    fireEvent.click(screen.getByText('admin:visibility.shareable'));

    await waitFor(() => {
      expect(screen.getAllByText('Failed to fetch').length).toBeGreaterThan(0);
    });
    expect(screen.queryByText('admin:visibility.errorNotReleased')).not.toBeInTheDocument();
  });
});
