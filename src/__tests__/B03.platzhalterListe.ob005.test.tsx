/**
 * B-03 (V3) — @OB-005-Gruppe aus B03.platzhalterListe.test.tsx.
 * Gemeinsame Mocks und Helfer: ./helpers/b03PlatzhalterHarness.tsx.
 * Jeder Test unverändert; 30 s Timeout je Fall (kein globales testTimeout).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { expectAbsent, expectRendered, renderAdminSidebar } from './helpers/b03PlatzhalterHarness';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('@OB-005 „Team & Helfer“ erscheint erst mit dem Einstieg per QR-Code und nie als „Bald“', () => {
  it('@OB-005 Solange der QR-Einstieg fehlt, ist „Team & Helfer“ ausgeblendet und trägt nie „Bald“', async () => {
    const { container } = await renderAdminSidebar();
    expectRendered(container);
    expectAbsent(/Team & Helfer/, /\bBald\b|Coming Soon|comingSoon/);
    const { ADMIN_CATEGORIES } = await import('../features/tournament-admin/constants/admin.constants');
    const eintrag = ADMIN_CATEGORIES.find((cat) => cat.id === 'team-helpers');
    expect(eintrag?.isComingSoon).toBeUndefined();
  }, 30_000);
});
