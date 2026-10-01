/**
 * P3 Texte (F3a): Karten- und Zeitstrafen-Dialog zeigen den Hinweis
 * „zählt als Foul" (foul.countsAsFoul). Echte deutsche Texte aus de/cockpit.json.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CardDialog } from '../components/Dialogs/CardDialog';
import { TimePenaltyDialog } from '../components/Dialogs/TimePenaltyDialog';

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

const teams = {
  homeTeam: { id: 'team-a', name: 'FC Alpha' },
  awayTeam: { id: 'team-b', name: 'SV Beta' },
};

describe('Dialog-Hinweis „zählt als Foul" (F3a)', () => {
  it('CardDialog zeigt den Hinweis', () => {
    render(
      <CardDialog isOpen onClose={vi.fn()} onConfirm={vi.fn()} {...teams} />,
    );
    expect(screen.getByTestId('card-dialog-foul-hint')).toHaveTextContent('zählt als Foul');
  });

  it('TimePenaltyDialog zeigt den Hinweis', () => {
    render(
      <TimePenaltyDialog isOpen onClose={vi.fn()} onConfirm={vi.fn()} {...teams} />,
    );
    expect(screen.getByTestId('penalty-dialog-foul-hint')).toHaveTextContent('zählt als Foul');
  });
});
