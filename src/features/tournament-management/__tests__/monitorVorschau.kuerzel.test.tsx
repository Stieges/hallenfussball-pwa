/**
 * MS1 / W3 – Der Verwaltungs-Reiter „Monitor“ ist eine Monitor-Vorschau: Teamnamen dort wie am Monitor gekürzt
 * (@ZM-087, @ZM-149). Gegenbeispiele: ohne Listenwort bleibt der volle Name; ein 50-Zeichen-Name in Größe `lg`
 * steht vollständig und ohne „…“.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createMockTournament, createMockTeam } from '../../../test/factories';
import type { Standing, Team } from '../../../types/tournament';
import { NextMatchCard } from '../components/NextMatchCard';
import { StandingsDisplay } from '../components/StandingsDisplay';
import { NextMatchPreview } from '../../../components/monitor/NextMatchPreview';
import { TeamNameDisplay } from '../../../components/monitor/TeamNameDisplay';

const VOLL = 'Sportgemeinschaft Fußballfreunde Nordheim-Süd 1921';
const KUERZEL = 'SG FF Nordheim-Süd 1921';
const OHNE_LISTENWORT = 'Eintracht Oberweiler-Niederstetten 1919';
/** 50 Zeichen, kein Listenwort (wie in @ZM-087 die Länge, die am Monitor vollständig bleibt). */
const LANG_50 = 'Größenwahn Übungsteam Füßen Ösen Äpfel Ölkrug Ähre';

describe('@ZM-087 Verwaltungs-Reiter „Monitor“: Nächstes Spiel (NextMatchCard) kürzt', () => {
  it('„SG FF Nordheim-Süd 1921 vs. …“ statt des vollen Namens, kein „…“', () => {
    const tournament = createMockTournament({ teams: [] });
    const { container } = render(
      <NextMatchCard
        match={{ id: 'm1', number: 3, homeTeam: VOLL, awayTeam: OHNE_LISTENWORT, scheduledTime: '14:20' }}
        tournament={tournament}
      />,
    );
    expect(container.textContent).toContain(`${KUERZEL} vs. ${OHNE_LISTENWORT}`);
    expect(container.textContent).not.toContain(VOLL);
    expect(container.textContent).not.toContain('…');
  });
});

describe('@ZM-087 Verwaltungs-Reiter „Monitor“: Tabelle (StandingsDisplay) kürzt', () => {
  it('Namenszelle zeigt „SG FF Nordheim-Süd 1921“, Gegenbeispiel „Eintracht …“ bleibt voll', () => {
    const teamVoll: Team = createMockTeam({ id: 't1', name: VOLL, group: undefined });
    const teamEintracht: Team = createMockTeam({ id: 't2', name: OHNE_LISTENWORT, group: undefined });
    const standing = (team: Team): Standing => ({
      team, played: 1, won: 1, drawn: 0, lost: 0, goalsFor: 2, goalsAgainst: 1, goalDifference: 1, points: 3,
    });
    const tournament = createMockTournament({ teams: [teamVoll, teamEintracht] });
    const { container } = render(
      <StandingsDisplay
        standings={[standing(teamVoll), standing(teamEintracht)]}
        teams={[teamVoll, teamEintracht]}
        tournament={tournament}
      />,
    );
    expect(screen.getByText(KUERZEL)).toBeInTheDocument();
    expect(screen.getByText(OHNE_LISTENWORT)).toBeInTheDocument();
    expect(container.textContent).not.toContain(VOLL);
    expect(container.textContent).not.toContain('…');
  });
});

describe('@ZM-087 Verwaltungs-Reiter „Monitor“: Vorschau-Banner (NextMatchPreview) kürzt', () => {
  it('Banner vor dem Spiel: „SG FF Nordheim-Süd 1921“ und der Gegenbeispiel-Name bleibt voll', () => {
    const banner = (remainingSeconds: number) => (
      <NextMatchPreview
        nextMatch={{ id: 'm2', number: 4, homeTeam: VOLL, awayTeam: OHNE_LISTENWORT }}
        currentMatchStatus="RUNNING"
        remainingSeconds={remainingSeconds}
      />
    );
    // Das Banner erscheint erst beim ersten Re-Render mit neuer Restzeit (Mount-Effekt setzt es zurück).
    const { container, rerender } = render(banner(180));
    rerender(banner(120));
    expect(screen.getByText(KUERZEL)).toBeInTheDocument();
    expect(screen.getByText(OHNE_LISTENWORT)).toBeInTheDocument();
    expect(container.textContent).not.toContain(VOLL);
  });
});

describe('W3 Größe lg (Verwaltungs-Reiter) – 50-Zeichen-Name bleibt vollständig, ohne „…“', () => {
  it('TeamNameDisplay size="lg" zeigt den Namen vollständig', () => {
    expect(LANG_50).toHaveLength(50);
    render(<TeamNameDisplay name={LANG_50} size="lg" />);
    const el = screen.getByText(LANG_50);
    expect(el.textContent).toBe(LANG_50);
    expect(el.textContent).not.toContain('…');
    expect(el.style.textOverflow).not.toBe('ellipsis');
  });
});
