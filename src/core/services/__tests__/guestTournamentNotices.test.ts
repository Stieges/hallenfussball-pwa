/**
 * guestTournamentNotices.test.ts — C3b-2c (G7): Hinweis-Kanal.
 *
 * G7 (task-C3b-plan.md): Einmaliger Hinweis „nur im Gastmodus nutzbar – kann ins
 * Konto übernommen werden", sobald ein Turnier mit Gast-Einträgen beim Anmelden
 * NICHT hochgeladen wird. Muster: matchProtectionNotices.ts (core emittiert,
 * ein Hook zeigt den Toast). Dedup je Turnier-ID: der Hinweis erscheint einmal.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  notifyGuestTournamentHidden,
  subscribeToGuestTournamentNotices,
} from '../guestTournamentNotices';

describe('guestTournamentNotices (C3b-2c, G7)', () => {
  it('stellt den Hinweis allen Abonnenten zu', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToGuestTournamentNotices(listener);

    notifyGuestTournamentHidden({ tournamentId: 'tn-1', title: 'Turnier A' });

    expect(listener).toHaveBeenCalledWith({ tournamentId: 'tn-1', title: 'Turnier A' });
    unsubscribe();
  });

  it('dedupliziert je Turnier-ID: der Hinweis erscheint nur einmal', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToGuestTournamentNotices(listener);

    notifyGuestTournamentHidden({ tournamentId: 'tn-2', title: 'Turnier B' });
    notifyGuestTournamentHidden({ tournamentId: 'tn-2', title: 'Turnier B' });
    notifyGuestTournamentHidden({ tournamentId: 'tn-3', title: 'Turnier C' });

    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
  });

  it('M11: ein Hinweis vor dem Abo wird gepuffert und erscheint sofort nach dem Abo', () => {
    // Kein Zuhoerer beim Aufruf — bisher ging der Hinweis fuer die Sitzung verloren.
    notifyGuestTournamentHidden({ tournamentId: 'tn-5', title: 'Turnier E' });

    const listener = vi.fn();
    const unsubscribe = subscribeToGuestTournamentNotices(listener);

    expect(listener).toHaveBeenCalledWith({ tournamentId: 'tn-5', title: 'Turnier E' });
    unsubscribe();
  });

  it('M11: ein vor dem Abo gepufferter Hinweis erscheint nur EINMAL, auch bei erneutem Ruf davor', () => {
    notifyGuestTournamentHidden({ tournamentId: 'tn-6', title: 'Turnier F' });
    notifyGuestTournamentHidden({ tournamentId: 'tn-6', title: 'Turnier F' });

    const listener = vi.fn();
    const unsubscribe = subscribeToGuestTournamentNotices(listener);

    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it('nach dem Abbestellen werden keine Hinweise mehr geliefert', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToGuestTournamentNotices(listener);
    unsubscribe();

    notifyGuestTournamentHidden({ tournamentId: 'tn-4', title: 'Turnier D' });

    expect(listener).not.toHaveBeenCalled();
  });
});