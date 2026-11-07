/**
 * @OB-079 Das Zustandswort steht nur, wenn es vom Normalfall „Bereit“ abweicht („Läuft“, „Abgeschlossen“, „Abgebrochen“), mit Symbol und Wort;
 * das Schild der eigenen Rolle steht in der Zeile des Orts und macht die Karte nicht höher. @OB-081 „Abgeschlossen“ mit Symbol und Wort.
 * VISUAL-DESIGN § 7: Farbe nie allein, Läuft ist kein Fehler-Rot. (Die Höhe messen die Playwright-Prüfungen in startseite-turniertag.spec.ts.)
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { cssVars } from '../../design-tokens';
import type { Tournament } from '../../types/tournament';

vi.mock('../../hooks/useIsMobile', () => ({ useIsMobile: () => true }));

import { TournamentCard } from '../TournamentCard';

const turnier = (extra: Partial<Tournament> = {}): Tournament => ({
  id: 'd', title: 'Nikolausturnier', status: 'published', teams: [], matches: [{ id: 'm', matchStatus: 'scheduled' }],
  startDate: '2026-11-28', startTime: '16:30', ageClass: 'D-Junioren', location: { name: 'Bergader SportARENA' }, placementLogic: [],
  ...extra,
} as unknown as Tournament);

describe('@OB-079 Zustand nur bei Abweichung von „Bereit“', () => {
  it('Bereit: keine Marke, kein Wort', () => {
    render(<TournamentCard tournament={turnier()} categoryLabel="upcoming" inToday />);
    expect(screen.queryByTestId('card-state')).toBeNull();
    expect(screen.queryByText(/status\./)).toBeNull();
  });

  it.each([
    ['running', {}, 'status.running'],
    ['archived', { lifecycleStatus: 'finished' }, 'status.finished'],
    ['archived', { lifecycleStatus: 'cancelled' }, 'status.cancelled'],
  ] as const)('%s %j: die Marke trägt Wort „%s“ und ein Symbol', (kategorie, extra, wort) => {
    render(<TournamentCard tournament={turnier(extra)} categoryLabel={kategorie} inToday />);
    const marke = screen.getByTestId('card-state');
    expect(marke).toHaveTextContent(`dashboard:${wort}`);
    expect(marke.querySelector('svg')).not.toBeNull(); // Farbe nie allein
  });

  it('Läuft: Symbol „Spiel“ und kein Fehler-Rot in Rand oder Symbol', () => {
    render(<TournamentCard tournament={turnier()} categoryLabel="running" inToday />);
    const marke = screen.getByTestId('card-state');
    expect(marke).toHaveAttribute('data-tone', 'neutral');
    expect(marke.querySelector('svg path')?.getAttribute('d')).toBe('M8 5l11 7-11 7z'); // Dreieck „Play“
    expect(marke.style.border).not.toContain(cssVars.colors.error);
    expect(marke.style.border).not.toContain(cssVars.colors.statusLive);
    expect(marke.innerHTML).not.toContain(cssVars.colors.error);
  });

  it('Abgeschlossen: Ton „erledigt“ mit Haken', () => {
    render(<TournamentCard tournament={turnier({ lifecycleStatus: 'finished' })} categoryLabel="archived" inToday />);
    expect(screen.getByTestId('card-state')).toHaveAttribute('data-tone', 'done');
  });

  it('Gegenbeispiel: ein Entwurf (eigener Abschnitt) trägt kein Wort auf der Karte', () => {
    render(<TournamentCard tournament={turnier({ status: 'draft' })} categoryLabel="draft" />);
    expect(screen.queryByTestId('card-state')).toBeNull();
  });
});

describe('@OB-079 Das Schild der eigenen Rolle steht in der Zeile des Orts', () => {
  it('Co-Admin: das Schild liegt mit dem Ort in einer Zeile, nicht in der Zeile der Altersklasse und Zeit', () => {
    render(<TournamentCard tournament={turnier({ myRole: 'co-admin' })} categoryLabel="upcoming" inToday />);
    const schild = screen.getByTestId('tournament-role-d');
    const ort = screen.getByTestId('card-location');
    expect(schild).toHaveTextContent('dashboard:card.role.co-admin');
    expect(ort.parentElement).toBe(schild.parentElement?.parentElement); // gemeinsame Zeile
    expect(screen.getByTestId('card-age-class').closest('[style*="grid-row: 1"]')?.contains(schild)).toBe(false);
  });

  it('das Schild steht rechts, der Ort nimmt den übrigen Platz, bricht notfalls um und wird nie gekürzt', () => {
    render(<TournamentCard tournament={turnier({ myRole: 'co-admin' })} categoryLabel="upcoming" inToday />);
    const ort = screen.getByTestId('card-location');
    const zeile = ort.parentElement!;
    expect(zeile.style.display).toBe('flex');
    expect(zeile.style.justifyContent).toBe('space-between');
    expect(ort.style.flexGrow).toBe('1');
    expect(ort.style.minWidth).toBe('0px');
    expect(ort.style.textOverflow).toBe('');
    expect(ort.style.whiteSpace).toBe('');
    expect(screen.getByTestId('tournament-role-d').parentElement?.style.marginLeft).toBe('auto');
  });

  it('auch mit Schild und Zustand bleibt es bei drei Zeilen (Name, Altersklasse · Zeit + Zustand, Ort + Schild)', () => {
    render(<TournamentCard tournament={turnier({ myRole: 'co-admin' })} categoryLabel="running" inToday />);
    const karte = screen.getByTestId('tournament-card-d');
    expect(karte.querySelectorAll('h3')).toHaveLength(1);
    expect(screen.getByTestId('card-state').closest('[style*="grid-row: 1"]')?.contains(screen.getByTestId('card-age-class'))).toBe(true);
    expect(screen.getByTestId('card-location').parentElement?.contains(screen.getByTestId('tournament-role-d'))).toBe(true);
  });

  it('Gegenbeispiel: der Eigentümer und das Turnier ohne Rolle zeigen kein Schild', () => {
    const { rerender } = render(<TournamentCard tournament={turnier({ myRole: 'owner' })} categoryLabel="upcoming" />);
    expect(screen.queryByTestId('tournament-role-d')).toBeNull();
    rerender(<TournamentCard tournament={turnier()} categoryLabel="upcoming" />);
    expect(screen.queryByTestId('tournament-role-d')).toBeNull();
  });

  it('Gegenbeispiel: ohne Ort steht das Schild trotzdem rechts, in der Zeile darunter', () => {
    render(<TournamentCard tournament={turnier({ myRole: 'co-admin', location: { name: '' } })} categoryLabel="upcoming" />);
    expect(screen.queryByTestId('card-location')).toBeNull();
    expect(screen.getByTestId('tournament-role-d').parentElement?.style.marginLeft).toBe('auto');
  });
});
