/**
 * B-50 Einstieg: Zähler der offenen Einträge im Kopf (Bauplan B-50), nur für die Turnierleitung; Liste über `?klaerung=1`
 * (URL-ROUTING). @FU-038 (Olli sieht den Eintrag), Gegenbeispiele: Helfer sieht nichts, ohne Einträge kein Knopf.
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import type { Tournament } from '../../../types/tournament';
import type { MatchReview } from '../../../core/match/review/matchReviewTypes';
import { review } from '../../../core/match/review/__tests__/reviewFixtures';

const state: { enabled: boolean; reviews: MatchReview[] } = { enabled: true, reviews: [] };
vi.mock('../useMatchReviews', () => ({ useMatchReviews: () => ({ ...state, refresh: vi.fn() }) }));
vi.mock('../KlaerungslisteDialog', () => ({
  KlaerungslisteDialog: ({ isOpen }: { isOpen: boolean }) => (isOpen ? <div data-testid="klaerungsliste-offen" /> : null),
}));
const { KlaerungslisteEinstieg } = await import('../KlaerungslisteEinstieg');

const tournament = { id: 'live-cup', teams: [] } as unknown as Tournament;
function Where() {
  const location = useLocation();
  return <span data-testid="adresse">{location.pathname + location.search}</span>;
}
function show(path = '/tournament/live-cup/schedule') {
  render(<MemoryRouter initialEntries={[path]}><KlaerungslisteEinstieg tournament={tournament} compact={false} /><Where /></MemoryRouter>);
}

describe('B-50 Einstieg in die Klärungsliste', () => {
  it('@FU-038: Olli sieht den Zähler „1“ und öffnet die Liste über ?klaerung=1', () => {
    state.enabled = true;
    state.reviews = [review()];
    show();
    expect(screen.getByTestId('klaerungsliste-zaehler')).toHaveTextContent('1');
    fireEvent.click(screen.getByTestId('klaerungsliste-knopf'));
    expect(screen.getByTestId('adresse')).toHaveTextContent('/tournament/live-cup/schedule?klaerung=1');
    expect(screen.getByTestId('klaerungsliste-offen')).toBeInTheDocument();
  });

  it('Direktaufruf mit ?klaerung=1 öffnet die Liste (Neuladen behält sie)', () => {
    state.enabled = true;
    state.reviews = [review()];
    show('/tournament/live-cup/live?klaerung=1');
    expect(screen.getByTestId('klaerungsliste-offen')).toBeInTheDocument();
  });

  it('@FU-037: nur Hinweise → Knopf mit „Hinweis“ statt Zähler', () => {
    state.enabled = true;
    state.reviews = [review({ kind: 'notice' })];
    show();
    expect(screen.queryByTestId('klaerungsliste-zaehler')).toBeNull();
    expect(screen.getByTestId('klaerungsliste-hinweise-kurz')).toBeInTheDocument();
  });

  it('Gegenbeispiel: ohne Recht der Turnierleitung (Helfer) kein Knopf und keine Liste, auch mit ?klaerung=1', () => {
    state.enabled = false;
    state.reviews = [review()];
    show('/tournament/live-cup/schedule?klaerung=1');
    expect(screen.queryByTestId('klaerungsliste-knopf')).toBeNull();
    expect(screen.queryByTestId('klaerungsliste-offen')).toBeNull();
  });

  it('Gegenbeispiel: nichts offen, keine Hinweise → kein Knopf', () => {
    state.enabled = true;
    state.reviews = [review({ decision: { type: 'REVIEW_DISCARD', eventId: 'd', at: 1, by: 'Olli' } })];
    show();
    expect(screen.queryByTestId('klaerungsliste-knopf')).toBeNull();
  });
});
