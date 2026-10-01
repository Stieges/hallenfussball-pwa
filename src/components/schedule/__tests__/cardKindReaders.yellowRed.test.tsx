/**
 * Leser im Spielplan -- Gelb-Rot (C3b-2 F3b2, Ruling PC30): MatchSummary/EventList und
 * LiveInfoExpand. Gelb-Rot = RED_CARD + payload.cardType 'YELLOW_RED' (LiveInfoExpand bekommt die
 * Ereignisse flach, `cardType` auf oberster Ebene), unterschieden NUR ueber `cardKindOf`.
 * Gegenbeispiel je Leser: RED_CARD ohne cardType = Rot.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { RuntimeMatchEvent, Team } from '../../../types/tournament';
import { EventList } from '../MatchSummary/EventList';
import { LiveInfoExpand, type MatchEvent } from '../MatchExpand/LiveInfoExpand';

vi.mock('react-i18next', async () => {
  const de: unknown = (await import('../../../i18n/locales/de/tournament.json')).default;
  const translate = (key: string, opts?: Record<string, unknown>): string => {
    const found = key.split('.').reduce<unknown>(
      (node, part) => (typeof node === 'object' && node !== null ? (node as Record<string, unknown>)[part] : undefined),
      de,
    );
    let text = typeof found === 'string' ? found : key;
    for (const [name, value] of Object.entries(opts ?? {})) {
      text = text.replace(`{{${name}}}`, String(value));
    }
    return text;
  };
  const stable = { t: translate, i18n: { language: 'de' } };
  return { useTranslation: () => stable };
});

function redCardEvent(cardType: string | undefined): RuntimeMatchEvent {
  return {
    id: 'rc1',
    timestampSeconds: 100,
    type: 'RED_CARD',
    payload: { teamId: 'teamA', teamName: 'Heim', ...(cardType !== undefined ? { cardType } : {}) },
    scoreAfter: { home: 0, away: 0 },
  } as RuntimeMatchEvent;
}

describe('MatchSummary/EventList -- Gelb-Rot (F3b2)', () => {
  const renderList = (event: RuntimeMatchEvent) => render(
    <EventList events={[event]} homeTeamId="teamA" awayTeamId="teamB" homeTeamName="Heim" awayTeamName="Gast" />,
  );

  it('Gelb-Rot zeigt "Gelb-Rote Karte" und das Doppel-Symbol', () => {
    renderList(redCardEvent('YELLOW_RED'));
    expect(screen.getByText(/Gelb-Rote Karte Heim/)).toBeInTheDocument();
    expect(screen.getByText('🟨🟥')).toBeInTheDocument();
  });

  it('Gegenbeispiel: RED_CARD ohne cardType zeigt "Rote Karte" und nur das Rot-Symbol', () => {
    renderList(redCardEvent(undefined));
    expect(screen.getByText(/Rote Karte Heim/)).toBeInTheDocument();
    expect(screen.queryByText(/Gelb-Rote Karte/)).toBeNull();
    expect(screen.getByText('🟥')).toBeInTheDocument();
  });
});

describe('LiveInfoExpand -- Gelb-Rot (F3b2)', () => {
  const homeTeam = { id: 'teamA', name: 'Heim' } as Team;
  const awayTeam = { id: 'teamB', name: 'Gast' } as Team;
  const flatRedCard = (cardType?: string): MatchEvent => ({
    id: 'rc1',
    matchId: 'm1',
    type: 'RED_CARD',
    timestampSeconds: 100,
    teamId: 'teamA',
    ...(cardType !== undefined ? { cardType } : {}),
  } as MatchEvent);
  const renderExpand = (event: MatchEvent) => render(
    <LiveInfoExpand homeTeam={homeTeam} awayTeam={awayTeam} homeScore={0} awayScore={0} elapsedFormatted="01:40" events={[event]} />,
  );

  it('Gelb-Rot zeigt "Gelb-Rote Karte" und das Doppel-Symbol', () => {
    renderExpand(flatRedCard('YELLOW_RED'));
    expect(screen.getByText(/Gelb-Rote Karte Heim/)).toBeInTheDocument();
    expect(screen.getByText('🟨🟥')).toBeInTheDocument();
  });

  it('Gegenbeispiel: RED_CARD ohne cardType zeigt "Rote Karte" und nur das Rot-Symbol', () => {
    renderExpand(flatRedCard());
    expect(screen.getByText(/Rote Karte Heim/)).toBeInTheDocument();
    expect(screen.queryByText(/Gelb-Rote Karte/)).toBeNull();
    expect(screen.getByText('🟥')).toBeInTheDocument();
  });
});
