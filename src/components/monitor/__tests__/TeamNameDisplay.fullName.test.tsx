/**
 * TeamNameDisplay in Größe xl (B-17 Fixrunde, @ZM-087; MS1): ein Name ohne Listenwort steht voll im Text, ohne
 * „…“. Kürzel gibt es nur nach der Vereinswort-Liste (monitorTeamName), nie aus Anfangsbuchstaben (SFNS, GÜFÖ).
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TeamNameDisplay } from '../TeamNameDisplay';

const LANGER = 'Größenwahn Übungsteam Füßen Ösen Äpfel Ölkrug Ähre';

describe('TeamNameDisplay xl – voller Name (@ZM-087)', () => {
  it('zeigt einen 50-Zeichen-Namen mit Umlauten und ß vollständig, ohne „…“', () => {
    render(<TeamNameDisplay name={LANGER} size="xl" />);
    const el = screen.getByText(LANGER);
    expect(el.textContent).toBe(LANGER);
    expect(el.textContent).not.toContain('…');
  });

  it('zeigt einen mittellangen Namen vollständig (kein Initialen-Kürzel)', () => {
    render(<TeamNameDisplay name="Sportfreunde Lotte" size="xl" />);
    expect(screen.getByText('Sportfreunde Lotte')).toBeInTheDocument();
  });
});

describe('TeamNameDisplay xl – gemeinsame Größe (B3)', () => {
  it('übernimmt eine vorgegebene Größe (px) vom Elternteil', () => {
    render(<TeamNameDisplay name="SV Blau-Weiß Kiel" size="xl" sizePx={40} />);
    expect(screen.getByText('SV Blau-Weiß Kiel').style.fontSize).toBe('40px');
  });

  it('meldet die eigene Messung, nicht die vorgegebene gemeinsame Größe (keine Ratsche)', () => {
    const ohne = vi.fn();
    const { unmount } = render(<TeamNameDisplay name="SV Blau-Weiß Kiel" size="xl" onFitPx={ohne} />);
    unmount();
    expect(ohne).toHaveBeenCalled();
    const eigen = ohne.mock.calls[ohne.mock.calls.length - 1][0] as number;
    expect(Number.isFinite(eigen)).toBe(true);
    expect(eigen).toBeGreaterThan(20);

    const mit = vi.fn();
    render(<TeamNameDisplay name="SV Blau-Weiß Kiel" size="xl" sizePx={20} onFitPx={mit} />);
    expect(mit).toHaveBeenCalled();
    for (const call of mit.mock.calls) { expect(call[0]).toBe(eigen); }
  });
});
