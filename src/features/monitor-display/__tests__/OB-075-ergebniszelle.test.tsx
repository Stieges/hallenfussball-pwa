/**
 * @OB-075 / @OB-064 Ergebniszelle der Spielplan-Folie am Monitor: „2:2 (4:3 i. E.)“ – die Kurzform „i. E.“ trägt den ausgeschriebenen
 * Begriff als Hinweis (title) und für Screenreader (aria-label); ohne Entscheidung steht nichts dabei.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

vi.unmock('i18next');
vi.unmock('react-i18next');
import { initRealDeI18n } from '../../../test/realDeI18n';
await initRealDeI18n();

vi.mock('../../../hooks/useLiveMatches', () => ({
  useLiveMatches: () => ({ liveMatches: new Map(), lastGoalEvent: null, lastCardEvent: null }),
}));

import { ScheduleFieldSlide } from '../slides/ScheduleFieldSlide';
import { scheduleFieldLayout } from '../slideContent';
import { pageIndexOf } from '../listRows';
import { buildMonitorView } from '../monitorView';
import { withView } from './monitorViewHelper';
import { slide } from './monitorFixture';
import { fES, GAME, withCloudColumns, type Hallencup } from '../../../core/view/__fixtures__/hallencupNord';

afterEach(cleanup);

function finaleAmMonitor(cup: Hallencup) {
  const spiel = cup.tournament.matches[GAME.FINAL];
  const seite = pageIndexOf(scheduleFieldLayout(buildMonitorView(cup.tournament), spiel.field).pages, spiel.id);
  render(<ScheduleFieldSlide slide={slide('schedule-field', { fieldId: `field-${spiel.field}` })} {...withView(cup.tournament)} theme="dark" style={{}} page={seite} />);
  const zeile = screen.getAllByTestId('monitor-match-row').find(r => r.getAttribute('data-match-id') === spiel.id);
  if (zeile === undefined) { throw new Error('Finale fehlt in der Folie'); }
  return zeile;
}

describe('@OB-075 Monitor: Zusatz in der Ergebniszelle', () => {
  it('Strafstoßschießen 4:3: „(4:3 i. E.)“ mit ausgeschriebenem Begriff als title und aria-label', async () => {
    const cup = withCloudColumns(await fES(), GAME.FINAL, { match_status: 'finished', score_a: 1, score_b: 1, decided_by: 'penalty', penalty_score_a: 4, penalty_score_b: 3 });
    const zeile = finaleAmMonitor(cup);
    const extra = zeile.querySelector('[data-testid="monitor-match-extra"]');
    expect(extra?.textContent).toBe('(4:3 i. E.)');
    expect(extra?.getAttribute('title')).toBe('nach Strafstoßschießen');
    expect(extra?.getAttribute('aria-label')).toContain('nach Strafstoßschießen');
  });

  it('Verlängerung: „n. V.“ mit „nach Verlängerung“ als Hinweis; reguläre Zeit ohne Zusatz', async () => {
    const cup = withCloudColumns(await fES(), GAME.FINAL, { match_status: 'finished', score_a: 2, score_b: 2, overtime_score_a: 1, overtime_score_b: 0, decided_by: 'overtime' });
    const extra = finaleAmMonitor(cup).querySelector('[data-testid="monitor-match-extra"]');
    expect(extra?.textContent).toBe('n. V.');
    expect(extra?.getAttribute('title')).toBe('nach Verlängerung');
    cleanup();
    const regulaer = withCloudColumns(await fES(), GAME.FINAL, { match_status: 'finished', score_a: 1, score_b: 0 });
    expect(finaleAmMonitor(regulaer).querySelector('[data-testid="monitor-match-extra"]')).toBeNull();
  });
});
