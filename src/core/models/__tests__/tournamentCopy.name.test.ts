/** @W5-028 – Eine Kopie trägt „(Probe)“ im Namen; der Zusatz kommt nur einmal. */
import { describe, it, expect } from 'vitest';
import { proposeCopyTitle } from '../tournamentCopy';

describe('@W5-028 proposeCopyTitle', () => {
  it('Hallencup Ost wird zu „Hallencup Ost (Probe)“', () => {
    expect(proposeCopyTitle('Hallencup Ost', '(Probe)')).toBe('Hallencup Ost (Probe)');
  });
  it('Gegenbeispiel: eine Kopie der Kopie bekommt den Zusatz nicht doppelt', () => {
    expect(proposeCopyTitle('Hallencup Ost (Probe)', '(Probe)')).toBe('Hallencup Ost (Probe)');
  });
  it('Leerraum um den Namen stört nicht', () => {
    expect(proposeCopyTitle('  Hallencup Ost ', '(Probe)')).toBe('Hallencup Ost (Probe)');
  });
  it('ein Zusatz mitten im Namen zählt nicht als Zusatz', () => {
    expect(proposeCopyTitle('(Probe) Cup', '(Probe)')).toBe('(Probe) Cup (Probe)');
  });
});
