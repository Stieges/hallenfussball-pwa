/**
 * B-44b Monitor-Editor: keine rohen i18n-Schlüssel in Übergang, Performance und Farbschema (echtes i18n, DE und EN).
 */
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MonitorEditor } from '../MonitorEditor';
import type { Tournament } from '../../../types/tournament';
import type { MonitorSlide } from '../../../types/monitor';
import de from '../../../i18n/locales/de/tournament.json';
import en from '../../../i18n/locales/en/tournament.json';

vi.unmock('i18next'); vi.unmock('react-i18next'); // B-41: echte Texte, siehe src/test/realDeI18n.ts
const { initRealDeI18n } = await import('../../../test/realDeI18n');
await initRealDeI18n();

const hoisted = vi.hoisted(() => ({
  monitor: {
    id: 'monitor-1', name: 'Haupthalle', defaultSlideDuration: 15, transition: 'fade', transitionDuration: 500,
    theme: 'dark', performanceMode: 'auto', slides: [] as MonitorSlide[],
    createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z',
  },
}));

vi.mock('../../../hooks', () => ({
  useMonitors: () => ({
    getMonitorById: () => hoisted.monitor, updateMonitor: vi.fn(), addSlide: vi.fn(), updateSlide: vi.fn(),
    removeSlide: vi.fn(), reorderSlides: vi.fn(), getDisplayUrl: () => '',
  }),
  useSponsors: () => ({ sponsors: [] }),
  useFields: () => ({ fields: [], getFieldDisplayName: (id: string) => id }),
}));

const tournament = { id: 't1', name: 'Hallencup', teams: [], matches: [], groups: [], numberOfGroups: 2,
  groupSystem: 'groups', isPublic: false, monitors: [hoisted.monitor] } as unknown as Tournament;

const KEYS = [
  'transitions.fade', 'transitions.slide', 'transitions.none',
  'performance.auto', 'performance.autoDesc', 'performance.high', 'performance.highDesc', 'performance.low', 'performance.lowDesc',
  'themes.dark', 'themes.darkDesc', 'themes.light', 'themes.lightDesc', 'themes.auto', 'themes.autoDesc',
];

function lookup(tree: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((node, part) => (node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined), tree);
}

describe('Monitor-Editor ohne Rohschlüssel', () => {
  it('die Auswahlfelder Übergang, Performance und Farbschema zeigen Texte statt „monitorEditor.settings…“', () => {
    const { baseElement: container } = render(<MonitorEditor tournament={tournament} monitorId="monitor-1" onTournamentUpdate={vi.fn()} onClose={vi.fn()} />);
    const optionTexts = Array.from(container.querySelectorAll('option')).map(o => o.textContent ?? '');
    expect(optionTexts.length).toBeGreaterThanOrEqual(9);
    for (const text of optionTexts) { expect(text).not.toMatch(/monitorEditor\./); }
    expect(container.textContent).not.toMatch(/monitorEditor\.settings\./);
  });

  it.each(KEYS)('Schlüssel monitorEditor.settings.%s hat in DE und EN einen Text', (key) => {
    for (const tree of [de, en]) {
      const value = lookup((tree as { monitorEditor: { settings: unknown } }).monitorEditor.settings, key);
      expect(typeof value).toBe('string');
      expect((value as string).trim().length).toBeGreaterThan(0);
    }
  });

  it('Gegenbeispiel: DE und EN unterscheiden sich in den Beschriftungen (keine Kopie)', () => {
    const d = lookup(de.monitorEditor.settings, 'transitions.fade');
    const e = lookup(en.monitorEditor.settings, 'transitions.fade');
    expect(d).not.toBe(e);
  });
});
