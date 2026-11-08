/**
 * @ZM-158 @ZM-161 @ZM-195 Zuschauer-Karte am Handy: beim laufenden und beim nächsten Spiel steht die Torzahl in einem kleinen Kasten in der Farbe
 * der Mannschaft – als Trainingsleibchen mit Leibchen-Zeichen oben links, wenn das Team Leibchen trägt; bei „Als Nächstes“ „0“ statt Strich.
 * Alle anderen Spiele zeigen die Zahl wie bisher (keine Kästen in der Spielliste).
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.unmock('i18next');
vi.unmock('react-i18next');
vi.mock('../../../hooks/useLiveMatches', () => ({ useLiveMatches: () => ({ liveMatches: new Map() }) }));
import { initRealDeI18n } from '../../../test/realDeI18n';
await initRealDeI18n();

import { MatchCard } from '../MatchCard';
import { FinalStageMobileCard } from '../FinalStageMobileCard';
import { FinalStageSchedule } from '../FinalStageSchedule';
import { teamSlot } from '../../../core/models/matchSlot';
import { testUuid } from '../../../test/testIds';
import { createMockTournament } from '../../../test/factories';
import { buildMonitorView } from '../../../features/monitor-display/monitorView';
import type { ScheduledMatch } from '../../../core/generators';
import type { ResultFigures } from '../matchResult';
import type { MatchView } from '../../../core/view';
import { palette } from '../../../design-tokens/colors/palette';

const NORD = { id: 'team-nord', name: 'FC Nord' };
const SUED = { id: 'team-sued', name: 'SV Süd' };
const ROT = palette.kit.red;
const BLAU = palette.kit.blue;
const GELB = palette.yellow[400];
const RESULT = { goalsA: 1, goalsB: 0, penaltyA: undefined, penaltyB: undefined, decision: null, winner: null } as const;

const rot: MatchView['boxes']['home'] = { fill: { kind: 'solid', color: ROT }, bib: false };
const weste: MatchView['boxes']['away'] = { fill: { kind: 'vest', center: GELB, stripes: ROT }, bib: true };

const laeuft = (kasten?: MatchView['boxes'], result: typeof RESULT | null = RESULT) =>
  render(<MatchCard matchId="m2" homeTeam={NORD} awayTeam={SUED} status="running" result={result} kasten={kasten} />);

describe('@ZM-158 @ZM-161 Läuft gerade: kleiner Kasten in Teamfarbe', () => {
  it('@ZM-161 FC Nord ganz Rot, SV Süd als Weste (Gelb, Teile in Rot) mit Leibchen-Zeichen oben links am kleinen Kasten', () => {
    laeuft({ home: rot, away: weste });
    expect(screen.getByTestId('match-box-m2-home')).toHaveAttribute('data-fill', 'solid');
    expect(screen.getByTestId('match-box-m2-home')).toHaveTextContent('1');
    const gast = screen.getByTestId('match-box-m2-away');
    expect(gast).toHaveAttribute('data-fill', 'vest');
    expect(gast).toHaveAttribute('data-color', GELB);
    expect(gast).toHaveAttribute('data-stripes', ROT);
    expect(gast.querySelectorAll('[data-teil]')).toHaveLength(3);
    expect(screen.getByTestId('match-box-m2-away-bib')).toBeInTheDocument();
    expect(screen.queryByTestId('match-box-m2-home-bib')).toBeNull();
    expect(gast.getAttribute('aria-label')).toContain('Leibchen');
  });

  it('@ZM-158 der Kasten bleibt die Tippfläche der Torzahl (≥ 44 px hoch, im Knopf) und die Zahl bleibt lesbar', () => {
    laeuft({ home: rot, away: weste });
    const knopf = screen.getByTestId('match-goals-m2-home');
    expect(knopf).toContainElement(screen.getByTestId('match-box-m2-home'));
    expect(knopf).toHaveTextContent('1');
    expect(screen.getByTestId('match-box-m2-away-digits')).toHaveTextContent('0');
  });

  it('@ZM-158 @ZM-161 „Leibchen“ ist für Bildschirmleser hörbar: der zugängliche Name der Torzahl nennt die Mannschaft mit Leibchen', () => {
    laeuft({ home: rot, away: weste });
    expect(screen.getByRole('button', { name: /SV Süd in Leibchen/ })).toBe(screen.getByTestId('match-goals-m2-home'));
  });

  it('@ZM-158 Gegenbeispiel: ohne Leibchen sagt der zugängliche Name nichts von Leibchen', () => {
    laeuft({ home: rot, away: { fill: { kind: 'solid', color: BLAU }, bib: false } });
    expect(screen.queryByRole('button', { name: /Leibchen/ })).toBeNull();
  });

  it('@ZM-158 Gegenbeispiel Gruppenspiel: ein beendetes Gruppenspiel zeigt die Zahl wie bisher (der Kasten gehört zu laufendem und nächstem Spiel, im Finale auch beendet)', () => {
    render(<MatchCard matchId="g1" homeTeam={NORD} awayTeam={SUED} status="finished" result={{ ...RESULT, winner: 'a' }} />);
    expect(screen.queryByTestId('match-box-g1-home')).toBeNull();
    expect(screen.getByTestId('match-goals-g1-home')).toHaveTextContent('1');
  });

  it('@ZM-158 Gegenbeispiel: ohne Kästen (Spielliste) steht die Zahl wie bisher, ohne Kasten, Form und Zeichen', () => {
    laeuft(undefined);
    expect(screen.queryByTestId('match-box-m2-home')).toBeNull();
    expect(screen.getByTestId('match-goals-m2-home')).toHaveTextContent('1');
    expect(document.querySelectorAll('[data-teil]')).toHaveLength(0);
  });

  it('@ZM-161 Gegenbeispiel: kein Leibchen → kein Zeichen, keine Form (beide Kästen einfarbig)', () => {
    laeuft({ home: rot, away: { fill: { kind: 'solid', color: BLAU }, bib: false } });
    expect(document.querySelectorAll('[data-teil]')).toHaveLength(0);
    expect(screen.queryByTestId('match-box-m2-away-bib')).toBeNull();
  });
});

describe('@ZM-158 @ZM-195 Als Nächstes: Kästen mit „0“ statt Strich', () => {
  it('@ZM-195 geplantes Spiel mit Kästen: „0“ in Trikot- bzw. Ausweichfarbe, kein „–“', () => {
    render(<MatchCard matchId="m2" homeTeam={NORD} awayTeam={SUED} status="scheduled" result={null} kasten={{ home: rot, away: { fill: { kind: 'solid', color: BLAU }, bib: false } }} />);
    expect(screen.getByTestId('match-box-m2-home-digits')).toHaveTextContent('0');
    expect(screen.getByTestId('match-box-m2-away-digits')).toHaveTextContent('0');
    expect(screen.getByTestId('match-box-m2-away')).toHaveAttribute('data-color', BLAU);
    expect(document.body.textContent).not.toContain('–');
  });

  it('@ZM-158 Gegenbeispiel: geplantes Spiel ohne Kästen zeigt weiter „–“', () => {
    render(<MatchCard matchId="m9" homeTeam={NORD} awayTeam={SUED} status="scheduled" result={null} />);
    expect(screen.getByTestId('match-goals-m9-home')).toHaveTextContent('–');
    expect(screen.queryByTestId('match-box-m9-home')).toBeNull();
  });
});

describe('@ZM-158 @ZM-156 beendetes Finale am Handy: kleiner Kasten mit Ring, Pokal und fettem Sieger', () => {
  const FINALE = { id: 'finale', matchNumber: 15, time: '15:50', field: 1, homeTeam: 'FC Nord', awayTeam: 'SG Mitte' } as ScheduledMatch;
  const ERGEBNIS = (a: number, b: number, extra: Partial<ResultFigures> = {}): ResultFigures => ({ goalsA: a, goalsB: b, penaltyA: undefined, penaltyB: undefined, decision: null, winner: a > b ? 'a' : 'b', ...extra });
  const kaesten: MatchView['boxes'] = { home: rot, away: weste };

  const finale = (result: ResultFigures, over: { kasten?: MatchView['boxes']; finished?: boolean } = {}) =>
    render(
      <FinalStageMobileCard
        match={FINALE} label="Finale" homeName="FC Nord" awayName="SG Mitte" homePending={false} awayPending={false} result={result}
        isRunning={false} isFinished={over.finished ?? true} canEditScore={false} showReferees={false} showFields={false} editingSchedule={false}
        displayedRef={undefined} displayedField={undefined} hasPendingRef={false} hasPendingField={false} refereeOptions={[]} fieldOptions={[]}
        kasten={over.kasten === undefined && 'kasten' in over ? undefined : (over.kasten ?? kaesten)}
      />,
    );

  it('@ZM-158 2:1 für FC Nord nach regulärer Zeit: FC Nord rot mit Ring und Pokal, fett; SG Mitte als Weste mit Zeichen oben links, gedämpft, ohne Ring', () => {
    finale(ERGEBNIS(2, 1));
    const nord = screen.getByTestId('final-box-finale-home');
    expect(nord).toHaveAttribute('data-outcome', 'winner');
    expect(nord.style.outlineStyle).toBe('solid');
    expect(screen.getByTestId('final-box-finale-home-cup')).toBeInTheDocument();
    expect(screen.getByTestId('final-name-finale-home')).toHaveAttribute('data-winner', 'true');
    const mitte = screen.getByTestId('final-box-finale-away');
    expect(mitte).toHaveAttribute('data-outcome', 'loser');
    expect(mitte).toHaveAttribute('data-fill', 'vest');
    expect(mitte.querySelectorAll('[data-teil]')).toHaveLength(3);
    expect(screen.getByTestId('final-box-finale-away-bib')).toBeInTheDocument();
    expect(screen.queryByTestId('final-box-finale-away-cup')).toBeNull();
    expect(mitte.style.outlineStyle).toBe('');
    expect(screen.queryByTestId('final-penalty-finale-home')).toBeNull(); // kein Strafstoßergebnis
  });

  it('@ZM-158 2:2, Strafstoßschießen 4:3 für FC Nord: das Strafstoßergebnis steht klein neben dem Kasten („2 (4)“ und „2 (3)“)', () => {
    finale(ERGEBNIS(2, 2, { penaltyA: 4, penaltyB: 3, decision: 'penalty', winner: 'a' }));
    expect(screen.getByTestId('final-penalty-finale-home')).toHaveTextContent('(4)');
    expect(screen.getByTestId('final-penalty-finale-away')).toHaveTextContent('(3)');
    expect(screen.getByTestId('final-box-finale-home')).toHaveAttribute('data-outcome', 'winner');
  });

  it('@ZM-158 3:2 nach Verlängerung: der Hinweis „n. V.“ steht beim beendeten Finale, ohne Strafstoßergebnis', () => {
    finale(ERGEBNIS(3, 2, { decision: 'overtime' }));
    expect(screen.getByTestId('final-decision-finale')).toBeInTheDocument();
    expect(screen.queryByTestId('final-penalty-finale-home')).toBeNull();
  });

  it('@ZM-158 der zugängliche Name nennt Sieger/Pokal und Leibchen', () => {
    finale(ERGEBNIS(2, 1));
    expect(screen.getByRole('img', { name: /FC Nord: 2.*Pokal/ })).toBe(screen.getByTestId('final-box-finale-home'));
    expect(screen.getByRole('img', { name: /SG Mitte: 1.*Leibchen/ })).toBe(screen.getByTestId('final-box-finale-away'));
  });

  it('@ZM-158 Gegenbeispiel: ein laufendes Finale hat Kästen ohne Ring und ohne Pokal', () => {
    finale({ ...ERGEBNIS(1, 0), winner: null }, { finished: false });
    expect(screen.getByTestId('final-box-finale-home')).not.toHaveAttribute('data-outcome');
    expect(screen.queryByTestId('final-box-finale-home-cup')).toBeNull();
  });

  it('@ZM-158 Gegenbeispiel: ohne Kästen (Kindermodus, Verwaltung) steht die Zahl wie bisher', () => {
    finale(ERGEBNIS(2, 1), { kasten: undefined });
    expect(screen.queryByTestId('final-box-finale-home')).toBeNull();
    expect(screen.getByTestId('final-goals-finale-home')).toHaveTextContent('2');
  });
});

describe('@ZM-158 @ZM-156 Finalrunde der Zuschauer-Seite: die Ansicht reicht die Kästen an die Karte des beendeten Finales weiter', () => {
  const FINALE_ID = testUuid(201);
  const ZWEI = testUuid(1);
  const DREI = testUuid(2);
  const start = new Date('2026-11-14T15:50:00');
  const geplant: ScheduledMatch = {
    id: FINALE_ID, matchNumber: 15, time: '15:50', field: 1, homeTeam: 'ALT', awayTeam: 'ALT', originalTeamA: ZWEI, originalTeamB: DREI,
    slotA: teamSlot(ZWEI), slotB: teamSlot(DREI), label: 'Finale', phase: 'final', finalType: 'final', isFinal: true, startTime: start, endTime: start, duration: 10,
  };

  function zeige(status: 'finished' | 'scheduled') {
    const teams = [{ id: ZWEI, name: 'FC Nord', colors: { primary: ROT } }, { id: DREI, name: 'SG Mitte', colors: { primary: BLAU } }];
    const match = {
      id: FINALE_ID, matchNumber: 15, round: 9, field: 1, phase: 'final' as const, isFinal: true, finalType: 'final' as const, label: 'Finale',
      slotA: teamSlot(ZWEI), slotB: teamSlot(DREI), matchStatus: status, scheduledTime: start,
      ...(status === 'finished' ? { scoreA: 2, scoreB: 1, decidedBy: 'regular' as const } : {}),
      kit: { a: ROT, b: GELB, bibSide: 'b' as const },
    };
    const turnier = createMockTournament({ id: 't', teams, matches: [match], numberOfFields: 1, date: '2026-11-14', isPublic: true, shareCode: 'X', hideScoresForPublic: false });
    return render(<FinalStageSchedule matches={[geplant]} tournament={{ teams, view: buildMonitorView(turnier) }} />);
  }

  it('@ZM-158 beendet: Sieger-Kasten mit Ring und Pokal, Verlierer als Weste mit Zeichen', () => {
    zeige('finished');
    expect(screen.getByTestId(`final-box-${FINALE_ID}-home`)).toHaveAttribute('data-outcome', 'winner');
    expect(screen.getByTestId(`final-box-${FINALE_ID}-home-cup`)).toBeInTheDocument();
    expect(screen.getByTestId(`final-box-${FINALE_ID}-away`)).toHaveAttribute('data-fill', 'vest');
    expect(screen.getByTestId(`final-box-${FINALE_ID}-away-bib`)).toBeInTheDocument();
  });

  it('@ZM-158 Gegenbeispiel: ein noch nicht angepfiffenes Finale zeigt die Zahl wie bisher, ohne Kasten', () => {
    zeige('scheduled');
    expect(screen.queryByTestId(`final-box-${FINALE_ID}-home`)).toBeNull();
  });
});
