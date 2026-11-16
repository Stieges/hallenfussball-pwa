/**
 * @OB-038 Beispielzeile „die Taste zum Schließen eines Dialogs“ → überall dasselbe gezeichnete Kreuz, mit Namen für Vorlesehilfen.
 */
import type { ReactElement } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CardDialog } from '../live-cockpit/components/Dialogs/CardDialog';
import { GoalScorerDialog } from '../live-cockpit/components/Dialogs/GoalScorerDialog';
import { ConflictDialog } from '../../features/schedule-editor/components/ConflictDialog';
import { MatchSummary } from '../schedule/MatchSummary';
import { LogoUploadDialog } from '../ui/LogoUploadDialog';
import { LoginSuccessDialog } from '../../features/auth/components/LoginDialogs';
import { RegisterEmailConfirmationDialog, RegisterSuccessDialog } from '../../features/auth/components/RegisterDialogs';

const noop = vi.fn();
const home = { id: 'h', name: 'VfB Ufer' };
const away = { id: 'a', name: 'SC Nord' };

describe('@OB-038 Taste zum Schließen eines Dialogs: überall dasselbe gezeichnete Kreuz', () => {
  const taste = (name: string | RegExp): HTMLElement =>
    screen.getAllByRole('button', { name }).find((b) => b.querySelector('svg') !== null)!;

  const DIALOGE: ReadonlyArray<readonly [string, () => ReactElement, () => HTMLElement]> = [
    ['Karten-Dialog', () => <CardDialog isOpen onClose={noop} onConfirm={noop} homeTeam={home} awayTeam={away} />, () => screen.getByTestId('dialog-close-button')],
    ['Torschützen-Dialog', () => <GoalScorerDialog isOpen onClose={noop} onConfirm={noop} teamName="VfB Ufer" />, () => screen.getByTestId('dialog-close-button')],
    ['Konflikt-Dialog', () => <ConflictDialog isOpen onClose={noop} conflicts={[]} matches={[]} />, () => taste('Schließen')],
    ['Logo-Dialog', () => <LogoUploadDialog teamName="TSV Waging" onSave={noop} onCancel={noop} />, () => taste('Schließen')],
    ['Anmeldung erfolgreich', () => <LoginSuccessDialog migratedCount={0} onClose={noop} />, () => taste(/login.close/)],
    ['Spielzusammenfassung', () => <MatchSummary isOpen onClose={noop} homeScore={2} awayScore={1} homeTeamId="h" awayTeamId="a" homeTeamName="FC Nord" awayTeamName="SV Süd" events={[]} />, () => screen.getByRole('button', { name: /matchSummary.close/ })],
    ['E-Mail-Bestätigung (Registrierung)', () => <RegisterEmailConfirmationDialog email="a@b.de" migratedCount={0} onClose={noop} />, () => taste(/login.close/)],
    ['Registrierung erfolgreich', () => <RegisterSuccessDialog migratedCount={0} onClose={noop} />, () => taste(/login.close/)],
  ];

  it.each(DIALOGE)('%s: gezeichnetes Kreuz statt Textzeichen, mit Namen für Vorlesehilfen', (_name, dialog, finde) => {
    render(dialog());
    const knopf = finde();
    expect(knopf.querySelector('svg')).not.toBeNull();
    expect(knopf.textContent).toBe('');
    expect(knopf.getAttribute('aria-label')).toBeTruthy();
  });

  it('alle acht Dialoge zeigen dieselbe Zeichnung', () => {
    const formen = DIALOGE.map(([, dialog, finde]) => {
      const { unmount } = render(dialog());
      const d = finde().querySelector('svg')!.innerHTML;
      unmount();
      return d;
    });
    expect(new Set(formen).size).toBe(1);
  });
});
