/**
 * EventsList (Match-Cockpit) -- Gelb-Rot (C3b-2 F3b2, Ruling PC30): RED_CARD + payload.cardType
 * 'YELLOW_RED' zeigt "Gelb-Rote Karte", Gegenbeispiel RED_CARD ohne cardType zeigt "Rote Karte".
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EventsList, type MatchEvent } from '../EventsList';

const locale = vi.hoisted((): { current: 'de' | 'en' } => ({ current: 'de' }));

// Echte DE-/EN-Cockpit-Texte (i18n), kein Key-Passthrough -- die Beschriftung kommt aus cardDialog.*.
vi.mock('react-i18next', async () => {
  const bundles: Record<'de' | 'en', unknown> = {
    de: (await import('../../../../i18n/locales/de/cockpit.json')).default,
    en: (await import('../../../../i18n/locales/en/cockpit.json')).default,
  };
  const translate = (key: string, opts?: Record<string, unknown>): string => {
    const found = key.split('.').reduce<unknown>(
      (node, part) => (typeof node === 'object' && node !== null ? (node as Record<string, unknown>)[part] : undefined),
      bundles[locale.current],
    );
    let text = typeof found === 'string' ? found : key;
    for (const [name, value] of Object.entries(opts ?? {})) {
      text = text.replace(`{{${name}}}`, String(value));
    }
    return text;
  };
  return { useTranslation: () => ({ t: translate, i18n: { language: locale.current } }) };
});

function redCard(cardType?: 'YELLOW_RED'): MatchEvent {
  return {
    id: 'rc1',
    time: 100,
    type: 'RED_CARD',
    payload: { teamId: 'teamA', teamName: 'Heim', ...(cardType ? { cardType } : {}) },
    scoreAfter: { home: 0, away: 0 },
  };
}

describe('EventsList -- Gelb-Rot (F3b2)', () => {
  beforeEach(() => {
    locale.current = 'de';
  });

  it('Gelb-Rot zeigt "Gelb-Rote Karte"', () => {
    render(<EventsList events={[redCard('YELLOW_RED')]} onUndo={() => undefined} onManualEdit={() => undefined} />);
    expect(screen.getByText(/Gelb-Rote Karte Heim/)).toBeInTheDocument();
  });

  it('Gegenbeispiel: RED_CARD ohne cardType zeigt "Rote Karte"', () => {
    render(<EventsList events={[redCard()]} onUndo={() => undefined} onManualEdit={() => undefined} />);
    expect(screen.getByText(/Rote Karte Heim/)).toBeInTheDocument();
    expect(screen.queryByText(/Gelb-Rote Karte/)).toBeNull();
  });

  it('EN: heisst wie ueberall "Yellow-Red Card" (nicht "Second yellow card")', () => {
    locale.current = 'en';
    render(<EventsList events={[redCard('YELLOW_RED')]} onUndo={() => undefined} onManualEdit={() => undefined} />);
    expect(screen.getByText(/Yellow-Red Card Heim/)).toBeInTheDocument();
    expect(screen.queryByText(/Second yellow card/i)).toBeNull();
  });
});
