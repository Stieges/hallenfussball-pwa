import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  PublicLoadingView,
  PublicNotFoundView,
  PublicErrorView,
} from '../components/PublicStatusViews';
import { PublicStandingsTab } from '../components/PublicStandingsTab';
import { buildLiveViewTournament, SHARE_CODE } from '../../../screens/__tests__/liveViewFixture';

describe('PublicStatusViews (B-13d1)', () => {
  it('Laden zeigt den Code des Turniers', () => {
    render(<PublicLoadingView shareCode={SHARE_CODE} />);
    expect(screen.getByText('Turnier wird geladen...')).toBeInTheDocument();
    expect(screen.getByText(`Code: ${SHARE_CODE}`)).toBeInTheDocument();
  });

  it('Nicht gefunden nennt den Code und bietet die Startseite an', () => {
    render(<PublicNotFoundView shareCode={SHARE_CODE} />);
    expect(screen.getByText('Turnier nicht gefunden')).toBeInTheDocument();
    expect(screen.getByText(SHARE_CODE)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Zur Startseite' })).toBeInTheDocument();
  });

  it('Fehler zeigt die Fehlermeldung, sonst den Standardtext', () => {
    const { unmount } = render(<PublicErrorView errorMessage="Netz weg" />);
    expect(screen.getByText('Netz weg')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Erneut versuchen' })).toBeInTheDocument();
    unmount();

    render(<PublicErrorView errorMessage={null} />);
    expect(screen.getByText('Ein unbekannter Fehler ist aufgetreten.')).toBeInTheDocument();
  });
});

describe('PublicStandingsTab (B-13d1)', () => {
  it('blendet Tabellen aus, wenn der Bambini-Modus sie verbirgt', () => {
    const tournament = { ...buildLiveViewTournament(), hideRankingsForPublic: true };
    render(<PublicStandingsTab tournament={tournament} standings={[]} />);
    expect(screen.getByText(/Tabellen ausgeblendet/)).toBeInTheDocument();
    expect(screen.getByText('(Bambini-Modus aktiviert)')).toBeInTheDocument();
  });

  it('zeigt Gruppentabellen, wenn Tabellen sichtbar sind', () => {
    const tournament = { ...buildLiveViewTournament(), hideRankingsForPublic: false };
    const { container } = render(<PublicStandingsTab tournament={tournament} standings={[]} />);
    expect(screen.queryByText(/Tabellen ausgeblendet/)).toBeNull();
    expect(container.querySelector('.standings-table')).not.toBeNull();
  });
});
