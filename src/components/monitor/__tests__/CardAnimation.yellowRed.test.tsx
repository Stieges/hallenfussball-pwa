/**
 * CardAnimation (Monitor) -- Gelb-Rot (C3b-2 F3b2): zeigt "GELB-ROT" statt "ROTE KARTE".
 * Gegenbeispiel: RED_CARD ohne Gelb-Rot zeigt weiterhin "ROTE KARTE".
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CardAnimation, type CardEventInfo } from '../CardAnimation';

// Echte deutsche Monitor-Texte (i18n monitor:cardAnimation.*), kein Key-Passthrough.
vi.mock('react-i18next', async () => {
  const de: unknown = (await import('../../../i18n/locales/de/monitor.json')).default;
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

function cardEvent(cardType: CardEventInfo['cardType']): CardEventInfo {
  return {
    matchId: 'm1',
    teamId: 'teamA',
    teamName: 'FC Alpha',
    side: 'home',
    cardType,
    timestamp: Date.now(),
  };
}

describe('CardAnimation -- Gelb-Rot (F3b2)', () => {
  it('Gelb-Rot zeigt "GELB-ROT"', () => {
    render(<CardAnimation cardEvent={cardEvent('YELLOW_RED')} onAnimationComplete={vi.fn()} />);
    expect(screen.getByText('GELB-ROT')).toBeInTheDocument();
  });

  it('Gegenbeispiel: Rot zeigt weiterhin "ROTE KARTE"', () => {
    render(<CardAnimation cardEvent={cardEvent('RED')} onAnimationComplete={vi.fn()} />);
    expect(screen.getByText('ROTE KARTE')).toBeInTheDocument();
  });

  it('Gelb zeigt weiterhin "GELBE KARTE"', () => {
    render(<CardAnimation cardEvent={cardEvent('YELLOW')} onAnimationComplete={vi.fn()} />);
    expect(screen.getByText('GELBE KARTE')).toBeInTheDocument();
  });
});
