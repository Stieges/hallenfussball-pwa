/**
 * Auflage A4 (Review Entwurf-Fix): In der Finalrunden-Tabelle lässt sich im Bearbeiten-Modus nur ein geplantes Spiel per
 * Drag & Drop tauschen; laufende und beendete Spiele zeigen das Schloss, ohne Tausch-Anschluss (`onMatchSwap`) alle.
 * Kein eigenes Szenario (nah: @ZP-016 „Laufende und beendete Spiele werden nie verschoben“) – Lücke im Report gemeldet.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.unmock('i18next');
vi.unmock('react-i18next');
import { initRealDeI18n } from '../../../test/realDeI18n';
await initRealDeI18n();

import type { ScheduledMatch } from '../../../core/generators';
import { teamSlot } from '../../../core/models/matchSlot';
import { testUuid } from '../../../test/testIds';
import { FinalStageSchedule } from '../FinalStageSchedule';
import { matchOf, viewOf } from './scheduleViewFixture';

vi.mock('../../../hooks/useLiveMatches', () => ({ useLiveMatches: () => ({ liveMatches: new Map() }) }));

const teams = [1, 2, 3, 4, 5, 6].map((n) => ({ id: testUuid(n), name: `Team ${n}` }));
const GEPLANT = testUuid(201);
const LAEUFT = testUuid(202);
const BEENDET = testUuid(203);

function spiel(id: string, matchNumber: number, a: number, b: number): ScheduledMatch {
  const start = new Date('2026-11-14T14:20:00');
  return {
    id, matchNumber, time: '14:20', field: 1, homeTeam: '', awayTeam: '', originalTeamA: teams[a].id, originalTeamB: teams[b].id,
    slotA: teamSlot(teams[a].id), slotB: teamSlot(teams[b].id), label: `Spiel ${matchNumber}`, phase: 'semifinal', isFinal: true,
    startTime: start, endTime: start, duration: 10,
  };
}

const matches = [spiel(GEPLANT, 11, 0, 1), spiel(LAEUFT, 12, 2, 3), spiel(BEENDET, 13, 4, 5)];
const tournament = {
  teams,
  view: viewOf([
    matchOf(matches[0]),
    matchOf(matches[1], { matchStatus: 'running', scoreA: 1, scoreB: 0 }),
    matchOf(matches[2], { matchStatus: 'finished', scoreA: 2, scoreB: 1 }),
  ], teams),
};

/** Erste Zelle der Tabellenzeile von Spiel <nummer> (im Bearbeiten-Modus der Griff bzw. das Schloss). */
function griff(nummer: number): HTMLElement {
  // Der Griff trägt als Drag-Ziel role="button" (dnd-kit), daher über die Zellen-Elemente statt über Rollen
  const zellen = Array.from(document.querySelectorAll<HTMLTableRowElement>('.desktop-view tbody tr'))
    .map((row) => Array.from(row.querySelectorAll<HTMLElement>(':scope > td')))
    .find((cells) => cells[1]?.textContent?.startsWith(String(nummer)));
  if (!zellen) {
    throw new Error(`Zeile von Spiel ${nummer} fehlt`);
  }
  return zellen[0];
}

describe('Finalrunden-Tabelle, Bearbeiten-Modus: Drag & Drop nur für geplante Spiele', () => {
  it('geplantes Spiel 11 hat den Griff, laufendes Spiel 12 und beendetes Spiel 13 das Schloss', () => {
    render(<FinalStageSchedule matches={matches} tournament={tournament} editingSchedule onMatchSwap={vi.fn()} />);
    expect(griff(11).textContent).toBe('⋮⋮');
    expect(griff(11).getAttribute('aria-roledescription')).toBe('sortable');
    expect(griff(12).textContent).toBe('🔒');
    expect(griff(13).textContent).toBe('🔒');
    expect(griff(12).getAttribute('aria-roledescription')).toBeNull();
    expect(griff(13).getAttribute('aria-roledescription')).toBeNull();
  });

  it('Gegenbeispiel: ohne Tausch-Anschluss zeigt auch das geplante Spiel das Schloss', () => {
    render(<FinalStageSchedule matches={matches} tournament={tournament} editingSchedule />);
    expect(screen.queryByText('⋮⋮')).toBeNull();
    expect(griff(11).textContent).toBe('🔒');
  });
});
