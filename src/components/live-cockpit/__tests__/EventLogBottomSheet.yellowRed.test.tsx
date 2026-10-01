/**
 * EventLogBottomSheet -- Gelb-Rot-Label (C3b-2 F3b2 Fixrunde 2): DE und EN heissen wie ueberall
 * ("Gelb-Rote Karte" / "Yellow-Red Card", Schluessel cardDialog.*, nicht engine.retract.kind.*).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { RuntimeMatchEvent } from '../../../types/tournament';
import { EventLogBottomSheet } from '../components/EventLogBottomSheet';

const locale = vi.hoisted((): { current: 'de' | 'en' } => ({ current: 'de' }));

vi.mock('react-i18next', async () => {
  const bundles: Record<'de' | 'en', unknown> = {
    de: (await import('../../../i18n/locales/de/cockpit.json')).default,
    en: (await import('../../../i18n/locales/en/cockpit.json')).default,
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

const redCard = (cardType?: 'YELLOW_RED'): RuntimeMatchEvent => ({
  id: 'rc1',
  timestampSeconds: 30,
  type: 'RED_CARD',
  payload: { teamId: 'teamA', teamName: 'Heim', ...(cardType ? { cardType } : {}) },
  scoreAfter: { home: 0, away: 0 },
});

function renderSheet(event: RuntimeMatchEvent) {
  return render(
    <EventLogBottomSheet
      isOpen
      onClose={() => undefined}
      events={[event]}
      homeTeamName="Heim"
      awayTeamName="Gast"
      homeTeamId="teamA"
      awayTeamId="teamB"
      onEventEdit={() => undefined}
    />,
  );
}

describe('EventLogBottomSheet -- Gelb-Rot-Label (Fixrunde 2)', () => {
  beforeEach(() => {
    locale.current = 'de';
  });

  it('DE: Gelb-Rot zeigt "Gelb-Rote Karte", Gegenbeispiel Rot zeigt "Rote Karte"', () => {
    renderSheet(redCard('YELLOW_RED'));
    expect(screen.getByText(/Gelb-Rote Karte Heim/)).toBeInTheDocument();
  });

  it('DE Gegenbeispiel: RED_CARD ohne cardType zeigt "Rote Karte"', () => {
    renderSheet(redCard());
    expect(screen.getByText(/Rote Karte Heim/)).toBeInTheDocument();
    expect(screen.queryByText(/Gelb-Rote Karte/)).toBeNull();
  });

  it('EN: Gelb-Rot heisst "Yellow-Red Card" (nicht "Second yellow card")', () => {
    locale.current = 'en';
    renderSheet(redCard('YELLOW_RED'));
    expect(screen.getByText(/Yellow-Red Card Heim/)).toBeInTheDocument();
    expect(screen.queryByText(/Second yellow card/i)).toBeNull();
  });
});
