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

  it('nach dem Abbestellen werden keine Hinweise mehr geliefert', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToGuestTournamentNotices(listener);
    unsubscribe();

    notifyGuestTournamentHidden({ tournamentId: 'tn-4', title: 'Turnier D' });

    expect(listener).not.toHaveBeenCalled();
  });
});