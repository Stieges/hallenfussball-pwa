/**
 * Monitor-Folie „Alle Tabellen“: Gruppen kommen aus der tatsächlichen Zuordnung der Teams, nicht aus `config.groups`
 * (C-MONITOR-ALLE-TABELLEN-OHNE-ZEILEN, C-MONITOR-ALLE-TABELLEN-LEERE-GRUPPE). Szenarien @ZM-071, @ZM-177.
 * Prüfregel @ZM-180: Das Turnier kommt über die echte Antwortform von `display_tournament` (Positivliste), nicht selbstgebaut.
 */
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { parsePublicPayload } from '../../../core/repositories/publicPayload';
import { serverAntwort, turnierNordSued, mitStrafstossNord } from '../../../core/repositories/__tests__/publicEntscheidungKit';
import { createDefaultGroups } from '../../../utils/displayNames';
import { standingsSections, monitorPageCount } from '../slideContent';
import { buildMonitorView } from '../monitorView';
import { AllStandingsSlide } from '../slides/AllStandingsSlide';
import type { Tournament } from '../../../types/tournament';

function viaServer(t: Tournament): Tournament {
  const p = parsePublicPayload(serverAntwort(t, { art: 'gespeichert' }, 'screen'));
  if (p.kind !== 'full') { throw new Error(p.kind); }
  return p.tournament;
}

function seite(t: Tournament, page: number): string {
  const { container, unmount } = render(<AllStandingsSlide tournament={t} view={buildMonitorView(t)} theme="dark" style={{}} page={page} />);
  const text = container.textContent ?? '';
  unmount();
  return text;
}

describe('Monitor „Alle Tabellen“ – Gruppen aus der Zuordnung der Teams', () => {
  it('@ZM-071 @ZM-177 Jeder gegen jeden mit Standardgruppen A, B im Turnier: eine Gesamttabelle mit allen Teams, keine „Gruppe B“', () => {
    const lokal = { ...mitStrafstossNord(turnierNordSued()), groupSystem: 'roundRobin' as const, numberOfGroups: 2, groups: createDefaultGroups(2) };
    const t = viaServer(lokal);
    expect(t.groups?.length).toBe(2);
    const view = buildMonitorView(t);
    expect(standingsSections(t, view)).toEqual([{ kind: 'overall' }]);
    expect(monitorPageCount({ type: 'all-standings', config: {} } as never, t, view)).toBe(1);
    const text = seite(t, 0);
    for (const team of t.teams) { expect(text, team.name).toContain(team.name); }
    expect(text).not.toMatch(/Gruppe\s*[AB]/);
  });

  it('Gegenbeispiel: echtes Turnier mit zwei Gruppen zeigt weiter Gruppe A und Gruppe B mit ihren Teams', () => {
    const basis = turnierNordSued();
    const teams = basis.teams.map((team, i) => ({ ...team, group: i % 2 === 0 ? 'A' : 'B' }));
    const t = viaServer({ ...basis, teams, groupSystem: 'groupsAndFinals', numberOfGroups: 2, groups: createDefaultGroups(2) });
    const view = buildMonitorView(t);
    expect(standingsSections(t, view).filter(s => s.kind === 'group')).toEqual([
      { kind: 'group', groupId: 'A' }, { kind: 'group', groupId: 'B' },
    ]);
    const a = seite(t, 0);
    const b = seite(t, 1);
    for (const team of t.teams.filter(x => x.group === 'A')) { expect(a, team.name).toContain(team.name); }
    for (const team of t.teams.filter(x => x.group === 'B')) { expect(b, team.name).toContain(team.name); }
  });
});
