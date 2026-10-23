/**
 * useGuestTournamentNotices.test.ts — C3b-2c (G7): Hinweis als Toast.
 *
 * G7 (task-C3b-plan.md): Der Hinweis „nur im Gastmodus nutzbar – kann ins Konto
 * übernommen werden" wird über den Kanal (`guestTournamentNotices.ts`) als Toast
 * gezeigt — Muster `useMatchProtectionNotices.ts`. Das Test-Setup mockt
 * react-i18next als Passthrough (gibt den Key zurück), deshalb prüft der
 * Hook-Test die Verkabelung und ein eigener Test den DE-Text aus den Locale-Dateien.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import deCommon from '../../i18n/locales/de/common.json';
import enCommon from '../../i18n/locales/en/common.json';

const hoisted = vi.hoisted(() => ({
  shown: [] as string[],
}));

vi.mock('../../components/ui/Toast', () => ({
  useToast: () => ({
    showInfo: (message: string) => {
      hoisted.shown.push(message);
    },
  }),
}));

import { useGuestTournamentNotices } from '../useGuestTournamentNotices';
import { notifyGuestTournamentHidden } from '../../core/services/guestTournamentNotices';

describe('useGuestTournamentNotices (C3b-2c, G7)', () => {
  beforeEach(() => {
    hoisted.shown = [];
  });

  it('zeigt den Hinweis als Toast, sobald der Kanal meldet', () => {
    renderHook(() => useGuestTournamentNotices());

    notifyGuestTournamentHidden({ tournamentId: 'hn-1', title: 'Cup 2026' });

    expect(hoisted.shown).toEqual(['common:guestHidden.hint']);
  });

  it('nach dem Abmelden des Hooks erscheint kein Toast mehr', () => {
    const { unmount } = renderHook(() => useGuestTournamentNotices());
    unmount();

    notifyGuestTournamentHidden({ tournamentId: 'hn-2', title: 'Cup B' });

    expect(hoisted.shown).toHaveLength(0);
  });

  it('DE-Text trägt die Formulierung aus der Anforderung inklusive Titel-Platzhalter', () => {
    expect(deCommon.guestHidden.hint).toContain('nur im Gastmodus nutzbar');
    expect(deCommon.guestHidden.hint).toContain('kann ins Konto übernommen werden');
    expect(deCommon.guestHidden.hint).toContain('{{title}}');
  });

  it('EN-Text ist gesetzt und trägt den Titel-Platzhalter', () => {
    expect(enCommon.guestHidden.hint).toContain('{{title}}');
    expect(enCommon.guestHidden.hint).not.toBe(deCommon.guestHidden.hint);
  });
});