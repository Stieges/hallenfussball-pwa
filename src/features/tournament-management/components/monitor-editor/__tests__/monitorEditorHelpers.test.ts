/**
 * buildEditorGroups (M1a): roundRobin ist ein Turnier mit einer Gruppe „Alle Teams“,
 * zwei Gruppen ohne explizite Liste ergeben die Einträge A und B.
 * getSlideDescription (M1a): die Rückfälle der Fallback-Ketten (leerer Name, leere
 * Überschrift, fehlender Feldbezug) zeigen die erwarteten Ersatztexte.
 */
import { describe, it, expect, vi } from 'vitest';
import de from '../../../../../i18n/locales/de/tournament.json';
import { createMockTournament } from '../../../../../test/factories';
import type { MonitorSlide } from '../../../../../types/monitor';
import { buildEditorGroups, getSlideDescription } from '../monitorEditorHelpers';

vi.unmock('i18next'); vi.unmock('react-i18next');
const { initRealDeI18n } = await import('../../../../../test/realDeI18n');
await initRealDeI18n();
const { default: i18next } = await import('i18next');
const t = i18next.getFixedT(null, 'tournament');

function folie(type: MonitorSlide['type'], config: MonitorSlide['config']): MonitorSlide {
  return { id: 's-1', type, config, duration: null, order: 0 };
}

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

describe('monitorEditorHelpers – buildEditorGroups nach tatsächlicher Team-Zuordnung (@ZM-181, @ZM-177)', () => {
  const teamsIn = (gruppen: string[]) => gruppen.map((group, i) => ({ id: `t${i}`, name: `Team ${i}`, ...(group === '' ? {} : { group }) }));

  it('gespeicherte Standardgruppen A, B, C ohne Teams in C: angeboten werden nur A und B, mit dem gespeicherten Namen', () => {
    const groups = buildEditorGroups(createMockTournament({
      groupSystem: 'groupsAndFinals', numberOfGroups: 3, groups: [{ id: 'A' }, { id: 'B', customName: 'Löwen' }, { id: 'C' }],
      teams: teamsIn(['A', 'A', 'B', 'B']),
    }), t);
    expect(groups.map(g => g.id)).toEqual(['A', 'B']);
    expect(groups[1].customName).toBe('Löwen');
    expect(groups[0]).toEqual({ id: 'A' });
  });

  it('Jeder gegen jeden mit gespeicherten Gruppen A und B (Altbestand): eine Gruppe „Alle Teams“', () => {
    const groups = buildEditorGroups(createMockTournament({
      groupSystem: 'roundRobin', numberOfGroups: 2, groups: [{ id: 'A' }, { id: 'B' }], teams: teamsIn(['', '', '']),
    }), t);
    expect(groups).toEqual([{ id: 'default', customName: de.monitorEditor.allTeams }]);
  });

  it('Gegenbeispiel: ohne Zuordnung (kein Team hat eine Gruppe) bleibt es bei den gespeicherten Gruppen', () => {
    const groups = buildEditorGroups(createMockTournament({
      groupSystem: 'groupsAndFinals', numberOfGroups: 2, groups: [{ id: 'A' }, { id: 'B' }], teams: teamsIn(['', '']),
    }), t);
    expect(groups.map(g => g.id)).toEqual(['A', 'B']);
  });
});

describe('monitorEditorHelpers – getSlideDescription', () => {
  const leeres = { sponsors: [], getFieldDisplayName: (id: string) => id };

  it('Gruppe mit customName zeigt den Namen', () => {
    const beschreibung = getSlideDescription(folie('standings', { groupId: 'B' }), {
      groups: [{ id: 'B', customName: 'Löwen' }],
      ...leeres,
      t,
    });
    expect(beschreibung).toBe('Löwen');
  });

  it('Gruppe mit leerem customName fällt auf „Gruppe B“ zurück', () => {
    const beschreibung = getSlideDescription(folie('standings', { groupId: 'B' }), {
      groups: [{ id: 'B', customName: '' }],
      ...leeres,
      t,
    });
    expect(beschreibung).toBe(de.monitorEditor.groupLabel.replace('{{letter}}', 'B'));
    expect(beschreibung).toBe('Gruppe B');
  });

  it('Sponsor mit leerem Namen fällt auf den Nicht-konfiguriert-Text zurück', () => {
    const beschreibung = getSlideDescription(folie('sponsor', { sponsorId: 'sp-1' }), {
      groups: [],
      sponsors: [{ id: 'sp-1', name: '' }],
      getFieldDisplayName: (id: string) => id,
      t,
    });
    expect(beschreibung).toBe(de.monitorEditor.notConfigured);
    expect(beschreibung).toBe('Nicht konfiguriert');
  });

  it('Eigener Text mit leerer Überschrift fällt auf den Fallback-Text zurück', () => {
    const beschreibung = getSlideDescription(folie('custom-text', { headline: '' }), {
      groups: [],
      sponsors: [],
      getFieldDisplayName: (id: string) => id,
      t,
    });
    expect(beschreibung).toBe(de.monitorEditor.customText);
    expect(beschreibung).toBe('Eigener Text');
  });

  it('Live-Folie ohne fieldId fällt auf den Nicht-konfiguriert-Text zurück', () => {
    const beschreibung = getSlideDescription(folie('live', {}), {
      groups: [],
      sponsors: [],
      getFieldDisplayName: (id: string) => id,
      t,
    });
    expect(beschreibung).toBe(de.monitorEditor.notConfigured);
    expect(beschreibung).toBe('Nicht konfiguriert');
  });
});
