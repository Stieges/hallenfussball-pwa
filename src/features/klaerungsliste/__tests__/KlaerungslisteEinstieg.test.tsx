/**
 * B-50 Einstieg: Zähler der offenen Einträge im Kopf (Bauplan B-50), nur für die Turnierleitung; Liste über `?klaerung=1`
 * (URL-ROUTING). @FU-038 (Olli sieht den Eintrag), Gegenbeispiele: Helfer sieht nichts, ohne Einträge kein Knopf.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import type { Tournament } from '../../../types/tournament';
import type { MatchReview } from '../../../core/match/review/matchReviewTypes';
import { review } from '../../../core/match/review/__tests__/reviewFixtures';

const state: { enabled: boolean; reviews: MatchReview[] } = { enabled: true, reviews: [] };
// Gerätespeicher (Q4): im Test ein Speicher im Arbeitsspeicher (jsdom-localStorage ist hier nicht beschreibbar)
const speicher = new Map<string, string>();
vi.mock('../../../core/utils/safeStorage', () => ({
  safeLocalStorage: { getItem: (k: string) => speicher.get(k) ?? null, setItem: (k: string, v: string) => { speicher.set(k, v); } },
}));
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
function show(path = '/tournament/live-cup/schedule', variant: 'kopf' | 'cockpit' = 'kopf') {
  return render(<MemoryRouter initialEntries={[path]}><KlaerungslisteEinstieg tournament={tournament} compact={false} variant={variant} /><Where /></MemoryRouter>);
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

describe('Q4 (Daniel 23.10.): Hinweise gelten je Gerät als gesehen, sobald die Liste offen war', () => {
  beforeEach(() => { speicher.clear(); });

  it('nach dem Öffnen zählt der Hinweis im Kopf nicht mehr', () => {
    state.enabled = true;
    state.reviews = [review({ eventId: 'hinweis-1', kind: 'notice' })];
    const erst = show();
    expect(screen.getByTestId('klaerungsliste-hinweise-kurz')).toBeInTheDocument();
    erst.unmount();
    show('/tournament/live-cup/schedule?klaerung=1').unmount();
    show();
    expect(screen.queryByTestId('klaerungsliste-knopf')).toBeNull();
  });

  it('Gegenbeispiel: ein neuer Hinweis nach dem Ansehen zählt wieder', () => {
    state.enabled = true;
    state.reviews = [review({ eventId: 'hinweis-1', kind: 'notice' })];
    show('/tournament/live-cup/schedule?klaerung=1').unmount();
    state.reviews = [review({ eventId: 'hinweis-1', kind: 'notice' }), review({ eventId: 'hinweis-2', kind: 'notice' })];
    show();
    expect(screen.getByTestId('klaerungsliste-hinweise-kurz')).toBeInTheDocument();
  });
});

describe('Q8 (Daniel 23.10.): unauffälliger Einstieg im Cockpit-Kopf', () => {
  it('Turnierleitung mit offenem Fall: kleiner Zähler-Knopf ohne Beschriftung, öffnet die Liste', () => {
    state.enabled = true;
    state.reviews = [review()];
    show('/tournament/live-cup/live', 'cockpit');
    const knopf = screen.getByTestId('klaerungsliste-knopf-cockpit');
    expect(knopf).toHaveTextContent(/^1$/);
    fireEvent.click(knopf);
    expect(screen.getByTestId('adresse')).toHaveTextContent('/tournament/live-cup/live?klaerung=1');
  });

  it('Gegenbeispiel: ohne offene Fälle (nur Hinweise) im Cockpit nicht sichtbar; Helfer sieht ihn nie', () => {
    state.enabled = true;
    state.reviews = [review({ kind: 'notice', eventId: 'h-neu' })];
    const nurHinweis = show('/tournament/live-cup/live', 'cockpit');
    expect(screen.queryByTestId('klaerungsliste-knopf-cockpit')).toBeNull();
    nurHinweis.unmount();
    state.enabled = false;
    state.reviews = [review()];
    show('/tournament/live-cup/live', 'cockpit');
    expect(screen.queryByTestId('klaerungsliste-knopf-cockpit')).toBeNull();
  });
});
