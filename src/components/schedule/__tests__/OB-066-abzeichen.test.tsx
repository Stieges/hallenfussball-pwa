/**
 * Aufgabe 1.2 (Spielanzeige): ein Abzeichen auf der Spielkarte, der Finalrunden-Karte und der aufgeklappten Karte
 * (@OB-065, @OB-066, @OB-039). Wortlaut aus dem Gherkin: „Live“, „ausgefallen“, „15:05“ statt Abzeichen.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.unmock('i18next');
vi.unmock('react-i18next');
import { initRealDeI18n } from '../../../test/realDeI18n';
await initRealDeI18n();

import { MatchCard } from '../MatchCard';
import { FinalStageMobileCard } from '../FinalStageMobileCard';
import { LiveInfoExpand } from '../MatchExpand/LiveInfoExpand';
import type { MatchBadgeModel } from '../../../core/view';
import type { ScheduledMatch } from '../../../core/generators';

const NORD = { id: 'nord', name: 'FC Nord' };
const BERG = { id: 'berg', name: 'DJK Berg' };
const LIVE: MatchBadgeModel = { kind: 'badge', state: 'live' };

function spielkarte(props: Partial<React.ComponentProps<typeof MatchCard>>) {
  return render(<MatchCard matchId="m9" homeTeam={NORD} awayTeam={BERG} scheduledTime="14:40" field={2} status="scheduled" {...props} />);
}

function finalkarte(badge: MatchBadgeModel) {
  const match = { id: 'finale', matchNumber: 15, time: '15:50', field: 1, homeTeam: 'FC Nord', awayTeam: 'DJK Berg' } as ScheduledMatch;
  return render(
    <FinalStageMobileCard
      match={match} label="Finale" homeName="FC Nord" awayName="DJK Berg" homePending={false} awayPending={false}
      result={null} isRunning isFinished={false} badge={badge} canEditScore={false} inCorrectionMode={false}
      showReferees={false} showFields={false} editingSchedule={false} displayedRef={undefined} displayedField={undefined}
      hasPendingRef={false} hasPendingField={false} refereeOptions={[]} fieldOptions={[]}
    />,
  );
}

describe('Spielkarte: Zustände als Wort', () => {
  it('@OB-066 Spiel 9 ausgefallen trägt „ausgefallen“', () => {
    spielkarte({ status: 'skipped', viewStatus: 'cancelled', badge: { kind: 'badge', state: 'cancelled' } });
    expect(screen.getByTestId('match-status-badge')).toHaveTextContent('ausgefallen');
  });

  it('@OB-066 Spiel 11 geplant zeigt „15:05“ und kein Abzeichen', () => {
    spielkarte({ scheduledTime: '15:05', badge: { kind: 'kickoff', time: '15:05' } });
    expect(screen.getByTestId('match-kickoff')).toHaveTextContent('15:05');
    expect(screen.queryByTestId('match-status-badge')).toBeNull();
  });

  it('@OB-066 Gegenbeispiel: ein beendetes Spiel trägt „Ende“, nicht „Live“', () => {
    spielkarte({ status: 'finished', badge: { kind: 'badge', state: 'ended' } });
    expect(screen.getByTestId('match-status-badge')).toHaveTextContent('Ende');
    expect(screen.getByTestId('match-status-badge')).not.toHaveTextContent('Live');
  });

  it('@OB-066 Feinstatus der Ansicht: „Halbzeit“ und „Strafstoßschießen“ stehen im Abzeichen, nicht „Pause“', () => {
    for (const [state, wort] of [['halftime', 'Halbzeit'], ['shootout', 'Strafstoßschießen']] as const) {
      const { unmount } = spielkarte({ status: 'running', badge: { kind: 'badge', state } });
      expect(screen.getByTestId('match-status-badge')).toHaveTextContent(wort);
      unmount();
    }
  });
});

describe('@OB-065 dasselbe Abzeichen auf allen Karten', () => {
  it('@OB-065 Spielkarte und Finalrunden-Karte zeigen dasselbe Abzeichen „Live“ in derselben Farbe', () => {
    const { unmount } = spielkarte({ status: 'running', badge: LIVE });
    const karte = screen.getByTestId('match-status-badge');
    const [bg, fg] = [karte.style.background, karte.style.color];
    expect(karte).toHaveTextContent('Live');
    unmount();
    finalkarte(LIVE);
    const final = screen.getByTestId('final-live-finale');
    expect(final).toHaveTextContent('Live');
    expect([final.style.background, final.style.color]).toEqual([bg, fg]);
    expect(final).toHaveAttribute('data-state', 'live');
  });

  it('@OB-065 aufgeklappte Karte (LiveInfoExpand) zeigt dasselbe Abzeichen, kein festes „LIVE“', () => {
    const { container } = render(
      <LiveInfoExpand homeTeam={NORD} awayTeam={BERG} homeScore={1} awayScore={0} elapsedFormatted="07:30" badge={{ kind: 'badge', state: 'halftime' }} />,
    );
    const badge = screen.getByTestId('match-status-badge');
    expect(badge).toHaveTextContent('Halbzeit');
    expect(container.textContent).not.toContain('LIVE');
    // ohne Angabe der Ansicht ist die aufgeklappte Karte eines laufenden Spiels „Live“, in derselben Farbe wie die Spielkarte
    const { unmount } = render(<LiveInfoExpand homeTeam={NORD} awayTeam={BERG} homeScore={0} awayScore={0} elapsedFormatted="01:00" />);
    const live = screen.getAllByTestId('match-status-badge')[1];
    expect(live).toHaveTextContent('Live');
    expect(live).toHaveAttribute('data-state', 'live');
    unmount();
  });

  it('@OB-039 Gegenbeispiel: das Live-Abzeichen trägt statusLive, nicht das Fehler-Rot', () => {
    spielkarte({ status: 'running', badge: LIVE });
    const live = screen.getByTestId('match-status-badge');
    expect(live.style.background).toContain('--color-status-live');
    expect(live.style.background).not.toContain('--color-error');
  });
});
