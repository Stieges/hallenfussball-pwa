/**
 * Sidebar-Protokoll -- Gelb-Rot (C3b-2 F3b2, Ruling PC30): Gelb-Rot ist Ereignistyp RED_CARD mit
 * payload.cardType 'YELLOW_RED', unterschieden NUR ueber `cardKindOf`. Das Protokoll zeigt
 * "Gelb-Rot" statt "Rot".
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { RuntimeMatchEvent } from '../../../types/tournament';
import { Sidebar } from '../components/Sidebar';

vi.mock('react-i18next', async () => {
  const de: unknown = (await import('../../../i18n/locales/de/cockpit.json')).default;
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

describe('Sidebar Protokoll -- Gelb-Rot (F3b2)', () => {
  it('Gelb-Rot (RED_CARD + cardType "YELLOW_RED") zeigt "Gelb-Rot"', () => {
    render(
      <Sidebar
        activePenalties={[]}
        events={[redCardEvent('YELLOW_RED')]}
        homeTeamName="Heim"
        awayTeamName="Gast"
        homeTeamId="teamA"
        awayTeamId="teamB"
      />,
    );
    expect(screen.getByText(/Gelb-Rot Heim/)).toBeInTheDocument();
  });

  it('Gegenbeispiel: RED_CARD ohne cardType zeigt weiterhin "Rot"', () => {
    render(
      <Sidebar
        activePenalties={[]}
        events={[redCardEvent(undefined)]}
        homeTeamName="Heim"
        awayTeamName="Gast"
        homeTeamId="teamA"
        awayTeamId="teamB"
      />,
    );
    expect(screen.getByText(/Rot Heim/)).toBeInTheDocument();
    expect(screen.queryByText(/Gelb-Rot Heim/)).toBeNull();
  });
});
