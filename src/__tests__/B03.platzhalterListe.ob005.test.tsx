/**
 * B-03 (V3) — @OB-005-Gruppe aus B03.platzhalterListe.test.tsx.
 * Gemeinsame Mocks und Helfer: ./helpers/b03PlatzhalterHarness.tsx.
 * 30 s Timeout je Fall (kein globales testTimeout).
 *
 * A-18a (GA5): Die Bedingung des Szenarios „der Einstieg der Helfer per QR-Code ist gebaut“ ist erfüllt. Der frühere Fall
 * (Menüpunkt ausgeblendet, solange der QR-Einstieg fehlt) gilt damit nicht mehr; das Szenario verlangt jetzt das Gegenteil:
 * „Team & Helfer“ steht im Menü, ohne „Bald“, und der Bereich bietet keinen Einladungslink der bisherigen Form an.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { expectAbsent, expectRendered, renderAdminSidebar, renderInRouter, makeTournament } from './helpers/b03PlatzhalterHarness';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('@OB-005 „Team & Helfer“ erscheint erst mit dem Einstieg per QR-Code und nie als „Bald“', () => {
  it('@OB-005 Mit dem QR-Einstieg steht „Team & Helfer“ im Menü und trägt nie „Bald“', async () => {
    const { container } = await renderAdminSidebar();
    expectRendered(container);
    expect(screen.getAllByText(/Team & Helfer/).length).toBeGreaterThan(0);
    expectAbsent(/\bBald\b|Coming Soon|comingSoon/);
    const { ADMIN_CATEGORIES } = await import('../features/tournament-admin/constants/admin.constants');
    const eintrag = ADMIN_CATEGORIES.find((cat) => cat.id === 'team-helpers');
    expect(eintrag).toBeDefined();
    expect(eintrag?.isComingSoon).toBeUndefined();
  }, 30_000);

  it('@OB-005 Der Bereich lädt nicht über einen Einladungslink der bisherigen Form ein, Helfer kommen über den QR-Code', async () => {
    const { TeamHelpersCategory } = await import('../features/tournament-admin/categories/TeamHelpers');
    const { container } = renderInRouter(
      <TeamHelpersCategory tournamentId="t1" tournament={makeTournament()} onTournamentUpdate={vi.fn()} />
    );
    expectRendered(container);
    expectAbsent(/Einladung erstellen|createInvite|inviteLinkCreated|\/invite/i);
  }, 30_000);
});
