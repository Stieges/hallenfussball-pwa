/**
 * @ZM-177 @ZM-181 Einzelfolie „Tabelle“ bei „Jeder gegen jeden“: die Überschrift heißt „Gesamttabelle“, nicht „Gruppe“
 * (Befund C-MONITOR-TABELLE-UEBERSCHRIFT-GRUPPE). Das Turnier kommt über die echte Antwortform von `display_tournament` (@ZM-180).
 */
import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { parsePublicPayload } from '../../../core/repositories/publicPayload';
import { serverAntwort, turnierNordSued } from '../../../core/repositories/__tests__/publicEntscheidungKit';
import { createDefaultGroups } from '../../../utils/displayNames';
import { StandingsSlide } from '../slides/StandingsSlide';
import type { MonitorSlide } from '../../../types/monitor';
import type { Tournament } from '../../../types/tournament';

vi.unmock('i18next'); vi.unmock('react-i18next');
await (await import('../../../test/realDeI18n')).initRealDeI18n();

function viaServer(t: Tournament): Tournament {
  const p = parsePublicPayload(serverAntwort(t, { art: 'gespeichert' }, 'screen'));
  if (p.kind !== 'full') { throw new Error(p.kind); }
  return p.tournament;
}

const folie = (groupId: string): MonitorSlide => ({ id: 's', type: 'standings', config: { groupId }, duration: null, order: 0 });

function ueberschrift(t: Tournament, groupId: string): string {
  const { container, unmount } = render(<StandingsSlide slide={folie(groupId)} tournament={t} theme="dark" style={{}} />);
  const text = container.querySelector('h1, h2, h3')?.textContent ?? container.firstElementChild?.firstElementChild?.textContent ?? '';
  unmount();
  return text;
}

describe('@ZM-177 @ZM-181 Einzelfolie „Tabelle“: Überschrift', () => {
  it('Jeder gegen jeden (Editor-ID „default“, Standardgruppen A und B gespeichert): „Gesamttabelle“, nirgends „Gruppe“', () => {
    const t = viaServer({ ...turnierNordSued(), groupSystem: 'roundRobin', numberOfGroups: 2, groups: createDefaultGroups(2) });
    expect(ueberschrift(t, 'default')).toBe('Gesamttabelle');
  });

  it('Gegenbeispiel: Gruppen + Finalrunde, Folie für Gruppe A: Überschrift bleibt „Gruppe A“', () => {
    const basis = turnierNordSued();
    const teams = basis.teams.map((team, i) => ({ ...team, group: i % 2 === 0 ? 'A' : 'B' }));
    const t = viaServer({ ...basis, teams, groupSystem: 'groupsAndFinals', numberOfGroups: 2, groups: createDefaultGroups(2) });
    expect(ueberschrift(t, 'A')).toBe('Gruppe A');
  });
});
