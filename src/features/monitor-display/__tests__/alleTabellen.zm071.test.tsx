/**
 * Monitor-Folie „Alle Tabellen“: Gruppen kommen aus der tatsächlichen Zuordnung der Teams, nicht aus `config.groups`
 * (C-MONITOR-ALLE-TABELLEN-OHNE-ZEILEN, C-MONITOR-ALLE-TABELLEN-LEERE-GRUPPE). Szenarien @ZM-181 (Gesamttabelle bei „Jeder gegen jeden“), @ZM-071, @ZM-177.
 * Prüfregel @ZM-180: Das Turnier kommt über die echte Antwortform von `display_tournament` (Positivliste), nicht selbstgebaut.
 */
import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { parsePublicPayload } from '../../../core/repositories/publicPayload';
import { serverAntwort, turnierNordSued, mitStrafstossNord } from '../../../core/repositories/__tests__/publicEntscheidungKit';
import { createDefaultGroups } from '../../../utils/displayNames';
import { standingsSections, monitorPageCount } from '../slideContent';
import { buildMonitorView } from '../monitorView';
import { AllStandingsSlide } from '../slides/AllStandingsSlide';
import { StandingsSlide } from '../slides/StandingsSlide';
import type { Tournament } from '../../../types/tournament';

vi.unmock('i18next'); vi.unmock('react-i18next'); // echte DE-Texte, siehe src/test/realDeI18n.ts
await (await import('../../../test/realDeI18n')).initRealDeI18n();

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

/** Zeile eines Teams: Siege, Unentschieden, Niederlagen und der gesamte Zeilentext (Punkte am Ende). */
function zeile(t: Tournament, name: string) {
  const { container, unmount } = render(<AllStandingsSlide tournament={t} view={buildMonitorView(t)} theme="dark" style={{}} page={0} />);
  const row = [...container.querySelectorAll('[data-testid="standings-row"]')].find(r => r.textContent?.includes(name));
  const wert = (id: string) => row?.querySelector(`[data-testid="${id}"]`)?.textContent;
  const erg = { won: wert('standings-won'), drawn: wert('standings-drawn'), lost: wert('standings-lost'), text: row?.textContent ?? '' };
  unmount();
  return erg;
}

describe('Monitor „Alle Tabellen“ – Gruppen aus der Zuordnung der Teams', () => {
  it('@ZM-181 @ZM-071 @ZM-177 Jeder gegen jeden mit Standardgruppen A, B im Turnier: eine Gesamttabelle mit allen Teams, keine „Gruppe B“', () => {
    const lokal = { ...mitStrafstossNord(turnierNordSued()), groupSystem: 'roundRobin' as const, numberOfGroups: 2, groups: createDefaultGroups(2) };
    const t = viaServer(lokal);
    // Der Mapper liest bei Jeder gegen jeden keine gespeicherten Gruppen mehr (@ZM-181, PR „Kleines Fehlerpaket“); die Folie rechnet trotzdem richtig
    expect(t.groups).toBeUndefined();
    const view = buildMonitorView(t);
    expect(standingsSections(t, view)).toEqual([{ kind: 'overall' }]);
    expect(monitorPageCount({ type: 'all-standings', config: {} } as never, t, view)).toBe(1);
    const text = seite(t, 0);
    for (const team of t.teams) { expect(text, team.name).toContain(team.name); }
    expect(text).not.toMatch(/Gruppe\s*[AB]/);
    expect(text).toContain('Gesamttabelle');
    // Ergebnisse der Spiele (Server-Antwort): FC Nord 4 Siege, 1 Remis, 0 Niederlagen, 13 Punkte; DJK Berg 5 Niederlagen, 0 Punkte
    const nord = zeile(t, 'FC Nord');
    expect([nord.won, nord.drawn, nord.lost]).toEqual(['4', '1', '0']);
    expect(nord.text).toMatch(/13$/);
    const berg = zeile(t, 'DJK Berg');
    expect([berg.won, berg.drawn, berg.lost]).toEqual(['0', '0', '5']);
    expect(berg.text).toMatch(/0$/);
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

  it('Gegenbeispiel: Konfig-Gruppen A, B, C, Teams nur in A und B – keine leere Gruppe C (C-MONITOR-ALLE-TABELLEN-LEERE-GRUPPE)', () => {
    const basis = turnierNordSued();
    const teams = basis.teams.map((team, i) => ({ ...team, group: i % 2 === 0 ? 'A' : 'B' }));
    const t = viaServer({ ...basis, teams, groupSystem: 'groupsAndFinals', numberOfGroups: 3, groups: createDefaultGroups(3) });
    expect(t.groups?.length).toBe(3);
    expect(standingsSections(t, buildMonitorView(t)).filter(s => s.kind === 'group')).toEqual([
      { kind: 'group', groupId: 'A' }, { kind: 'group', groupId: 'B' },
    ]);
  });

  it('Einzelfolie „Tabelle“ mit der Gruppen-ID „default“, die der Monitor-Editor bei „Jeder gegen jeden“ anbietet: alle Teams (nicht 0 Zeilen)', () => {
    const lokal = { ...mitStrafstossNord(turnierNordSued()), groupSystem: 'roundRobin' as const, numberOfGroups: 2, groups: createDefaultGroups(2) };
    const t = viaServer(lokal);
    const folie = { id: 's', type: 'standings', config: { groupId: 'default' }, duration: null, order: 0 } as never;
    const { container, unmount } = render(<StandingsSlide slide={folie} tournament={t} theme="dark" style={{}} />);
    expect(container.querySelectorAll('[data-testid="standings-row"]')).toHaveLength(t.teams.length);
    unmount();
  });
});
