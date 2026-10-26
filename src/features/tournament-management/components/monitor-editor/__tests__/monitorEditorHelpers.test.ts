/**
 * buildEditorGroups (M1a): roundRobin ist ein Turnier mit einer Gruppe „Alle Teams“,
 * zwei Gruppen ohne explizite Liste ergeben die Einträge A und B.
 */
import { describe, it, expect, vi } from 'vitest';
import de from '../../../../../i18n/locales/de/tournament.json';
import { createMockTournament } from '../../../../../test/factories';
import { buildEditorGroups } from '../monitorEditorHelpers';

vi.unmock('i18next'); vi.unmock('react-i18next');
const { initRealDeI18n } = await import('../../../../../test/realDeI18n');
await initRealDeI18n();
const { default: i18next } = await import('i18next');
const t = i18next.getFixedT(null, 'tournament');

describe('monitorEditorHelpers – buildEditorGroups', () => {
  it('roundRobin: eine Gruppe „Alle Teams“', () => {
    const groups = buildEditorGroups(createMockTournament({ groupSystem: 'roundRobin' }), t);
    expect(groups).toEqual([{ id: 'default', customName: de.monitorEditor.allTeams }]);
  });

  it('zwei Gruppen ohne explizite Liste: A und B', () => {
    const groups = buildEditorGroups(
      createMockTournament({ groupSystem: 'groupsAndFinals', groups: [], numberOfGroups: 2 }),
      t
    );
    expect(groups.map(g => g.id)).toEqual(['A', 'B']);
    expect(groups.map(g => g.customName)).toEqual([
      de.monitorEditor.groupLabel.replace('{{letter}}', 'A'),
      de.monitorEditor.groupLabel.replace('{{letter}}', 'B'),
    ]);
  });
});
