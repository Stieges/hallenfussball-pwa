/**
 * Übernehmen: fehlendes Feld/Gruppe (@ME-061), Umbenennen (@ME-062), eigener QR-Link (@ME-063) – B-22b
 * @see docs/anforderungen/2026-10-03_monitor-einrichten.md
 */

import { describe, it, expect } from 'vitest';
import type { MonitorConfigPayload, TransferSlide } from '../monitorConfigTransfer';
import { instantiateMonitorConfig } from '../monitorConfigTransfer';
import {
  applySlideFixes,
  findReferenceIssues,
  REASSIGN_FIELD_ID,
  sanitizeCustomQr,
  slideReferenceProblem,
  tournamentSlotTargets,
} from '../monitorConfigTransferChecks';

const ONE_FIELD = { fieldIds: ['field-1'], groupIds: ['A', 'B'] };

function slide(type: TransferSlide['type'], config: TransferSlide['config'] = {}): TransferSlide {
  return { type, config, duration: null };
}

function payload(slides: TransferSlide[], name = 'Halle'): MonitorConfigPayload {
  return {
    kind: 'monitor-config',
    version: 1,
    monitors: [{
      name, defaultSlideDuration: 15, transition: 'fade', transitionDuration: 500,
      theme: 'dark', performanceMode: 'auto', slides,
    }],
  };
}

describe('tournamentSlotTargets', () => {
  it('liest Felder aus dem Turnier und fällt sonst auf die Anzahl zurück', () => {
    const withFields = tournamentSlotTargets({
      fields: [{ id: 'field-1', defaultName: 'Feld 1' }, { id: 'field-3', defaultName: 'Feld 3' }],
      numberOfFields: 3,
    });
    expect(withFields.fieldIds).toEqual(['field-1', 'field-3']);

    expect(tournamentSlotTargets({ numberOfFields: 2 }).fieldIds).toEqual(['field-1', 'field-2']);
  });

  it('nennt Gruppen wie der Monitor-Editor: Buchstaben, bei einer Gruppe „default“', () => {
    expect(tournamentSlotTargets({ numberOfGroups: 3 }).groupIds).toEqual(['A', 'B', 'C']);
    expect(tournamentSlotTargets({ numberOfGroups: 1 }).groupIds).toEqual(['default']);
    expect(tournamentSlotTargets({ groups: [{ id: 'X' }] }).groupIds).toEqual(['X']);
  });

  it('Jeder gegen Jeden hat nur die Gruppe „default“, auch mit übrig gebliebener Gruppenzahl (K2)', () => {
    const roundRobin = tournamentSlotTargets({ groupSystem: 'roundRobin', numberOfGroups: 3 });
    expect(roundRobin.groupIds).toEqual(['default']);
    expect(slideReferenceProblem({ type: 'standings', config: { groupId: 'C' } }, roundRobin)).toBe('group');
    expect(slideReferenceProblem({ type: 'standings', config: { groupId: 'default' } }, roundRobin)).toBeNull();
  });
});

describe('slideReferenceProblem (@ME-061)', () => {
  it('meldet ein Feld, das das Turnier nicht hat', () => {
    expect(slideReferenceProblem({ type: 'live', config: { fieldId: 'field-2' } }, ONE_FIELD)).toBe('field');
  });

  it('meldet nichts, wenn das Feld existiert (Gegenbeispiel)', () => {
    expect(slideReferenceProblem({ type: 'live', config: { fieldId: 'field-1' } }, ONE_FIELD)).toBeNull();
  });

  it('meldet eine Tabellen-Folie mit fehlender Gruppe, nicht eine ohne Gruppe', () => {
    expect(slideReferenceProblem({ type: 'standings', config: { groupId: 'C' } }, ONE_FIELD)).toBe('group');
    expect(slideReferenceProblem({ type: 'standings', config: {} }, ONE_FIELD)).toBeNull();
  });
});

describe('findReferenceIssues und applySlideFixes (@ME-061)', () => {
  const data = payload([
    slide('live', { fieldId: 'field-2' }),
    slide('standings', { groupId: 'C' }),
    slide('schedule-group', { groupId: 'C' }),
    slide('qr-code'),
  ]);

  it('listet je fehlender Referenz die Entscheidungen; die Tabelle bietet „Alle Tabellen zeigen“', () => {
    const issues = findReferenceIssues(data, ONE_FIELD);
    expect(issues.map(i => [i.key, i.problem, i.fixes])).toEqual([
      ['0:0', 'field', ['reassign-field', 'remove']],
      ['0:1', 'group', ['all-groups', 'remove']],
      ['0:2', 'group', ['remove']],
    ]);
  });

  it('ohne Entscheidung bleibt die Folie unverändert', () => {
    const result = applySlideFixes(data, {});
    expect(result.monitors[0].slides).toEqual(data.monitors[0].slides);
  });

  it('„Auf Feld 1 umstellen“, „Alle Tabellen zeigen“ und „Folie entfernen“ wirken auf die richtige Folie', () => {
    const result = applySlideFixes(data, { '0:0': 'reassign-field', '0:1': 'all-groups', '0:2': 'remove' });
    const [live, table] = result.monitors[0].slides;
    expect(live.config.fieldId).toBe(REASSIGN_FIELD_ID);
    expect(table.type).toBe('all-standings');
    expect(table.config).not.toHaveProperty('groupId');
    expect(result.monitors[0].slides.map(s => s.type)).toEqual(['live', 'all-standings', 'qr-code']);
  });
});

describe('sanitizeCustomQr (@ME-063)', () => {
  it('verwirft den eigenen Link aus einer Datei und zählt ihn', () => {
    const data = payload([slide('qr-code', { qrTarget: 'custom', customQrUrl: 'https://sv-nord.de' })]);
    const { payload: out, skipped } = sanitizeCustomQr(data, 'file');
    expect(out.monitors[0].slides[0].config).toEqual({});
    expect(skipped).toEqual({ fromFile: 1, invalidUrl: 0 });
  });

  it('behält einen gültigen https-Link aus dem Turnier', () => {
    const data = payload([slide('qr-code', { qrTarget: 'custom', customQrUrl: 'https://sv-nord.de' })]);
    const { payload: out, skipped } = sanitizeCustomQr(data, 'tournament');
    expect(out.monitors[0].slides[0].config).toEqual({ qrTarget: 'custom', customQrUrl: 'https://sv-nord.de' });
    expect(skipped).toEqual({ fromFile: 0, invalidUrl: 0 });
  });

  it.each(['javascript:alert(1)', 'ftp://sv-nord.de', 'kein Link'])('verwirft aus dem Turnier eine Adresse wie „%s“', (url) => {
    const data = payload([slide('qr-code', { qrTarget: 'custom', customQrUrl: url })]);
    const { payload: out, skipped } = sanitizeCustomQr(data, 'tournament');
    expect(out.monitors[0].slides[0].config.qrTarget).toBeUndefined();
    expect(skipped.invalidUrl).toBe(1);
  });

  it('ändert nichts ohne eigenen Link (Gegenbeispiel)', () => {
    const data = payload([slide('qr-code', { qrTarget: 'sponsor-website' })]);
    const { payload: out, skipped } = sanitizeCustomQr(data, 'file');
    expect(out).toEqual(data);
    expect(skipped).toEqual({ fromFile: 0, invalidUrl: 0 });
  });
});

describe('Umbenennen beim Übernehmen (@ME-062)', () => {
  const options = {
    sponsors: [],
    generateId: (() => { let n = 0; return () => `id-${++n}`; })(),
    now: '2026-10-15T10:00:00.000Z',
  };

  it('nennt einen Monitor mit vergebenem Namen „(2)“ und meldet die Umbenennung', () => {
    const { monitors, renamed } = instantiateMonitorConfig(payload([], 'Halle'), { ...options, existingNames: ['Halle'] });
    expect(monitors[0].name).toBe('Halle (2)');
    expect(renamed).toEqual([{ from: 'Halle', to: 'Halle (2)' }]);
  });

  it('meldet nichts ohne Namenskonflikt (Gegenbeispiel)', () => {
    const { monitors, renamed } = instantiateMonitorConfig(payload([], 'Halle'), { ...options, existingNames: ['Eingang'] });
    expect(monitors[0].name).toBe('Halle');
    expect(renamed).toEqual([]);
  });

  it('übernimmt den eigenen QR-Link in die Folie', () => {
    const data = payload([slide('qr-code', { qrTarget: 'custom', customQrUrl: 'https://sv-nord.de' })]);
    const { monitors } = instantiateMonitorConfig(data, { ...options, existingNames: [] });
    expect(monitors[0].slides[0].config).toMatchObject({ qrTarget: 'custom', customQrUrl: 'https://sv-nord.de' });
  });
});
