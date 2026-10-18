/**
 * Entscheidung Daniel 18.10. („Okay zur Zeile“), Tabellenzeile im Spielplan der Verwaltung am Laptop (`MatchCardDesktop`):
 * (1) Abzeichen statt Uhrzeit in DERSELBEN Spalte, nie beides (@OB-065, @OB-066);
 * (2) im Ergebnisfeld der Stand groß und darunter klein, grau die Restzeit ohne das Wort „Restzeit“ (@ZM-162).
 * Die Handy-Karte (`MatchCard`) behält „Restzeit“ (Gegenbeispiel).
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.unmock('i18next');
vi.unmock('react-i18next');
import { initRealDeI18n } from '../../../test/realDeI18n';
await initRealDeI18n();

import { cssVars } from '../../../design-tokens';
import { MatchCard, MatchCardDesktop } from '../MatchCard';
import { spectatorClockOf, type MatchBadgeModel } from '../../../core/view';

const NORD = { id: 'nord', name: 'FC Nord' };
const BERG = { id: 'berg', name: 'DJK Berg' };
const LIVE: MatchBadgeModel = { kind: 'badge', state: 'live' };
const RESULT = { goalsA: 1, goalsB: 0, penaltyA: undefined, penaltyB: undefined, decision: null, winner: null } as const;
const REST_9_55 = spectatorClockOf({ totalElapsedSec: 5, sectionSec: 600, sections: 1, stopped: false });

const zeile = (extra: Partial<React.ComponentProps<typeof MatchCardDesktop>>) =>
  render(<MatchCardDesktop matchId="m1" homeTeam={NORD} awayTeam={BERG} scheduledTime="10:00" field={1} status="scheduled" {...extra} />);

describe('@OB-065 Abzeichen statt Uhrzeit in derselben Spalte', () => {
  it('@OB-065 laufendes Spiel: „Live“ steht in der Zeit-Spalte und die Uhrzeit „10:00“ nicht daneben', () => {
    const { container } = zeile({ status: 'running', result: RESULT, badge: LIVE });
    const spalte = screen.getByTestId('match-row-live-m1').parentElement!;
    expect(spalte).toHaveTextContent(/^Live$/);
    expect(container.textContent).not.toContain('10:00');
  });

  it('@OB-065 geplantes Spiel: „10:00“ ohne Abzeichen, in derselben Spalte', () => {
    zeile({ badge: { kind: 'kickoff', time: '10:00' } });
    expect(screen.getByTestId('match-row-time-m1')).toHaveTextContent(/^10:00$/);
    expect(screen.queryByTestId('match-status-badge')).toBeNull();
  });

  it('@OB-065 beendet („Ende“) und ausgefallen: Abzeichen statt Uhrzeit, nie beides', () => {
    for (const [state, wort] of [['ended', 'Ende'], ['cancelled', 'ausgefallen']] as const) {
      const { container, unmount } = zeile({ status: state === 'ended' ? 'finished' : 'skipped', result: state === 'ended' ? RESULT : null, badge: { kind: 'badge', state } });
      expect(screen.getByTestId('match-row-time-m1')).toHaveTextContent(new RegExp(`^${wort}$`));
      expect(container.textContent).not.toContain('10:00');
      unmount();
    }
  });

  it('@OB-065 Gegenbeispiel: die Zeit-Spalte hat in jeder Zeile dieselbe feste Breite (Feld-Spalte springt nicht)', () => {
    const breiten = [{ badge: LIVE, status: 'running' as const }, { badge: { kind: 'kickoff', time: '10:00' } as MatchBadgeModel, status: 'scheduled' as const }].map((p) => {
      const { unmount } = zeile({ ...p, result: p.status === 'running' ? RESULT : null });
      const breite = screen.getByTestId('match-row-time-m1').style.width;
      unmount();
      return breite;
    });
    expect(breiten[0]).not.toBe('');
    expect(breiten[0]).toBe(breiten[1]);
  });
});

describe('@ZM-162 Restzeit im Ergebnisfeld der Zeile', () => {
  it('@ZM-162 Stand groß, darunter klein und grau die Restzeit „9:55“ ohne das Wort „Restzeit“', () => {
    zeile({ status: 'running', result: RESULT, badge: LIVE, clock: REST_9_55 });
    const zeit = screen.getByTestId('match-row-clock-m1');
    expect(zeit).toHaveTextContent(/^9:55$/);
    expect(zeit.style.color).toContain(cssVars.colors.textSecondary);
    expect(zeit.style.fontSize).toBe(cssVars.fontSizes.xs);
    expect(screen.getByTestId('match-circle-m1').textContent).not.toMatch(/Restzeit/);
    expect(screen.getByTestId('match-circle-m1').textContent).toContain('1:0');
  });

  it('@ZM-162 Gegenbeispiel: ein geplantes und ein beendetes Spiel tragen keine Restzeit', () => {
    zeile({ result: null, badge: { kind: 'kickoff', time: '10:00' } });
    expect(screen.queryByTestId('match-row-clock-m1')).toBeNull();
  });

  it('@ZM-162 Gegenbeispiel: die Zuschauer-Karte (Handy) behält das Wort „Restzeit“', () => {
    render(<MatchCard matchId="m1" homeTeam={NORD} awayTeam={BERG} status="running" result={RESULT} badge={LIVE} clock={REST_9_55} />);
    expect(screen.getByTestId('match-clock').closest('div')?.textContent).toContain('Restzeit');
  });
});
