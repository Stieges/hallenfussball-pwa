/**
 * EventEditDialog -- Gelb-Rot (C3b-2 F3b2, Fixrunde Aufgabe 9, Ruling PC30): Gelb-Rot (RED_CARD +
 * payload.cardType 'YELLOW_RED') zeigt "Gelb-Rote Karte bearbeiten" mit Doppel-Symbol, eine echte
 * Rote (RED_CARD ohne cardType) bleibt "Rote Karte bearbeiten" mit rotem Symbol. Echte deutsche Texte.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { EditableMatchEvent } from '../../../types/tournament';
import { EventEditDialog } from '../components/Dialogs/EventEditDialog';

vi.mock('react-i18next', async () => {
  const de: unknown = (await import('../../../i18n/locales/de/cockpit.json')).default;
  const translate = (key: string): string => {
    const found = key.split('.').reduce<unknown>(
      (node, part) => (typeof node === 'object' && node !== null ? (node as Record<string, unknown>)[part] : undefined),
      de,
    );
    return typeof found === 'string' ? found : key;
  };
  const stable = { t: translate, i18n: { language: 'de' } };
  return { useTranslation: () => stable };
});

const teams = {
  homeTeam: { id: 'team-a', name: 'FC Alpha' },
  awayTeam: { id: 'team-b', name: 'SV Beta' },
};

function redCardEvent(cardType?: 'YELLOW_RED'): EditableMatchEvent {
  return {
    id: 'rc1',
    type: 'RED_CARD',
    timestampSeconds: 100,
    payload: { teamId: 'team-a', ...(cardType !== undefined ? { cardType } : {}) },
  };
}

function renderDialog(event: EditableMatchEvent) {
  return render(
    <EventEditDialog isOpen onClose={vi.fn()} event={event} onUpdate={vi.fn()} onDelete={vi.fn()} {...teams} />,
  );
}

describe('EventEditDialog -- Gelb-Rot (F3b2)', () => {
  it('Gelb-Rot: Titel "Gelb-Rote Karte bearbeiten" mit Doppel-Symbol', () => {
    renderDialog(redCardEvent('YELLOW_RED'));

    expect(screen.getByRole('heading', { name: 'Gelb-Rote Karte bearbeiten' })).toBeInTheDocument();
    expect(screen.getByText('🟨🟥')).toBeInTheDocument();
  });

  it('Gegenbeispiel: echte Rote Karte bleibt "Rote Karte bearbeiten" mit rotem Symbol', () => {
    renderDialog(redCardEvent());

    expect(screen.getByRole('heading', { name: 'Rote Karte bearbeiten' })).toBeInTheDocument();
    expect(screen.getByText('🟥')).toBeInTheDocument();
    expect(screen.queryByText('🟨🟥')).toBeNull();
  });

  it('Gegenbeispiel: Gelbe Karte bleibt "Gelbe Karte bearbeiten" mit gelbem Symbol', () => {
    renderDialog({ id: 'y1', type: 'YELLOW_CARD', timestampSeconds: 50, payload: { teamId: 'team-a' } });

    expect(screen.getByRole('heading', { name: 'Gelbe Karte bearbeiten' })).toBeInTheDocument();
    expect(screen.getByText('🟨')).toBeInTheDocument();
  });
});
