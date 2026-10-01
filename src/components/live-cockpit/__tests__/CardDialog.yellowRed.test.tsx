/**
 * CardDialog -- Gelb-Rot im Cockpit (C3b-2 F3b2, PO 30.09.): der Helfer waehlt Gelb-Rot explizit
 * in Schritt 1 (Welche Karte?), KEINE automatische Umwandlung/Vorschlag bei der zweiten Gelben.
 * Echte deutsche Texte aus de/cockpit.json.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CardDialog } from '../components/Dialogs/CardDialog';

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

async function pickTypeTeamAndSave(
  user: ReturnType<typeof userEvent.setup>,
  typeLabel: string,
) {
  await user.click(screen.getByRole('button', { name: typeLabel }));
  await user.click(screen.getByRole('button', { name: 'FC Alpha' }));
  await user.click(screen.getByRole('button', { name: 'Ohne Details' }));
}

describe('CardDialog -- Gelb-Rot (F3b2)', () => {
  it('Schritt 1 bietet drei Karten an: Gelb, Gelb-Rot, Rot', () => {
    render(<CardDialog isOpen onClose={vi.fn()} onConfirm={vi.fn()} {...teams} />);

    expect(screen.getByRole('button', { name: 'Gelb' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Gelb-Rot' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Rot' })).toBeInTheDocument();
  });

  it('Gelb-Rot waehlen -> onConfirm erhaelt "YELLOW_RED" (keine automatische Umwandlung)', async () => {
    const onConfirm = vi.fn();
    const user = userEvent.setup();
    render(<CardDialog isOpen onClose={vi.fn()} onConfirm={onConfirm} {...teams} />);

    await pickTypeTeamAndSave(user, 'Gelb-Rot');

    expect(onConfirm).toHaveBeenCalledWith('YELLOW_RED', 'team-a', undefined, true);
  });

  it('Gegenbeispiel: Gelb waehlen -> onConfirm erhaelt "YELLOW"', async () => {
    const onConfirm = vi.fn();
    const user = userEvent.setup();
    render(<CardDialog isOpen onClose={vi.fn()} onConfirm={onConfirm} {...teams} />);

    await pickTypeTeamAndSave(user, 'Gelb');

    expect(onConfirm).toHaveBeenCalledWith('YELLOW', 'team-a', undefined, true);
  });

  it('Gegenbeispiel: Rot waehlen -> onConfirm erhaelt "RED"', async () => {
    const onConfirm = vi.fn();
    const user = userEvent.setup();
    render(<CardDialog isOpen onClose={vi.fn()} onConfirm={onConfirm} {...teams} />);

    await pickTypeTeamAndSave(user, 'Rot');

    expect(onConfirm).toHaveBeenCalledWith('RED', 'team-a', undefined, true);
  });
});
