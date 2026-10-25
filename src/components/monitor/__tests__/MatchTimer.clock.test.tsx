/**
 * @ZM-139 Monitor zeigt die Restzeit · @ZM-137 Hervorhebung nur in der angehaltenen Schlussphase
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MatchTimer } from '../MatchTimer';
import de from '../../../i18n/locales/de/monitor.json';

// i18n ist in Tests ein Durchreicher (Schlüssel). Die deutschen Texte prüft der letzte Block gegen die JSON.

const nowIso = () => new Date().toISOString();

describe('@ZM-139 MatchTimer zeigt Restzeit', () => {
  it('Spiel 11: 6-Minuten-Abschnitt bei gespielten 4:10 zeigt 01:50 und nicht 04:10', () => {
    render(<MatchTimer elapsedSeconds={250} durationSeconds={360} status="PAUSED" timerElapsedSeconds={250} />);
    expect(screen.getByTestId('monitor-clock')).toHaveTextContent('01:50');
    expect(screen.queryByText('04:10')).toBeNull();
  });
});

describe('@ZM-137 Uhr-Hervorhebung und Hinweise', () => {
  it('vor der Schlussphase: neutral, ohne Hinweis', () => {
    render(<MatchTimer elapsedSeconds={100} durationSeconds={360} status="PAUSED" timerElapsedSeconds={100} />);
    expect(screen.getByTestId('monitor-clock')).toHaveAttribute('data-phase', 'normal');
    expect(screen.queryByText('liveMatch.clock.holdsOnInterruption')).toBeNull();
  });

  it('angehaltene Schlussphase: Hervorhebung, Hinweis und „angehalten“', () => {
    render(<MatchTimer elapsedSeconds={300} durationSeconds={360} status="PAUSED" timerElapsedSeconds={300} />);
    expect(screen.getByTestId('monitor-clock')).toHaveAttribute('data-phase', 'schlussphaseAngehalten');
    expect(screen.getByText(/liveMatch\.clock\.holdsOnInterruption/)).toBeInTheDocument();
    expect(screen.getByText(/liveMatch\.clock\.stopped/)).toBeInTheDocument();
  });

  it('laufende Schlussphase: Hinweis, aber nicht „angehalten“', () => {
    render(<MatchTimer elapsedSeconds={300} durationSeconds={360} status="RUNNING" timerStartTime={nowIso()} timerElapsedSeconds={300} />);
    expect(screen.getByText(/liveMatch\.clock\.holdsOnInterruption/)).toBeInTheDocument();
    expect(screen.queryByText('liveMatch.clock.stopped')).toBeNull();
  });

  it('immer angehalten: Hinweis schon vor der Schlussphase, ohne Farbwechsel', () => {
    render(<MatchTimer elapsedSeconds={100} durationSeconds={360} status="PAUSED" timerElapsedSeconds={100} clockMode="immer-angehalten" />);
    expect(screen.getByText(/liveMatch\.clock\.holdsOnInterruption/)).toBeInTheDocument();
    expect(screen.getByTestId('monitor-clock')).toHaveAttribute('data-phase', 'normal');
  });

  it('immer durchlaufend: nie Hinweis, nie Hervorhebung', () => {
    render(<MatchTimer elapsedSeconds={350} durationSeconds={360} status="RUNNING" timerStartTime={nowIso()} timerElapsedSeconds={350} clockMode="immer-durchlaufend" />);
    expect(screen.queryByText('liveMatch.clock.holdsOnInterruption')).toBeNull();
    expect(screen.getByTestId('monitor-clock')).toHaveAttribute('data-phase', 'normal');
  });

  it('nach Ablauf ohne Abpfiff (RUNNING): 00:00 und „Zeit abgelaufen“, nie Nachspielzeit', () => {
    render(<MatchTimer elapsedSeconds={400} durationSeconds={360} status="RUNNING" timerStartTime={nowIso()} timerElapsedSeconds={400} />);
    expect(screen.getByTestId('monitor-clock')).toHaveTextContent('00:00');
    expect(screen.getByText(/liveMatch\.clock\.ended/)).toBeInTheDocument();
    expect(screen.queryByText('Nachspielzeit')).toBeNull();
  });

  it('H2 Gegenbeispiel: nach dem Abpfiff (FINISHED) steht der Text nicht, auch bei abgelaufener Zeit', () => {
    render(<MatchTimer elapsedSeconds={400} durationSeconds={360} status="FINISHED" timerElapsedSeconds={400} />);
    expect(screen.queryByText(/liveMatch\.clock\.ended/)).toBeNull();
  });

  it('H2 Gegenbeispiel: zu früh beendet (FINISHED, Zeit nicht abgelaufen) zeigt keine Restzeit-Hinweise', () => {
    render(<MatchTimer elapsedSeconds={100} durationSeconds={360} status="FINISHED" timerElapsedSeconds={100} />);
    expect(screen.queryByText(/liveMatch\.clock\.ended/)).toBeNull();
    expect(screen.queryByText(/liveMatch\.clock\.holdsOnInterruption/)).toBeNull();
  });

  it('keine Eskalation: kein Sekundenbruchteil in der Schlussphase (Gegenbeispiel zu 10-s-Countdown)', () => {
    render(<MatchTimer elapsedSeconds={355} durationSeconds={360} status="PAUSED" timerElapsedSeconds={355} />);
    expect(screen.getByTestId('monitor-clock')).toHaveTextContent(/^00:05$/);
  });
});

describe('Monitor-Uhr: Texte und weitere Zustände', () => {
  it('deutsche Texte stehen wörtlich in der Übersetzung', () => {
    expect(de.liveMatch.clock.holdsOnInterruption).toBe('Uhr hält bei Unterbrechung');
    expect(de.liveMatch.clock.stopped).toBe('angehalten');
    expect(de.liveMatch.clock.ended).toBe('Zeit abgelaufen');
  });

  it('Pause-Badge bleibt bei pausiertem Spiel sichtbar', () => {
    render(<MatchTimer elapsedSeconds={100} durationSeconds={600} status="PAUSED" timerElapsedSeconds={100} />);
    expect(screen.getByText(/timer\.pause/)).toBeInTheDocument();
  });

  it('Start: 00:00 Restzeit bei gespielten 0 Sekunden wird als volle Abschnittslänge gezeigt', () => {
    render(<MatchTimer elapsedSeconds={0} durationSeconds={600} status="NOT_STARTED" />);
    expect(screen.getByTestId('monitor-clock')).toHaveTextContent('10:00');
  });
});

import { act } from '@testing-library/react';
import { monitorThemes } from '../../../design-tokens';
import { getContrastRatio } from '../../../design-tokens/display';

describe('H1 Hinweis lesbar, M2 neutrale Hervorhebung, M3 abgelaufen nicht Rot', () => {
  it('H1: Hinweistext hat mindestens 4,5 : 1 zum Monitor-Hintergrund (dark und light)', () => {
    for (const theme of [monitorThemes.dark, monitorThemes.light]) {
      expect(getContrastRatio(theme.text, theme.background)).toBeGreaterThanOrEqual(4.5);
    }
    render(<MatchTimer elapsedSeconds={300} durationSeconds={360} status="PAUSED" timerElapsedSeconds={300} />);
    expect(screen.getByText(/liveMatch\.clock\.holdsOnInterruption/)).toHaveStyle({ color: monitorThemes.dark.text });
  });

  it('M2: Hervorhebung ist neutral (Umkehrung der Textfarbe), keine Buntfarbe', () => {
    render(<MatchTimer elapsedSeconds={300} durationSeconds={360} status="PAUSED" timerElapsedSeconds={300} />);
    expect(screen.getByTestId('monitor-clock')).toHaveStyle({ backgroundColor: monitorThemes.dark.text });
    expect(screen.getByTestId('monitor-clock')).not.toHaveStyle({ backgroundColor: '#FDE047' });
  });

  it('M3: abgelaufene Uhr ist nicht in der Überzeit-Rotfarbe', () => {
    render(<MatchTimer elapsedSeconds={400} durationSeconds={360} status="RUNNING" timerStartTime={nowIso()} timerElapsedSeconds={400} />);
    const span = screen.getByText('00:00');
    expect(span).not.toHaveStyle({ color: monitorThemes.dark.timerOvertime });
  });
});

describe('H5 Uhr tickt und berücksichtigt timerStartTime', () => {
  it('RUNNING: Rest sinkt im Sekundentakt (Fake-Timer)', () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2026-10-15T10:00:00Z'));
      render(<MatchTimer elapsedSeconds={0} durationSeconds={360} status="RUNNING" timerStartTime={new Date().toISOString()} timerElapsedSeconds={0} />);
      expect(screen.getByTestId('monitor-clock')).toHaveTextContent('06:00');
      act(() => { vi.advanceTimersByTime(30_000); });
      expect(screen.getByTestId('monitor-clock')).toHaveTextContent('05:30');
      act(() => { vi.advanceTimersByTime(5_000); });
      expect(screen.getByTestId('monitor-clock')).toHaveTextContent('05:25');
    } finally {
      vi.useRealTimers();
    }
  });

  it('RUNNING: die Laufzeit seit timerStartTime zählt, auch ohne Ticks (Mount nach 90 s)', () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2026-10-15T10:00:00Z'));
      render(<MatchTimer elapsedSeconds={0} durationSeconds={360} status="RUNNING" timerStartTime={new Date(Date.now() - 90_000).toISOString()} timerElapsedSeconds={0} />);
      expect(screen.getByTestId('monitor-clock')).toHaveTextContent('04:30');
    } finally {
      vi.useRealTimers();
    }
  });

  it('PAUSED bleibt stehen', () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2026-10-15T10:00:00Z'));
      render(<MatchTimer elapsedSeconds={60} durationSeconds={360} status="PAUSED" timerElapsedSeconds={60} />);
      act(() => { vi.advanceTimersByTime(20_000); });
      expect(screen.getByTestId('monitor-clock')).toHaveTextContent('05:00');
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('M5 @ZM-125 Uhr deutlich größer als Teamnamen', () => {
  const maxPx = (token: string) => Math.max(...[...token.matchAll(/(\d+(?:\.\d+)?)px/g)].map(m => Number(m[1])));
  it('Größe der Uhr (xl) ist mindestens 1,5× die Größe der Teamnamen (größter Wert)', async () => {
    const { displayFontSizes } = await import('../../../design-tokens');
    expect(maxPx(displayFontSizes.clockXL)).toBeGreaterThanOrEqual(1.5 * maxPx(displayFontSizes.teamName));
  });
});

