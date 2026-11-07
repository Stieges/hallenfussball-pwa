/**
 * @LZ-001 Die Karte auf der Startseite trägt dasselbe Wort wie der Zustand, auch im Archiv: Bereit statt „Bevorstehend“,
 * Abgeschlossen bzw. Abgebrochen statt „Archiviert“; „Bereit“ steht nicht auf der Karte (@OB-079). @OB-078 Am Handy trägt der Titel die
 * volle Breite (kein Platzhalter für das Schild, Innenabstand `spacing.md`).
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { cssVars } from '../../design-tokens';
import type { Tournament } from '../../types/tournament';

const hoisted = vi.hoisted(() => ({ mobile: true }));
vi.mock('../../hooks/useIsMobile', () => ({ useIsMobile: () => hoisted.mobile }));

import { TournamentCard } from '../TournamentCard';

function turnier(extra: Partial<Tournament>): Tournament {
  return {
    id: 't1', title: 'F2-Junioren Hallenturnier', status: 'published', teams: [], matches: [{ id: 'm1', matchStatus: 'scheduled' }],
    startDate: '2026-11-28', startTime: '08:30', location: { name: 'Halle' }, placementLogic: [], groupSystem: 'roundRobin',
    ...extra,
  } as unknown as Tournament;
}

describe('@LZ-001 Wort auf der Karte (nur wenn es von „Bereit“ abweicht, @OB-079)', () => {
  it('Bereit: kommendes Turnier trägt kein Zustandswort (weder „status.upcoming“ noch eine Marke)', () => {
    render(<TournamentCard tournament={turnier({})} categoryLabel="upcoming" />);
    expect(screen.queryByText('dashboard:status.upcoming')).toBeNull();
    expect(screen.queryByTestId('card-state')).toBeNull();
  });

  it('Archiv: abgeschlossen trägt „Abgeschlossen“ (status.finished), nie „Archiviert“', () => {
    render(<TournamentCard tournament={turnier({ lifecycleStatus: 'finished' })} categoryLabel="archived" />);
    expect(screen.getByTestId('card-state')).toHaveTextContent('dashboard:status.finished');
    expect(screen.queryByText('dashboard:status.archived')).toBeNull();
  });

  it('Archiv: abgebrochen trägt „Abgebrochen“ (status.cancelled)', () => {
    render(<TournamentCard tournament={turnier({ lifecycleStatus: 'cancelled' })} categoryLabel="archived" />);
    expect(screen.getByTestId('card-state')).toHaveTextContent('dashboard:status.cancelled');
  });
});

describe('@OB-078 Karte am Handy', () => {
  it('der Titel hat keinen Platzhalter für das Schild (kein rechter Innenabstand von 120 px), die Karte am Handy knappen Abstand (sm oben, md seitlich)', () => {
    render(<TournamentCard tournament={turnier({})} categoryLabel="upcoming" />);
    expect(screen.getByRole('heading', { name: 'F2-Junioren Hallenturnier' }).style.paddingRight).toBe('');
    expect(screen.getByTestId('tournament-card-t1').style.padding).toBe(`${cssVars.spacing.sm} ${cssVars.spacing.md}`);
  });

  it('Gegenbeispiel: ab Tablet gilt der weitere Innenabstand (md oben, lg seitlich)', () => {
    hoisted.mobile = false;
    render(<TournamentCard tournament={turnier({})} categoryLabel="upcoming" />);
    expect(screen.getByTestId('tournament-card-t1').style.padding).toBe(`${cssVars.spacing.md} ${cssVars.spacing.lg}`);
    hoisted.mobile = true;
  });
});
