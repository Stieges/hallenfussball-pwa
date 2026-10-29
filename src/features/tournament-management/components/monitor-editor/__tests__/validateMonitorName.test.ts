/**
 * validateMonitorName (@ME-072): Pflicht, höchstens 50 Zeichen, Doppelte ohne Groß/Klein.
 */
import { describe, it, expect } from 'vitest';
import { validateMonitorName } from '../validateMonitorName';

const andere = ['Hallenmonitor Halle', 'Eingang'];

describe('validateMonitorName (@ME-072)', () => {
  it('„Halle Nord“ mit Leerzeichen ist gültig', () => {
    expect(validateMonitorName('Halle Nord', andere)).toBeNull();
  });
  it('ein leerer oder nur aus Leerzeichen bestehender Name fehlt', () => {
    expect(validateMonitorName('', andere)).toBe('nameRequired');
    expect(validateMonitorName('   ', andere)).toBe('nameRequired');
  });
  it('51 Zeichen sind zu lang, 50 Zeichen gültig', () => {
    expect(validateMonitorName('a'.repeat(51), andere)).toBe('nameTooLong');
    expect(validateMonitorName('a'.repeat(50), andere)).toBeNull();
  });
  it('„hallenmonitor halle“ ist neben „Hallenmonitor Halle“ doppelt', () => {
    expect(validateMonitorName('hallenmonitor halle', andere)).toBe('duplicateName');
    expect(validateMonitorName('  EINGANG ', andere)).toBe('duplicateName');
  });
  it('Gegenbeispiel: der eigene Name (nicht in otherNames) ist nicht doppelt', () => {
    expect(validateMonitorName('Haupthalle', andere)).toBeNull();
  });
  it('Gegenbeispiel: ein Name, der nur Teil eines anderen ist, ist nicht doppelt', () => {
    expect(validateMonitorName('Hallenmonitor', andere)).toBeNull();
  });
});
