/**
 * @ZM-139 Monitor zeigt die Restzeit · @ZM-137 Hervorhebung nur in der angehaltenen Schlussphase
 *
 * R5 PR 2 (Umstellung nach Record, nicht nach Code): Der Hinweis „Uhr hält bei Unterbrechung“ entfällt (@ZM-137, KORREKTUR
 * 2026-10-16 „ist sinnlos als Hinweis“); neben der Uhr steht nur bei Abweichung ein Wort (@ZM-215, vorher @ZM-166 „Restzeit“ | „angehalten“ | …
 * | „Zeit abgelaufen“; seit @ZM-215 / Daniel 2026-11-19 als Symbol mit dem Wort als zugänglichem Namen), die Hervorhebung ist Violett (@ZM-137, Konsolidierung G17) statt der Umkehrung der Textfarbe.
 */
import { describe, it, expect, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { MatchTimer } from '../MatchTimer';
import de from '../../../i18n/locales/de/monitor.json';

// Die Schlussphase gibt es nur bei „durchlaufend, letzte Minute angehalten“; die Vorgabe eines neuen Turniers ist „immer durchlaufend“ (@SL-002),
// diese Tests setzen die Uhr-Art deshalb selbst.
// i18n ist in Tests ein Durchreicher (Schlüssel). Die deutschen Texte prüft der letzte Block gegen die JSON.

const nowIso = () => new Date().toISOString();
/** Zugänglicher Name des Symbols neben der Uhr (@ZM-215: Symbole statt Wörter, das bisherige Wort steht im Namen) */
const zustandsName = (): string | null => within(screen.getByTestId('clock-label')).getByRole('img').getAttribute('aria-label');
const ziffernFarbe = (): string => screen.getByTestId('monitor-clock').querySelector<HTMLElement>('[data-monitor="uhr"]')?.style.color ?? '';

describe('@ZM-139 MatchTimer zeigt Restzeit', () => {
  it('@ZM-199 Spiel 11: 6-Minuten-Abschnitt bei gespielten 4:10 zeigt 1:50 und nicht 4:10', () => {
    render(<MatchTimer elapsedSeconds={250} durationSeconds={360} status="PAUSED" timerElapsedSeconds={250} />);
    expect(screen.getByTestId('monitor-clock')).toHaveTextContent('1:50');
    expect(screen.queryByText('4:10')).toBeNull();
  });
});

describe('@ZM-137 Uhr-Hervorhebung und Hinweise', () => {
  it('vor der Schlussphase: neutral, ohne Hinweis', () => {
    render(<MatchTimer elapsedSeconds={100} durationSeconds={360} status="PAUSED" timerElapsedSeconds={100} />);
    expect(screen.getByTestId('monitor-clock')).toHaveAttribute('data-phase', 'normal');
    expect(screen.queryByText('liveMatch.clock.holdsOnInterruption')).toBeNull();
  });

  it('angehaltene Schlussphase: Hervorhebung und „angehalten“ neben der Uhr, kein Hinweis „Uhr hält bei Unterbrechung“', () => {
    render(<MatchTimer elapsedSeconds={300} durationSeconds={360} status="PAUSED" timerElapsedSeconds={300} clockMode="durchlaufend-letzte-minute-angehalten" />);
    expect(screen.getByTestId('monitor-clock')).toHaveAttribute('data-phase', 'schlussphaseAngehalten');
    // @ZM-215 (Daniel 2026-11-19): „angehalten“ steht als Pause-Symbol mit dem Wort als Namen; in der Schlussphase bleibt das Violett (Ziffern nicht gedämpft)
    expect(zustandsName()).toMatch(/liveMatch\.clock\.stopped/);
    expect(screen.queryByText(/liveMatch\.clock\.holdsOnInterruption/)).toBeNull();
  });

  it('laufende Schlussphase: Hervorhebung ohne zusätzlichen Text (kein Wort neben der Uhr, kein „Restzeit“, nicht „angehalten“; @ZM-215)', () => {
    render(<MatchTimer elapsedSeconds={300} durationSeconds={360} status="RUNNING" timerStartTime={nowIso()} timerElapsedSeconds={300} clockMode="durchlaufend-letzte-minute-angehalten" />);
    expect(screen.getByTestId('monitor-clock')).toHaveAttribute('data-phase', 'schlussphaseAngehalten');
    expect(screen.queryByTestId('clock-label')).toBeNull();
    expect(screen.queryByText('liveMatch.clock.remaining')).toBeNull();
    expect(screen.queryByText('liveMatch.clock.stopped')).toBeNull();
  });

  it('immer angehalten: vor der Schlussphase ohne Farbwechsel und ohne Hinweis', () => {
    render(<MatchTimer elapsedSeconds={100} durationSeconds={360} status="PAUSED" timerElapsedSeconds={100} clockMode="immer-angehalten" />);
    expect(screen.queryByText(/liveMatch\.clock\.holdsOnInterruption/)).toBeNull();
    expect(screen.getByTestId('monitor-clock')).toHaveAttribute('data-phase', 'normal');
  });

  it('immer durchlaufend: nie Hinweis, nie Hervorhebung', () => {
    render(<MatchTimer elapsedSeconds={350} durationSeconds={360} status="RUNNING" timerStartTime={nowIso()} timerElapsedSeconds={350} clockMode="immer-durchlaufend" />);
    expect(screen.queryByText('liveMatch.clock.holdsOnInterruption')).toBeNull();
    expect(screen.getByTestId('monitor-clock')).toHaveAttribute('data-phase', 'normal');
  });

  it('nach Ablauf ohne Abpfiff (RUNNING): 0:00 und „Zeit abgelaufen“, nie Nachspielzeit', () => {
    render(<MatchTimer elapsedSeconds={400} durationSeconds={360} status="RUNNING" timerStartTime={nowIso()} timerElapsedSeconds={400} />);
    expect(screen.getByTestId('monitor-clock')).toHaveTextContent('0:00');
    expect(zustandsName()).toMatch(/liveMatch\.clock\.ended/); // @ZM-215: Pfeife mit dem Namen „Zeit abgelaufen“, kein Wort
    expect(screen.getByTestId('clock-label').textContent).toBe('');
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
    expect(screen.getByTestId('monitor-clock')).toHaveTextContent(/^0:05$/);
  });
});

describe('Monitor-Uhr: Texte und weitere Zustände', () => {
  it('deutsche Texte stehen wörtlich in der Übersetzung (@ZM-166)', () => {
    expect(de.liveMatch.clock.remaining).toBe('Restzeit');
    expect(de.liveMatch.clock.stopped).toBe('angehalten');
    expect(de.liveMatch.clock.ended).toBe('Zeit abgelaufen');
    expect('holdsOnInterruption' in de.liveMatch.clock).toBe(false);
  });

  it('pausiertes Spiel: neben der Uhr das Pause-Symbol „angehalten“, die Ziffern sind gedämpft (@ZM-215; das Abzeichen oben links bleibt „Live“)', () => {
    render(<MatchTimer elapsedSeconds={100} durationSeconds={600} status="PAUSED" timerElapsedSeconds={100} />);
    expect(zustandsName()).toMatch(/liveMatch\.clock\.stopped/);
    const angehalten = ziffernFarbe();
    cleanup();
    render(<MatchTimer elapsedSeconds={100} durationSeconds={600} status="RUNNING" timerStartTime={nowIso()} timerElapsedSeconds={100} clockMode="immer-durchlaufend" />);
    expect(ziffernFarbe(), 'Gegenbeispiel: laufende Uhr hat ungedämpfte Ziffern').not.toBe(angehalten);
  });

  it('Start: 0:00 Restzeit bei gespielten 0 Sekunden wird als volle Abschnittslänge gezeigt', () => {
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
    expect(screen.getByTestId('clock-label')).toHaveStyle({ color: monitorThemes.dark.text });
  });

  it('@ZM-137 Hervorhebung in eigener Farbe (Violett der Schlussphase), keine Teamfarbe, kein Gelb, kein Rot', () => {
    render(<MatchTimer elapsedSeconds={300} durationSeconds={360} status="PAUSED" timerElapsedSeconds={300} clockMode="durchlaufend-letzte-minute-angehalten" />);
    const ziffern = screen.getByTestId('monitor-clock').querySelector<HTMLElement>('[data-monitor="uhr"]');
    expect(ziffern?.style.color).toBe('var(--color-scoreboard-final-phase)');
    expect(screen.getByTestId('monitor-clock')).not.toHaveStyle({ backgroundColor: '#FDE047' });
  });

  it('M3: abgelaufene Uhr ist nicht in der Überzeit-Rotfarbe', () => {
    render(<MatchTimer elapsedSeconds={400} durationSeconds={360} status="RUNNING" timerStartTime={nowIso()} timerElapsedSeconds={400} />);
    const span = screen.getByText('0:00');
    expect(span).not.toHaveStyle({ color: monitorThemes.dark.timerOvertime });
  });
});

describe('H5 Uhr tickt und berücksichtigt timerStartTime', () => {
  it('RUNNING: Rest sinkt im Sekundentakt (Fake-Timer)', () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2026-10-15T10:00:00Z'));
      render(<MatchTimer elapsedSeconds={0} durationSeconds={360} status="RUNNING" timerStartTime={new Date().toISOString()} timerElapsedSeconds={0} />);
      expect(screen.getByTestId('monitor-clock')).toHaveTextContent('6:00');
      act(() => { vi.advanceTimersByTime(30_000); });
      expect(screen.getByTestId('monitor-clock')).toHaveTextContent('5:30');
      act(() => { vi.advanceTimersByTime(5_000); });
      expect(screen.getByTestId('monitor-clock')).toHaveTextContent('5:25');
    } finally {
      vi.useRealTimers();
    }
  });

  it('RUNNING: die Laufzeit seit timerStartTime zählt, auch ohne Ticks (Mount nach 90 s)', () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2026-10-15T10:00:00Z'));
      render(<MatchTimer elapsedSeconds={0} durationSeconds={360} status="RUNNING" timerStartTime={new Date(Date.now() - 90_000).toISOString()} timerElapsedSeconds={0} />);
      expect(screen.getByTestId('monitor-clock')).toHaveTextContent('4:30');
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
      expect(screen.getByTestId('monitor-clock')).toHaveTextContent('5:00');
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

