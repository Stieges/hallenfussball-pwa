/**
 * Leser im Cockpit -- Gelb-Rot (C3b-2 F3b2, Ruling PC30): ProtocolRow (Symbol) und
 * EventLogBottomSheet (Text). Gelb-Rot ist Ereignistyp RED_CARD mit payload.cardType
 * 'YELLOW_RED', unterschieden NUR ueber `cardKindOf`. Gegenbeispiel: RED_CARD ohne cardType = Rot.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { RuntimeMatchEvent } from '../../../types/tournament';
import { ProtocolRow } from '../components/ProtocolRow';
import { EventLogBottomSheet } from '../components/EventLogBottomSheet';

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

describe('ProtocolRow -- Gelb-Rot (F3b2)', () => {
  it('Gelb-Rot zeigt das Doppel-Symbol Gelb+Rot', () => {
    render(<ProtocolRow entry={{ event: redCardEvent('YELLOW_RED'), retracted: false }} description="x" variant="sheet" />);
    expect(screen.getByText('🟨🟥')).toBeInTheDocument();
  });

  it('Gegenbeispiel: RED_CARD ohne cardType zeigt nur das Rot-Symbol', () => {
    render(<ProtocolRow entry={{ event: redCardEvent(undefined), retracted: false }} description="x" variant="sheet" />);
    expect(screen.getByText('🟥')).toBeInTheDocument();
    expect(screen.queryByText('🟨🟥')).toBeNull();
  });
});

describe('EventLogBottomSheet -- Gelb-Rot (F3b2)', () => {
  const renderSheet = (event: RuntimeMatchEvent) => render(
    <EventLogBottomSheet
      isOpen
      onClose={() => undefined}
      events={[event]}
      homeTeamName="Heim"
      awayTeamName="Gast"
      homeTeamId="teamA"
      awayTeamId="teamB"
    />,
  );

  it('Gelb-Rot zeigt "Gelb-Rote Karte"', () => {
    renderSheet(redCardEvent('YELLOW_RED'));
    expect(screen.getByText(/Gelb-Rote Karte Heim/)).toBeInTheDocument();
  });

  it('Gegenbeispiel: RED_CARD ohne cardType zeigt "Rote Karte"', () => {
    renderSheet(redCardEvent(undefined));
    expect(screen.getByText(/Rote Karte Heim/)).toBeInTheDocument();
    expect(screen.queryByText(/Gelb-Rote Karte/)).toBeNull();
  });
});
