/**
 * B-50 Review MF: Der Knopf „Klärungsliste“ steht im ECHTEN Kopf der Turnierverwaltung (ManagementHeader), ohne Attrappe
 * des Einstiegs – nur Rechte, Netz, Engine-Kontext und die Server-Abfrage sind ersetzt. @FU-038 (Olli sieht den offenen
 * Eintrag mit Zähler); Gegenbeispiel: Helfer Tom sieht keinen Knopf.
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { Tournament } from '../../types/tournament';
import { review } from '../../core/match/review/__tests__/reviewFixtures';

const rolle = { leitung: true };
vi.mock('../../features/auth/hooks/useCan', () => ({ useCan: (recht: string) => (recht === 'leadMatches' ? rolle.leitung : true) }));
vi.mock('../../hooks/useOnlineStatus', () => ({ useOnlineStatus: () => ({ isOnline: true }) }));
vi.mock('../../features/match-engine/useMatchEngineContext', () => ({ useMatchEngineContextOptional: () => ({ accountId: 'olli' }) }));
vi.mock('../../core/repositories/matchReviewsRpc', () => ({ readMatchReviews: () => Promise.resolve({ ok: true, reviews: [review()] }) }));
vi.mock('../../lib/supabase', () => ({ supabase: {} }));
vi.mock('../../components/layout/AuthSection', () => ({ AuthSection: () => null }));
vi.mock('../../features/tournament-management/components/EngineOutboxHeaderStatus', () => ({ EngineOutboxHeaderStatus: () => null }));
const { ManagementHeader } = await import('../ManagementChrome');

const tournament = { id: 'live-cup', title: 'Live-Cup', ageClass: 'E', date: '2026-11-28', teams: [], matches: [] } as unknown as Tournament;
const kopf = () => render(
  <MemoryRouter>
    <ManagementHeader tournament={tournament} isMobile={false} activeTab="schedule" isSettingsDirty={false} onTabChange={vi.fn()}
      onNavigateToLogin={vi.fn()} onNavigateToRegister={vi.fn()} onNavigateToProfile={vi.fn()} />
  </MemoryRouter>,
);

describe('Kopf der Turnierverwaltung: Einstieg Klärungsliste', () => {
  it('@FU-038 Olli (Turnierleitung) sieht im Kopf „Klärungsliste“ mit Zähler 1', async () => {
    rolle.leitung = true;
    kopf();
    expect(await screen.findByTestId('klaerungsliste-knopf')).toHaveTextContent('1');
  });

  it('Gegenbeispiel: Helfer Tom sieht keinen Knopf', async () => {
    rolle.leitung = false;
    kopf();
    await new Promise((resolve) => { setTimeout(resolve, 20); });
    expect(screen.queryByTestId('klaerungsliste-knopf')).toBeNull();
  });
});
