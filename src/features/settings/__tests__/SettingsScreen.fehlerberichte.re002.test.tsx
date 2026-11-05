/**
 * @RE-002 Einstellungen: „Fehlerberichte senden“ – Vorbelegung an, je Gerät gespeichert; keine Einwilligungs-/Aufzeichnungs-Regler mehr.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ToastProvider } from '../../../components/ui/Toast';
import { SettingsScreen } from '../components/SettingsScreen';

const { anwenden } = vi.hoisted(() => ({ anwenden: vi.fn(async () => undefined) }));
vi.mock('../../../lib/sentry', () => ({ applyErrorReportingPreference: anwenden }));

/** Der Speicher der Testumgebung ist ein Mock ohne Wirkung: hier bekommt er einen echten Inhalt. */
function echterSpeicher(): void {
  const daten = new Map<string, string>();
  vi.mocked(localStorage.getItem).mockImplementation((k) => daten.get(k) ?? null);
  vi.mocked(localStorage.setItem).mockImplementation((k, v) => { daten.set(k, String(v)); });
  vi.mocked(localStorage.removeItem).mockImplementation((k) => { daten.delete(k); });
  vi.mocked(localStorage.clear).mockImplementation(() => daten.clear());
}

const zeige = () => render(<MemoryRouter><ToastProvider><SettingsScreen onBack={vi.fn()} /></ToastProvider></MemoryRouter>);

beforeEach(() => { echterSpeicher(); anwenden.mockClear(); });
afterEach(() => localStorage.clear());

describe('@RE-002 Schalter „Fehlerberichte senden“', () => {
  it('vorbelegt an, ohne Eintrag im Speicher', () => {
    zeige();
    expect(screen.getByTestId('settings-error-reports-toggle')).toHaveAttribute('aria-checked', 'true');
  });

  it('ausschalten: Gerät merkt es sich, der Dienst wird informiert; nach Neuaufbau der Seite weiter aus', async () => {
    const user = userEvent.setup();
    const erste = zeige();
    await user.click(screen.getByTestId('settings-error-reports-toggle'));
    expect(screen.getByTestId('settings-error-reports-toggle')).toHaveAttribute('aria-checked', 'false');
    expect(localStorage.getItem('app:errorReports')).toBe('off');
    expect(anwenden).toHaveBeenCalledTimes(1);

    erste.unmount();
    zeige();
    expect(screen.getByTestId('settings-error-reports-toggle')).toHaveAttribute('aria-checked', 'false');
  });

  it('wieder einschalten (Gegenbeispiel): Eintrag entfällt, Schalter an', async () => {
    const user = userEvent.setup();
    localStorage.setItem('app:errorReports', 'off');
    zeige();
    await user.click(screen.getByTestId('settings-error-reports-toggle'));
    expect(screen.getByTestId('settings-error-reports-toggle')).toHaveAttribute('aria-checked', 'true');
    expect(localStorage.getItem('app:errorReports')).toBeNull();
  });

  it('es gibt keinen Regler für Sitzungsaufzeichnung und keinen „Einwilligung widerrufen“', () => {
    zeige();
    expect(screen.queryByText(/privacy\.sessionReplay/)).toBeNull();
    expect(screen.queryByText(/privacy\.revoke/)).toBeNull();
  });
});
