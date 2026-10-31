/**
 * @ZM-185 Zeilen der Monitor-Folien: Logo mittig über dem Namen (Spielplan eines Felds, 4 Spiele je Seite) bzw. gespiegelt
 * (Nächste Spiele: Heimlogo hinter dem Heimnamen, Gastlogo vor dem Gastnamen). Pixelgenaue Lage: `tests/e2e/flows/zm185-zeilen.spec.ts`.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
vi.unmock('i18next'); vi.unmock('react-i18next');
import { initRealDeI18n } from '../../../test/realDeI18n';
await initRealDeI18n();

import { displayList } from '../../../design-tokens';
import { ScheduleFieldSlide } from '../slides/ScheduleFieldSlide';
import { NextMatchesSlide } from '../slides/NextMatchesSlide';
import { monitorPageCount, pageOf } from '../slideContent';
import { buildMonitorView } from '../monitorView';
import { buildTournament, slide } from './monitorFixture';
import { withView } from './monitorViewHelper';
import type { Match } from '../../../types/tournament';

/** 15 Spiele auf Feld 1 (Nikolaus-Turnier), alle noch offen */
function fuenfzehn(): Match[] {
  const basis = buildTournament().matches[0];
  return Array.from({ length: 15 }, (_, i) => ({
    ...basis, id: `n-${i + 1}`, number: i + 1, field: 1, fieldNumber: 1, matchStatus: 'scheduled' as const, status: 'SCHEDULED' as const,
    scheduledTime: new Date(`2026-03-14T${String(10 + Math.floor(i / 6)).padStart(2, '0')}:${String((i % 6) * 10).padStart(2, '0')}:00.000Z`),
    scoreA: undefined, scoreB: undefined, kit: undefined, phase: 'groupStage' as const,
  }));
}
const nikolaus = () => buildTournament({ matches: fuenfzehn(), finalsConfig: { preset: 'none' } });
const folie = slide('schedule-field', { fieldId: 'field-1' });

const folgt = (a: HTMLElement, b: HTMLElement) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;

describe('@ZM-185 Spielplan eines Felds: 4 Spiele je Seite', () => {
  it('@ZM-185 Nikolaus mit 15 Spielen: „Seite 1 / 4“ bis „Seite 4 / 4“ (4, 4, 4 und 3 Zeilen)', () => {
    const t = nikolaus();
    expect(displayList.scheduleRowsPerPage).toBe(4);
    expect(monitorPageCount(folie, t, buildMonitorView(t))).toBe(4);
    const zeilen = Array.from({ length: 4 }, (_, seite) => {
      const { unmount } = render(<ScheduleFieldSlide slide={folie} {...withView(t)} theme="dark" style={{}} page={seite} />);
      const n = screen.getAllByTestId('monitor-match-row').length;
      expect(screen.getByText(`Seite ${seite + 1} / 4`)).toBeInTheDocument();
      unmount();
      return n;
    });
    expect(zeilen).toEqual([4, 4, 4, 3]);
  });

  it('@ZM-185 Gegenbeispiel: „Nächste Spiele“ bleibt bei 6 Zeilen je Seite (Seitenzahl unverändert)', () => {
    const t = nikolaus();
    const view = buildMonitorView(t);
    expect(monitorPageCount(slide('next-matches', { matchCount: 15 }), t, view)).toBe(3);
    expect(pageOf(Array.from({ length: 15 }, (_, i) => i), 0)).toHaveLength(6);
  });

  it('@ZM-185 das Logo steht über dem Namen: Avatar vor dem Namen im Dokument, Spalte statt Zeile', () => {
    const t = nikolaus();
    render(<ScheduleFieldSlide slide={folie} {...withView(t)} theme="dark" style={{}} page={0} />);
    const zeile = screen.getAllByTestId('monitor-match-row')[0];
    for (const seite of ['home', 'away'] as const) {
      const team = within(zeile).getByTestId(`monitor-match-team-${seite}`);
      const avatar = within(team).getByTestId(`monitor-match-team-${seite}-avatar`);
      expect(avatar.parentElement!.dataset.avatarPlacement).toBe('above');
      expect(avatar.parentElement!.style.flexDirection).toBe('column');
      expect(folgt(avatar, team.querySelector<HTMLElement>('[data-teamname]')!)).toBe(true);
    }
  });
});

describe('@ZM-185 Nächste Spiele: gespiegelt', () => {
  it('@ZM-185 Heimlogo hinter dem Heimnamen, Gastlogo vor dem Gastnamen, in jeder Zeile', () => {
    const t = nikolaus();
    render(<NextMatchesSlide slide={slide('next-matches', { matchCount: 15 })} {...withView(t)} theme="dark" style={{}} />);
    const zeilen = screen.getAllByTestId('monitor-match-row');
    expect(zeilen.length).toBeGreaterThan(3);
    for (const zeile of zeilen) {
      const heim = within(zeile).getByTestId('monitor-match-team-home');
      const gast = within(zeile).getByTestId('monitor-match-team-away');
      expect(folgt(heim.querySelector<HTMLElement>('[data-teamname]')!, within(heim).getByTestId('monitor-match-team-home-avatar')), 'Heim: Name, dann Logo').toBe(true);
      expect(folgt(within(gast).getByTestId('monitor-match-team-away-avatar'), gast.querySelector<HTMLElement>('[data-teamname]')!), 'Gast: Logo, dann Name').toBe(true);
      expect(heim.firstElementChild!.getAttribute('data-avatar-placement')).toBe('after');
      expect(gast.firstElementChild!.getAttribute('data-avatar-placement')).toBe('before');
    }
  });
});
