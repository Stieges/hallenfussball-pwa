/**
 * @OB-038 Aufrufer von „Aktualisieren“ (Pfeil im Kreis): „Erneut laden/versuchen/prüfen“-Tasten zeigen das neue Symbol, keine Uhr.
 * Keiner dieser Aufrufer meint eine Uhr (kein Wartezustand): alle sind Wiederholen-Tasten.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FinalStandingsStatus } from '../../tournament-finish/components/FinalStandingsStatus';
import { JoinAccountWaiting } from '../components/JoinAccountWaiting';
import { JoinEndState } from '../components/JoinEndState';
import { Icons } from '../../../components/ui/Icons';

const zeichnung = (el: React.ReactElement): string => {
  const { container, unmount } = render(el);
  const html = container.querySelector('svg')!.innerHTML;
  unmount();
  return html;
};
const refresh = zeichnung(<Icons.Refresh />);
const uhr = zeichnung(<Icons.Clock />);

describe('@OB-038 Aufrufer von „Aktualisieren“', () => {
  it('Endstand „nicht lesbar“: „Erneut laden“ trägt den Pfeil im Kreis', () => {
    render(<FinalStandingsStatus kind="unavailable" onRetry={vi.fn()} />);
    const svg = screen.getByTestId('final-standings-retry').querySelector('svg')!;
    expect(svg.innerHTML).toBe(refresh);
    expect(svg.innerHTML).not.toBe(uhr);
  });

  it('Helfer-Beitritt, Konto wartet: „Erneut prüfen“ trägt den Pfeil im Kreis', () => {
    render(<JoinAccountWaiting waitingCount={2} onRecheck={vi.fn()} />);
    expect(screen.getByTestId('join-retry').querySelector('svg')!.innerHTML).toBe(refresh);
  });

  it('Helfer-Beitritt, offline: „Erneut versuchen“ trägt den Pfeil im Kreis', () => {
    render(<JoinEndState view={{ view: 'offline' } as never} onNavigate={vi.fn()} onHome={vi.fn()} onRecheck={vi.fn()} />);
    expect(screen.getByTestId('join-retry').querySelector('svg')!.innerHTML).toBe(refresh);
  });
});
