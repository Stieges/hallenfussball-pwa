/**
 * Karten-Farben nur für Karten (Oberfläche E), Befund C-KARTE-GELB-ALS-WARNFARBE: Ereignislisten der App und der Zuschauer-Seite
 * (MatchSummary/EventList, MatchExpand/LiveInfoExpand). Gelb = cardYellow, Rot = cardRed, Gelb-Rot beide.
 * Gegenbeispiel: Foul/Zeitstrafe sind keine Karten und bekommen kein Kartensymbol.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { RuntimeMatchEvent, Team } from '../../../types/tournament';
import { EventList } from '../MatchSummary/EventList';
import { LiveInfoExpand, type MatchEvent } from '../MatchExpand/LiveInfoExpand';

vi.mock('react-i18next', () => {
  const stable = { t: (key: string) => key, i18n: { language: 'de' } };
  return { useTranslation: () => stable };
});

const GELB = 'var(--color-card-yellow)';
const ROT = 'var(--color-card-red)';

const listEvent = (type: 'YELLOW_CARD' | 'RED_CARD' | 'FOUL', cardType?: string): RuntimeMatchEvent => ({
  id: 'e1', timestampSeconds: 60, type, payload: { teamId: 'teamA', teamName: 'Heim', ...(cardType ? { cardType } : {}) },
  scoreAfter: { home: 0, away: 0 },
} as RuntimeMatchEvent);

const flatEvent = (type: 'YELLOW_CARD' | 'RED_CARD' | 'FOUL', cardType?: string): MatchEvent => ({
  id: 'e1', matchId: 'm1', type, timestampSeconds: 60, teamId: 'teamA', ...(cardType ? { cardType } : {}),
} as MatchEvent);

const home = { id: 'teamA', name: 'Heim' } as Team;
const away = { id: 'teamB', name: 'Gast' } as Team;

const renderers: Array<[string, (e: 'YELLOW_CARD' | 'RED_CARD' | 'FOUL', c?: string) => void]> = [
  ['EventList (Spielverlauf, App und Zuschauer)', (t, c) => { render(<EventList events={[listEvent(t, c)]} homeTeamId="teamA" awayTeamId="teamB" homeTeamName="Heim" awayTeamName="Gast" />); }],
  ['LiveInfoExpand (Zuschauer-Seite /live/:shareCode)', (t, c) => { render(<LiveInfoExpand homeTeam={home} awayTeam={away} homeScore={0} awayScore={0} events={[flatEvent(t, c)]} />); }],
];

describe.each(renderers)('Karten-Farben nur für Karten (Oberfläche E) – %s', (_name, zeige) => {
  it('Gelb zeigt cardYellow', () => {
    zeige('YELLOW_CARD');
    expect(screen.getByTestId('karten-symbol-YELLOW').style.background).toContain(GELB);
  });

  it('Rot zeigt cardRed', () => {
    zeige('RED_CARD');
    expect(screen.getByTestId('karten-symbol-RED').style.background).toContain(ROT);
  });

  it('Gelb-Rot zeigt beide Farben', () => {
    zeige('RED_CARD', 'YELLOW_RED');
    const bg = screen.getByTestId('karten-symbol-YELLOW_RED').style.background;
    expect(bg).toContain(GELB);
    expect(bg).toContain(ROT);
  });

  it('Gegenbeispiel: ein Foul ist keine Karte und bekommt kein Kartensymbol', () => {
    zeige('FOUL');
    expect(screen.queryByTestId(/^karten-symbol-/)).toBeNull();
  });

  it('Foul-Symbol ist neutral (Text-Glyph in Textfarbe), nicht das gelbe Warn-Emoji', () => {
    zeige('FOUL');
    const text = document.body.textContent ?? '';
    expect(text).toContain('\u26A0\uFE0E');
    expect(text).not.toContain('\u26A0\uFE0F');
  });
});
