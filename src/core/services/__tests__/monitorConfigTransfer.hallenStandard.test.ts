/**
 * @ME-074 / @ME-058: Aus der Vorlage „Hallen-Standard“ wird ein Monitor mit vier Folien; Name und Feld setzt der Aufrufer.
 */
import { describe, it, expect } from 'vitest';
import { buildHallenStandardMonitors, hallenStandardPayload } from '../monitorConfigTransfer';

const optionen = { sponsors: [], existingNames: [] as string[], generateId: (p: 'mon' | 'slide') => `${p}-x`, now: '2026-11-14T10:00:00.000Z' };

describe('Vorlage Hallen-Standard anlegen', () => {
  it('legt einen Monitor mit Live-Spiel, Nächste Spiele, Alle Tabellen und Zuschauer-QR an', () => {
    const [monitor, ...rest] = buildHallenStandardMonitors('Hallen-Standard', 'field-1', optionen);
    expect(rest).toHaveLength(0);
    expect(monitor.name).toBe('Hallen-Standard');
    expect(monitor.slides.map(s => s.type)).toEqual(['live', 'next-matches', 'all-standings', 'qr-code']);
    expect(monitor.slides.map(s => s.order)).toEqual([0, 1, 2, 3]);
  });

  it('die Live-Folie bekommt das erste Feld des Turniers', () => {
    const [monitor] = buildHallenStandardMonitors('Hallen-Standard', 'feld-a', optionen);
    expect(monitor.slides[0].config.fieldId).toBe('feld-a');
  });

  it('Gegenbeispiel: ohne Feldangabe bleibt „field-1“, die Vorlage selbst wird nie verändert', () => {
    const payload = hallenStandardPayload('X');
    expect(payload.monitors[0].slides[0].config.fieldId).toBe('field-1');
    hallenStandardPayload('Y', 'feld-b');
    expect(hallenStandardPayload('Z').monitors[0].slides[0].config.fieldId).toBe('field-1');
  });

  it('Gegenbeispiel: ein schon vergebener Name wird nummeriert statt doppelt vergeben', () => {
    const [monitor] = buildHallenStandardMonitors('Hallen-Standard', 'field-1', { ...optionen, existingNames: ['Hallen-Standard'] });
    expect(monitor.name).toBe('Hallen-Standard (2)');
  });
});
