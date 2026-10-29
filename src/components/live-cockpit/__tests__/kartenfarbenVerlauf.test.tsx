/**
 * Karten-Farben nur für Karten (Oberfläche E), Befund C-KARTE-GELB-ALS-WARNFARBE: Protokollzeile, Bearbeiten-Dialog und
 * Kartenknöpfe im Cockpit. Gelb = cardYellow, Rot = cardRed, Gelb-Rot beide. Gegenbeispiel: „unvollständig“ bleibt bei warning,
 * Kartenknöpfe färben ihre Schrift nicht mit warning/error.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { EditableMatchEvent, RuntimeMatchEvent } from '../../../types/tournament';
import { ProtocolRow } from '../components/ProtocolRow';
import { EventEditDialog } from '../components/Dialogs/EventEditDialog';

vi.mock('react-i18next', () => {
  const stable = { t: (key: string) => key, i18n: { language: 'de' } };
  return { useTranslation: () => stable };
});

const GELB = 'var(--color-card-yellow)';
const ROT = 'var(--color-card-red)';
const quelle = (pfad: string): string => readFileSync(resolve(process.cwd(), pfad), 'utf8');

const protokoll = (type: 'YELLOW_CARD' | 'RED_CARD', cardType?: string): RuntimeMatchEvent => ({
  id: 'e1', timestampSeconds: 60, type, payload: { teamId: 'teamA', teamName: 'Heim', ...(cardType ? { cardType } : {}) },
  scoreAfter: { home: 0, away: 0 },
} as RuntimeMatchEvent);

describe('Karten-Farben nur für Karten (Oberfläche E) – Protokollzeile (Verlauf)', () => {
  const zeige = (e: RuntimeMatchEvent) => render(<ProtocolRow entry={{ event: e, retracted: false }} description="x" variant="sheet" />);

  it('Gelb cardYellow, Rot cardRed, Gelb-Rot beide', () => {
    zeige(protokoll('YELLOW_CARD'));
    expect(screen.getByTestId('karten-symbol-YELLOW').style.background).toContain(GELB);
  });
  it('Rot zeigt cardRed', () => {
    zeige(protokoll('RED_CARD'));
    expect(screen.getByTestId('karten-symbol-RED').style.background).toContain(ROT);
  });
  it('Gelb-Rot zeigt beide Farben', () => {
    zeige(protokoll('RED_CARD', 'YELLOW_RED'));
    const bg = screen.getByTestId('karten-symbol-YELLOW_RED').style.background;
    expect(bg).toContain(GELB);
    expect(bg).toContain(ROT);
  });
  it.each(['sidebar', 'sheet'] as const)('Foul-Symbol (%s) ist neutral: Text-Glyph statt gelbem Warn-Emoji, kein Kartensymbol', (variant) => {
    const foul = { id: 'f', timestampSeconds: 5, type: 'FOUL', payload: { teamId: 'teamA', teamName: 'Heim' }, scoreAfter: { home: 0, away: 0 } } as RuntimeMatchEvent;
    render(<ProtocolRow entry={{ event: foul, retracted: false }} description="Foul" variant={variant} />);
    const text = document.body.textContent ?? '';
    expect(text).toContain('\u26A0\uFE0E');
    expect(text).not.toContain('\u26A0\uFE0F');
    expect(screen.queryByTestId(/^karten-symbol-/)).toBeNull();
  });

  it('Gegenbeispiel: „unvollständig“ ist keine Karte und behält warning', () => {
    expect(quelle('src/components/live-cockpit/components/ProtocolRow.tsx')).toContain('cssVars.colors.warning');
  });
});

describe('Karten-Farben nur für Karten (Oberfläche E) – Bearbeiten-Dialog', () => {
  it('Foul-Symbol im Bearbeiten-Dialog ist neutral (Text-Glyph), kein Kartensymbol', () => {
    render(<EventEditDialog isOpen onClose={vi.fn()} event={{ id: 'f', type: 'FOUL', timestampSeconds: 5, payload: { teamId: 'team-a' } }}
      onUpdate={vi.fn()} onDelete={vi.fn()} homeTeam={{ id: 'team-a', name: 'FC Alpha' }} awayTeam={{ id: 'team-b', name: 'SV Beta' }} />);
    const text = document.body.textContent ?? '';
    expect(text).toContain('\u26A0\uFE0E');
    expect(text).not.toContain('\u26A0\uFE0F');
    expect(screen.queryByTestId(/^karten-symbol-/)).toBeNull();
  });

  const teams = { homeTeam: { id: 'team-a', name: 'FC Alpha' }, awayTeam: { id: 'team-b', name: 'SV Beta' } };
  const zeige = (event: EditableMatchEvent) => render(
    <EventEditDialog isOpen onClose={vi.fn()} event={event} onUpdate={vi.fn()} onDelete={vi.fn()} {...teams} />,
  );

  it('Gelb zeigt cardYellow', () => {
    zeige({ id: 'y', type: 'YELLOW_CARD', timestampSeconds: 5, payload: { teamId: 'team-a' } });
    expect(screen.getByTestId('karten-symbol-YELLOW').style.background).toContain(GELB);
  });
  it('Rot zeigt cardRed', () => {
    zeige({ id: 'r', type: 'RED_CARD', timestampSeconds: 5, payload: { teamId: 'team-a' } });
    expect(screen.getByTestId('karten-symbol-RED').style.background).toContain(ROT);
  });
  it('Gelb-Rot zeigt beide Farben', () => {
    zeige({ id: 'yr', type: 'RED_CARD', timestampSeconds: 5, payload: { teamId: 'team-a', cardType: 'YELLOW_RED' } });
    const bg = screen.getByTestId('karten-symbol-YELLOW_RED').style.background;
    expect(bg).toContain(GELB);
    expect(bg).toContain(ROT);
  });
});
