/**
 * Aufgabe 5.1a (Spielanzeige): nur die Restzeit beim Stand auf der Spielkarte, der Finalrunden-Karte, der Tabellenzeile
 * und der aufgeklappten Karte (@ZM-162, @OB-067, @OB-065). Spiel 11 im „Hallencup Nord“: 2 × 6 min, im zweiten Abschnitt
 * 4:10 gespielt (insgesamt 10:10) → Restzeit 1:50.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.unmock('i18next');
vi.unmock('react-i18next');
import { initRealDeI18n } from '../../../test/realDeI18n';
await initRealDeI18n();

import { cssVars } from '../../../design-tokens';
import { MatchCard, MatchCardDesktop } from '../MatchCard';
import { FinalStageMobileCard } from '../FinalStageMobileCard';
import { LiveInfoExpand } from '../MatchExpand/LiveInfoExpand';
import { spectatorClockOf, type MatchBadgeModel } from '../../../core/view';
import type { ScheduledMatch } from '../../../core/generators';

const BERG = { id: 'berg', name: 'DJK Berg' };
const MITTE = { id: 'mitte', name: 'SG Mitte' };
const LIVE: MatchBadgeModel = { kind: 'badge', state: 'live' };
const SPIEL_11 = spectatorClockOf({ totalElapsedSec: 610, sectionSec: 360, sections: 2, stopped: false });
const RESULT = { goalsA: 1, goalsB: 0, penaltyA: undefined, penaltyB: undefined, decision: null, winner: null } as const;

describe('@ZM-162 Restzeit beim Stand', () => {
  it('@ZM-162 Karte von Spiel 11 (Zuschauer): Abzeichen „Live“ ohne Zeit, Restzeit „1:50“ beim Stand; nirgends 4:10 oder 10:10', () => {
    const { container } = render(<MatchCard matchId="m11" homeTeam={BERG} awayTeam={MITTE} scheduledTime="14:50" field={2} status="running" result={RESULT} badge={LIVE} clock={SPIEL_11} />);
    expect(screen.getByTestId('match-status-badge')).toHaveTextContent(/^Live$/);
    expect(screen.getByTestId('match-clock')).toHaveTextContent('1:50');
    expect(screen.getByTestId('match-clock-section')).toHaveTextContent('2. Halbzeit');
    expect(container.textContent).not.toMatch(/4:10|04:10|10:10/);
  });

  it('@ZM-162 Gegenbeispiel: ein beendetes Spiel und ein geplantes Spiel tragen keine Uhr', () => {
    const { rerender } = render(<MatchCard matchId="m11" homeTeam={BERG} awayTeam={MITTE} status="finished" result={RESULT} badge={{ kind: 'badge', state: 'ended' }} clock={null} />);
    expect(screen.queryByTestId('match-clock')).toBeNull();
    rerender(<MatchCard matchId="m11" homeTeam={BERG} awayTeam={MITTE} status="scheduled" badge={{ kind: 'kickoff', time: '15:05' }} clock={null} />);
    expect(screen.queryByTestId('match-clock')).toBeNull();
  });

  it('@ZM-162 Finalrunden-Karte (Handy): Restzeit beim Stand, Abzeichen „Live“ ohne Zeit', () => {
    const match = { id: 'finale', matchNumber: 15, time: '15:50', field: 1, homeTeam: 'FC Nord', awayTeam: 'DJK Berg' } as ScheduledMatch;
    render(
      <FinalStageMobileCard
        match={match} label="Finale" homeName="FC Nord" awayName="DJK Berg" homePending={false} awayPending={false}
        result={null} isRunning isFinished={false} badge={LIVE} clock={SPIEL_11} canEditScore={false} inCorrectionMode={false}
        showReferees={false} showFields={false} editingSchedule={false} displayedRef={undefined} displayedField={undefined}
        hasPendingRef={false} hasPendingField={false} refereeOptions={[]} fieldOptions={[]}
      />,
    );
    expect(screen.getByTestId('match-clock')).toHaveTextContent('1:50');
    expect(screen.getByTestId('final-live-finale')).toHaveTextContent(/^Live$/);
  });

  it('@ZM-162 Tabellenzeile (Laptop): die Restzeit steht beim Ergebnis, nicht die gespielte Zeit', () => {
    const { container } = render(<MatchCardDesktop matchId="m11" homeTeam={BERG} awayTeam={MITTE} status="running" result={RESULT} badge={LIVE} clock={SPIEL_11} />);
    expect(screen.getByTestId('match-row-clock-m11')).toHaveTextContent('1:50');
    expect(container.textContent).not.toMatch(/04:10|4:10|10:10/);
  });

  it('@ZM-162 aufgeklappte Karte zeigt keine gespielte Zeit', () => {
    const { container } = render(<LiveInfoExpand homeTeam={BERG} awayTeam={MITTE} homeScore={1} awayScore={0} clock={SPIEL_11} badge={LIVE} />);
    expect(container.textContent).not.toMatch(/04:10|4:10|10:10/);
    expect(screen.getByTestId('match-clock')).toHaveTextContent('1:50');
    expect(screen.queryByTestId('live-timer')).toBeNull();
  });
});

describe('@OB-067 Stand und Restzeit sind die größten Texte der Karte', () => {
  it('@OB-067 Stand und Restzeit sind größer als jeder andere Text der Karte', () => {
    render(<MatchCard matchId="m11" homeTeam={BERG} awayTeam={MITTE} scheduledTime="14:50" field={2} group="B" referee="SR 3" status="running" result={RESULT} badge={LIVE} clock={SPIEL_11} />);
    const groesse = (el: HTMLElement): string => el.style.fontSize;
    expect(groesse(screen.getByTestId('match-clock'))).toBe(cssVars.fontSizes.xl);
    expect(groesse(screen.getByTestId('match-goals-m11-home'))).toBe(cssVars.fontSizes.xl);
    // alle übrigen Texte der Karte (Namen, Abzeichen, Meta, Abschnittswort) sind kleiner als xl
    const kleiner = [screen.getByTestId('match-name-m11-home'), screen.getByTestId('match-status-badge'), screen.getByTestId('match-clock-section')];
    for (const el of kleiner) {
      expect(groesse(el) === '' ? el.parentElement?.style.fontSize : groesse(el)).not.toBe(cssVars.fontSizes.xl);
    }
  });

  it('@OB-067 Gegenbeispiel: die Restzeit hat dieselbe Schrift wie der Stand (800, gleich breite Ziffern), Namen nicht', () => {
    render(<MatchCard matchId="m11" homeTeam={BERG} awayTeam={MITTE} status="running" result={RESULT} badge={LIVE} clock={SPIEL_11} />);
    expect(screen.getByTestId('match-clock').style.fontWeight).toBe(cssVars.fontWeights.extrabold);
    expect(screen.getByTestId('match-name-m11-home').style.fontWeight).not.toBe(cssVars.fontWeights.extrabold);
  });
});
