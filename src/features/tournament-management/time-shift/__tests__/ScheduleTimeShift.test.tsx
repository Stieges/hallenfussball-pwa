/**
 * B-26 Bedienung „Zeiten verschieben“ im Spielplan-Reiter (Record `2026-10-02_zeitplan-rueckt-nach.md`).
 * Beispiel wie im Mockup: ein Feld, Spiel 1 um 10:00, alle 12 Minuten (10 Spiel + 2 Pause), 8 Spiele.
 * Ab dem ersten Anpfiff: Spiel 1–6 beendet, Spiel 7 läuft, es ist 11:15.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { createInstance } from 'i18next';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import deTournament from '../../../../i18n/locales/de/tournament.json';
import { createMockTeams, createMockTournament } from '../../../../test/factories';
import { testTeamSlot } from '../../../../test/matchSlotFixtures';
import { buildTournamentView } from '../../../../core/view';
import { MatchMenuSlot, OriginalTimeNote } from '../../../../components/schedule/MatchTimeShiftSlots';
import type { Match, MatchStatus, Tournament } from '../../../../types/tournament';
import { ScheduleTimeShift } from '../ScheduleTimeShift';

vi.unmock('i18next');
vi.unmock('react-i18next');
vi.mock('../../../match-engine/useMatchEngineContext', () => ({ useMatchEngineContextOptional: () => null }));
vi.mock('../../../../components/dialogs/PDFExportDialog', () => ({ PDFExportDialog: () => null }));

const DAY = '2026-11-28';
const at = (hhmm: string) => new Date(`${DAY}T${hhmm}:00`);
const hhmm = (d: Date | undefined) => (d === undefined ? undefined : `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);

function nikolaus(stati: MatchStatus[]): Tournament {
  const teams = createMockTeams(6, 1);
  const matches: Match[] = stati.map((matchStatus, i) => {
    const minutes = 600 + i * 12;
    return {
      id: `m${i + 1}`, round: i + 1, field: 1, matchNumber: i + 1, group: 'A', phase: 'groupStage',
      slotA: testTeamSlot(teams[i % 6].id), slotB: testTeamSlot(teams[(i + 1) % 6].id),
      scheduledTime: at(`${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`),
      matchStatus,
      ...(matchStatus === 'finished' ? { scoreA: 1, scoreB: 0 } : {}),
    };
  });
  return createMockTournament({ date: DAY, teams, matches, numberOfFields: 1, groupPhaseGameDuration: 10, groupPhaseBreakDuration: 2, status: 'published' });
}

const LIVE: MatchStatus[] = ['finished', 'finished', 'finished', 'finished', 'finished', 'finished', 'running', 'scheduled'];
const BEFORE: MatchStatus[] = Array.from({ length: 8 }, () => 'scheduled');

function renderShift(tournament: Tournament) {
  const i18n = createInstance();
  void i18n.use(initReactI18next).init({ lng: 'de', resources: { de: { tournament: deTournament } }, interpolation: { escapeValue: false } });
  const onTournamentUpdate = vi.fn();
  const showSuccess = vi.fn();
  const Harness = ({ t }: { t: Tournament }) => {
    const view = buildTournamentView({ ...t }, { audience: 'organizer', medium: 'app', locale: 'de' });
    return (
      <ScheduleTimeShift tournament={t} schedule={{} as never} standings={[]} view={view} onTournamentUpdate={onTournamentUpdate} showSuccess={showSuccess} enabled canCreateNotice>
        <ul>
          {t.matches.map((m) => (
            <li key={m.id} data-testid={`row-${m.id}`}>{hhmm(m.scheduledTime)}<OriginalTimeNote matchId={m.id} /><MatchMenuSlot matchId={m.id} /></li>
          ))}
        </ul>
      </ScheduleTimeShift>
    );
  };
  const utils = render(<I18nextProvider i18n={i18n}><MemoryRouter><Harness t={tournament} /></MemoryRouter></I18nextProvider>);
  const rerenderWith = (t: Tournament) => utils.rerender(<I18nextProvider i18n={i18n}><MemoryRouter><Harness t={t} /></MemoryRouter></I18nextProvider>);
  return { onTournamentUpdate, showSuccess, rerenderWith };
}

const savedTimes = (fn: ReturnType<typeof vi.fn>) => (fn.mock.calls.at(-1)?.[0] as Tournament).matches.map((m) => hhmm(m.scheduledTime));

describe('B-26 Zeiten verschieben im Spielplan', () => {
  beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); });
  afterEach(() => { vi.useRealTimers(); });

  it('@ZP-094 der Spielplan bietet „Zeiten verschieben“ an', () => {
    vi.setSystemTime(at('11:15'));
    renderShift(nikolaus(LIVE));
    expect(screen.getByTestId('schedule-shift-button')).toHaveTextContent('Zeiten verschieben');
  });

  it('@ZP-017/@ZP-018 ab dem ersten Anpfiff erst Vorschau; „Abbrechen“ ändert nichts', () => {
    vi.setSystemTime(at('11:15'));
    const { onTournamentUpdate } = renderShift(nikolaus(LIVE));
    fireEvent.click(screen.getByTestId('schedule-shift-button'));
    fireEvent.click(screen.getByTestId('time-shift-proceed'));
    const preview = screen.getByTestId('time-shift-preview');
    expect(preview).toHaveTextContent('1 Spiel verschiebt sich');
    expect(preview).toHaveTextContent('Noch nichts geändert');
    fireEvent.click(screen.getByTestId('time-shift-preview-cancel'));
    expect(onTournamentUpdate).not.toHaveBeenCalled();
  });

  it('@ZP-012/@ZP-016 bestätigt verschiebt das geplante Spiel, das laufende und die beendeten bleiben', () => {
    vi.setSystemTime(at('11:15'));
    const { onTournamentUpdate } = renderShift(nikolaus(LIVE));
    fireEvent.click(screen.getByTestId('schedule-shift-button'));
    fireEvent.change(screen.getByTestId('time-shift-from-time'), { target: { value: '11:00' } });
    expect(screen.getByTestId('time-shift-kept')).toHaveTextContent('Spiel 6 (beendet), Spiel 7 (läuft)');
    fireEvent.click(screen.getByTestId('time-shift-proceed'));
    fireEvent.click(screen.getByTestId('time-shift-confirm'));
    expect(savedTimes(onTournamentUpdate)).toEqual(['10:00', '10:12', '10:24', '10:36', '10:48', '11:00', '11:12', '11:34']);
    expect(onTournamentUpdate.mock.calls[0][1]).toBe(false);
  });

  it('@ZP-019 vor dem ersten Anpfiff gilt „Übernehmen“ sofort, ohne Vorschau', () => {
    vi.setSystemTime(at('08:30'));
    const { onTournamentUpdate } = renderShift(nikolaus(BEFORE));
    fireEvent.click(screen.getByTestId('schedule-shift-button'));
    expect(screen.getByTestId('time-shift-proceed')).toHaveTextContent('Übernehmen');
    fireEvent.click(screen.getByTestId('time-shift-proceed'));
    expect(screen.queryByTestId('time-shift-preview')).toBeNull();
    expect(savedTimes(onTournamentUpdate)[0]).toBe('10:10');
  });

  it('@ZP-089 vor dem ersten Anpfiff kurzfristig vorziehen: Zusammenfassung und Warnung ohne Sperre', () => {
    vi.setSystemTime(at('09:40'));
    renderShift(nikolaus(BEFORE));
    fireEvent.click(screen.getByTestId('schedule-shift-button'));
    fireEvent.click(screen.getByTestId('time-shift-direction-earlier'));
    fireEvent.click(screen.getByTestId('time-shift-quick-15'));
    expect(screen.getByTestId('time-shift-summary')).toHaveTextContent('Spiel 1 beginnt um 09:45 statt 10:00 · 8 Spiele rücken 15 Minuten vor · neues Ende 11:19');
    expect(screen.getByTestId('time-shift-warning')).toHaveTextContent('Spiel 1 beginnt in 5 Minuten – Teams wissen es evtl. noch nicht.');
    expect(screen.getByTestId('time-shift-proceed')).toBeEnabled();
  });

  it('@ZP-057 Vorziehen in die Vergangenheit nimmt die App nicht an', () => {
    vi.setSystemTime(at('11:15'));
    const { onTournamentUpdate } = renderShift(nikolaus(LIVE));
    fireEvent.click(screen.getByTestId('schedule-shift-button'));
    fireEvent.click(screen.getByTestId('time-shift-direction-earlier'));
    fireEvent.click(screen.getByTestId('time-shift-quick-10'));
    expect(screen.getByTestId('time-shift-error')).toHaveTextContent('Spiel 8 würde auf 11:14 rücken. Jetzt ist es 11:15.');
    expect(screen.getByTestId('time-shift-proceed')).toBeDisabled();
    expect(onTournamentUpdate).not.toHaveBeenCalled();
  });

  it('@ZP-098 „Ab hier verschieben“ am geplanten Spiel öffnet den Dialog mit „ab Spiel 8“', () => {
    vi.setSystemTime(at('11:15'));
    renderShift(nikolaus(LIVE));
    fireEvent.click(within(screen.getByTestId('row-m8')).getByTestId('match-menu-m8'));
    fireEvent.click(screen.getByTestId('ab-hier-verschieben'));
    expect(screen.getByTestId('time-shift-from-match')).toHaveValue('m8');
    expect(screen.getByTestId('time-shift-dialog')).toHaveTextContent('Aus der Spielliste übernommen: ab Spiel 8.');
  });

  it('@ZP-098 am laufenden Spiel ist „Ab hier verschieben“ nicht wählbar, mit Grund', () => {
    vi.setSystemTime(at('11:15'));
    renderShift(nikolaus(LIVE));
    fireEvent.click(screen.getByTestId('match-menu-m7'));
    const item = screen.getByTestId('ab-hier-verschieben');
    expect(item).toHaveAttribute('aria-disabled', 'true');
    expect(item).toHaveTextContent('Nicht möglich');
    expect(screen.getByTestId('ab-hier-verschieben-grund')).toHaveTextContent('Spiel 7 läuft bereits.');
    fireEvent.click(item);
    expect(screen.queryByTestId('time-shift-dialog')).toBeNull();
  });

  it('@ZP-036/@ZP-089 nach dem Verschieben Streifen mit „Rückgängig …“; Wiederherstellen setzt die Zeiten zurück', () => {
    vi.setSystemTime(at('11:15'));
    const { onTournamentUpdate, rerenderWith } = renderShift(nikolaus(LIVE));
    fireEvent.click(screen.getByTestId('schedule-shift-button'));
    fireEvent.click(screen.getByTestId('time-shift-proceed'));
    fireEvent.click(screen.getByTestId('time-shift-confirm'));
    const saved = onTournamentUpdate.mock.calls[0][0] as Tournament;
    rerenderWith(saved);
    expect(screen.getByTestId('time-shift-strip')).toHaveTextContent('Zeiten um 10 Min. verschoben · Ende 11:44');
    expect(screen.getByTestId('time-shift-strip')).toHaveTextContent('Ausdrucke sind veraltet');
    expect(screen.getByTestId('match-original-m8')).toHaveTextContent('ursprünglich 11:24');
    fireEvent.click(screen.getByTestId('zeiten-rueckgaengig'));
    expect(screen.getByTestId('time-shift-restore-preview')).toHaveTextContent('1 Spiel verschiebt sich');
    fireEvent.click(screen.getByTestId('time-shift-confirm'));
    const restored = onTournamentUpdate.mock.calls[1][0] as Tournament;
    expect(restored.matches.map((m) => hhmm(m.scheduledTime))).toEqual(nikolaus(LIVE).matches.map((m) => hhmm(m.scheduledTime)));
    expect(restored.matches.every((m) => m.originalStart === undefined)).toBe(true);
  });
});
