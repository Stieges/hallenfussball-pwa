/**
 * Lade- und Wartezustand der Monitor-Seite (B-16d2; @ME-009, @ME-016, @ME-034): ruhige Seite statt Fehlertext.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MonitorLoadingView, MonitorWaitingView } from '../components/MonitorStatusViews';

vi.unmock('i18next'); vi.unmock('react-i18next'); // B-41: echte DE-Texte, siehe src/test/realDeI18n.ts
await (await import('../../../test/realDeI18n')).initRealDeI18n();

describe('MonitorStatusViews', () => {
  it('Ladezustand zeigt „Lade Display...“', () => {
    render(<MonitorLoadingView />);
    expect(screen.getByText('Lade Display...')).toBeInTheDocument();
  });

  it('@ME-009 Wartezustand zeigt nur „Warte auf Verbindung“', () => {
    render(<MonitorWaitingView />);
    expect(screen.getByTestId('monitor-waiting-state')).toHaveTextContent(/^Warte auf Verbindung$/);
  });

  it('@ME-016 (Übergang, „frei – Code“ folgt mit B-20) Gegenbeispiel: keine Taste, kein Fehlerzustand, keine Fehlerfarbe', () => {
    render(<MonitorWaitingView />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByTestId('monitor-error-state')).toBeNull();
    const farbe = screen.getByTestId('monitor-waiting-message').style.color;
    expect(farbe).not.toBe('');
    expect(farbe).not.toMatch(/239, 68, 68|#ef4444/i);
  });
});
