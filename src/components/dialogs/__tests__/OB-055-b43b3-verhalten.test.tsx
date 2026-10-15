/**
 * @OB-055 (B-43b3) — Verhalten der umgestellten Dialoge bleibt wie vor der Umstellung:
 * Esc schließt genau einmal, der Fokus liegt im Dialog, die Abdunkelung schließt (oder ruft
 * die eigene Aktion), ein Klick in die Fläche schließt nicht. Anmeldung, Registrierung,
 * Ergebnis korrigieren und Konflikte im Spielplan.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LoginResetPasswordDialog, LoginSuccessDialog } from '../../../features/auth/components/LoginDialogs';
import { RegisterSuccessDialog } from '../../../features/auth/components/RegisterDialogs';
import { LoginScreen } from '../../../features/auth/components/LoginScreen';
import { CorrectionDialog } from '../CorrectionDialog';
import { ConflictDialog } from '../../../features/schedule-editor/components/ConflictDialog';
import { ToastProvider } from '../../ui/Toast';

vi.mock('../../../features/auth/hooks/useAuth', () => ({
  useAuth: () => ({
    login: vi.fn(), sendMagicLink: vi.fn(), loginWithGoogle: vi.fn(), continueAsGuest: vi.fn(),
    resetPassword: vi.fn(), connectionState: 'connected', reconnect: vi.fn(),
  }),
}));

const panel = () => screen.getByRole('dialog');
const scrim = () => panel().parentElement!;

describe('@OB-055 B-43b3 Verhalten – Anmeldung und Registrierung', () => {
  it('Anmeldung (Passwort-Mail): Esc ruft onClose genau einmal auf, Fokus liegt im Dialog', () => {
    const onClose = vi.fn();
    render(<LoginResetPasswordDialog email="a@b.de" onClose={onClose} onBackdropClick={vi.fn()} />);
    expect(panel().contains(document.activeElement)).toBe(true);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Anmeldung (Passwort-Mail): die Abdunkelung ruft die eigene Aktion, nicht onClose; Klick in die Fläche nichts', () => {
    const onClose = vi.fn();
    const onBackdropClick = vi.fn();
    render(<LoginResetPasswordDialog email="a@b.de" onClose={onClose} onBackdropClick={onBackdropClick} />);
    fireEvent.click(panel());
    expect(onBackdropClick).not.toHaveBeenCalled();
    fireEvent.click(scrim());
    expect(onBackdropClick).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('Anmeldung (Erfolg): Abdunkelung und Esc schließen je einmal', () => {
    const onClose = vi.fn();
    render(<LoginSuccessDialog migratedCount={0} onClose={onClose} />);
    fireEvent.click(scrim());
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('Registrierung (Erfolg): Esc ruft onClose genau einmal auf, der Fokus liegt im Dialog', () => {
    const onClose = vi.fn();
    render(<RegisterSuccessDialog migratedCount={0} onClose={onClose} />);
    expect(panel().contains(document.activeElement)).toBe(true);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Anmeldung (Formular): Esc und Abdunkelung rufen onBack je einmal, ein Klick in die Fläche nicht', () => {
    const onBack = vi.fn();
    render(<LoginScreen onBack={onBack} />);
    expect(panel().contains(document.activeElement)).toBe(true);
    fireEvent.click(panel());
    expect(onBack).not.toHaveBeenCalled();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onBack).toHaveBeenCalledTimes(1);
    fireEvent.click(scrim());
    expect(onBack).toHaveBeenCalledTimes(2);
  });

  it('Anmeldung (Formular) ohne onBack: Esc und Abdunkelung tun nichts (wie vorher)', () => {
    render(<LoginScreen />);
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.click(scrim());
    expect(panel()).toBeInTheDocument();
  });

  it('Anmeldung (Formular): öffnet keinen Verlaufseintrag (Zurück-Taste navigiert die Seite)', () => {
    const before = window.history.length;
    render(<LoginScreen onBack={vi.fn()} />);
    expect(window.history.length).toBe(before);
  });
});

describe('@OB-055 B-43b3 Verhalten – Ergebnis korrigieren und Konflikte', () => {
  const correction = (onClose: () => void) =>
    render(
      <ToastProvider>
        <CorrectionDialog isOpen onClose={onClose} onConfirm={vi.fn()} matchLabel="Spiel 3" teamA="A" teamB="B" originalScoreA={1} originalScoreB={0} />
      </ToastProvider>,
    );

  it('Ergebnis korrigieren: Esc ruft onClose genau einmal auf, der Fokus liegt im Dialog', () => {
    const onClose = vi.fn();
    correction(onClose);
    expect(panel().contains(document.activeElement)).toBe(true);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Ergebnis korrigieren: die Abdunkelung schließt, ein Klick in die Fläche nicht', () => {
    const onClose = vi.fn();
    correction(onClose);
    fireEvent.click(panel());
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(scrim());
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Ergebnis korrigieren: Titel benennt den Dialog (aria-labelledby)', () => {
    correction(vi.fn());
    const id = panel().getAttribute('aria-labelledby')!;
    expect(document.getElementById(id)?.tagName).toBe('H2');
  });

  const conflict = (onClose: () => void) =>
    render(<ConflictDialog isOpen onClose={onClose} conflicts={[]} matches={[]} title="Konflikte im Spielplan" />);

  it('Konflikte: Esc ruft onClose genau einmal auf, der Fokus liegt im Dialog', () => {
    const onClose = vi.fn();
    conflict(onClose);
    expect(panel().contains(document.activeElement)).toBe(true);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Konflikte: die Abdunkelung schließt, ein Klick in die Fläche nicht; geschlossen rendert nichts', () => {
    const onClose = vi.fn();
    const { rerender } = conflict(onClose);
    fireEvent.click(panel());
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(scrim());
    expect(onClose).toHaveBeenCalledTimes(1);
    rerender(<ConflictDialog isOpen={false} onClose={onClose} conflicts={[]} matches={[]} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
