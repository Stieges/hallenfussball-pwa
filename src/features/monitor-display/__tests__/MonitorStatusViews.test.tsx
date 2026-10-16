/**
 * B-16d2 Gegenbeispiel: Lade- und Fehlerzustand der Monitor-Seite (Texte wörtlich, Rückweg nur mit onBack).
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MonitorErrorView, MonitorLoadingView } from '../components/MonitorStatusViews';

vi.unmock('i18next'); vi.unmock('react-i18next'); // B-41: echte DE-Texte, siehe src/test/realDeI18n.ts
await (await import('../../../test/realDeI18n')).initRealDeI18n();

describe('MonitorStatusViews', () => {
  it('Ladezustand zeigt „Lade Display...“', () => {
    render(<MonitorLoadingView />);
    expect(screen.getByText('Lade Display...')).toBeInTheDocument();
  });

  it('Fehlerzustand zeigt die Fehlermeldung und die Standardmeldung ohne Fehlertext', () => {
    const { unmount } = render(<MonitorErrorView error="Netzfehler" />);
    expect(screen.getByTestId('monitor-error-message')).toHaveTextContent('Netzfehler');
    unmount();

    render(<MonitorErrorView error={null} />);
    expect(screen.getByTestId('monitor-error-message')).toHaveTextContent('Konfiguration nicht gefunden');
  });

  it('„← Zurück“ erscheint nur mit onBack und ruft ihn auf', () => {
    const { unmount } = render(<MonitorErrorView error="x" />);
    expect(screen.queryByRole('button', { name: '← Zurück' })).toBeNull();
    unmount();

    const onBack = vi.fn();
    render(<MonitorErrorView error="x" onBack={onBack} />);
    fireEvent.click(screen.getByRole('button', { name: '← Zurück' }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
