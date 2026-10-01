/**
 * EventEditDialog -- Gelb-Rot (C3b-2 F3b2, Fixrunde Aufgabe 9, Ruling PC30): Gelb-Rot (RED_CARD +
 * payload.cardType 'YELLOW_RED') zeigt "Gelb-Rote Karte bearbeiten" mit Doppel-Symbol, eine echte
 * Rote (RED_CARD ohne cardType) bleibt "Rote Karte bearbeiten" mit rotem Symbol. Echte deutsche Texte.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { EditableMatchEvent } from '../../../types/tournament';
import { EventEditDialog } from '../components/Dialogs/EventEditDialog';

const locale = vi.hoisted((): { current: 'de' | 'en' } => ({ current: 'de' }));

// Echte DE-/EN-Texte inkl. {{platzhalter}}-Interpolation (kein Key-Passthrough).
vi.mock('react-i18next', async () => {
  const bundles: Record<'de' | 'en', unknown> = {
    de: (await import('../../../i18n/locales/de/cockpit.json')).default,
    en: (await import('../../../i18n/locales/en/cockpit.json')).default,
  };
  const translate = (key: string, options?: Record<string, string>): string => {
    const found = key.split('.').reduce<unknown>(
      (node, part) => (typeof node === 'object' && node !== null ? (node as Record<string, unknown>)[part] : undefined),
      bundles[locale.current],
    );
    if (typeof found !== 'string') {
      return key;
    }
    return found.replace(/\{\{(\w+)\}\}/g, (_match, name: string) => options?.[name] ?? '');
  };
  return { useTranslation: () => ({ t: translate, i18n: { language: locale.current } }) };
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
  beforeEach(() => {
    locale.current = 'de';
  });

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

  it('EN: Titel und Label heissen wie ueberall "Yellow-Red Card" (nicht "Second yellow card"), Titel ueber i18n', () => {
    locale.current = 'en';
    renderDialog(redCardEvent('YELLOW_RED'));

    expect(screen.getByRole('heading', { name: 'Edit Yellow-Red Card' })).toBeInTheDocument();
    expect(screen.queryByText(/Second yellow card/i)).toBeNull();
  });
});
