/** @W5-028 – Eine Kopie trägt „(Probe)“ im Namen; der Zusatz kommt nur einmal. */
import { describe, it, expect } from 'vitest';
import { proposeCopyTitle, proposeProbeDate, buildCopiedTournament } from '../tournamentCopy';
import { categorizeTournament } from '../../../utils/tournamentCategories';
import { hallencupOstGespielt } from '../__fixtures__/hallencupOstGespielt';

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

/** B3 (Review #280): @W5-025 „steht bei den kommenden Turnieren“ gilt auch, wenn das Original gespielt und in der Vergangenheit liegt */
describe('@W5-025 Datum der Probe', () => {
  const HEUTE = new Date(2026, 10, 20, 10, 0, 0); // 20.11.2026 10:00 lokal

  it('Original in der Zukunft: Datum wird übernommen', () => {
    expect(proposeProbeDate({ startDate: '2026-12-05' }, HEUTE)).toBe('2026-12-05');
  });
  it('Original in der Vergangenheit: morgen', () => {
    expect(proposeProbeDate({ startDate: '2026-11-14' }, HEUTE)).toBe('2026-11-21');
  });
  it('Original heute: morgen (heute wäre „läuft“ oder schon vorbei)', () => {
    expect(proposeProbeDate({ startDate: '2026-11-20' }, HEUTE)).toBe('2026-11-21');
  });
  it('Monats- und Jahreswechsel', () => {
    expect(proposeProbeDate({ startDate: undefined }, new Date(2026, 11, 31))).toBe('2027-01-01');
  });

  const kopie = (startDate: string) => buildCopiedTournament({ ...hallencupOstGespielt(), startDate: '2026-11-14', date: '2026-11-14' }, {
    newId: crypto.randomUUID(), title: 'Hallencup Ost (Probe)', now: HEUTE.toISOString(), makeId: () => crypto.randomUUID(), startDate,
  });

  it('Original mit vergangenem Datum: die Kopie mit Datum morgen steht bei „kommend“', () => {
    const k = kopie(proposeProbeDate({ startDate: '2026-11-14' }, HEUTE));
    expect(k.startDate).toBe('2026-11-21');
    expect(k.date).toBe('2026-11-21');
    expect(categorizeTournament(k, HEUTE)).toBe('upcoming');
  });
  // KB-3c: Archiv nur nach Abschluss (@LZ-001, @LZ-006, Befund C-ARCHIV-NACH-DATUM). Die Kopie ist weder abgeschlossen
  // noch abgebrochen und nichts ist angepfiffen, also „Festgelegt“ (kommend); das alte Datum allein archiviert nicht.
  it('Gegenbeispiel: ohne neues Datum bleibt die Kopie des vergangenen Originals „Festgelegt“, nicht im Archiv (@LZ-001)', () => {
    const ohne = buildCopiedTournament({ ...hallencupOstGespielt(), startDate: '2026-11-14', date: '2026-11-14' }, {
      newId: crypto.randomUUID(), title: 'x', now: HEUTE.toISOString(), makeId: () => crypto.randomUUID(),
    });
    expect(categorizeTournament(ohne, HEUTE)).toBe('upcoming');
  });
  it('Original in der Zukunft: Datum übernommen, Kopie bei „kommend“', () => {
    const k = kopie(proposeProbeDate({ startDate: '2026-12-05' }, HEUTE));
    expect(k.startDate).toBe('2026-12-05');
    expect(categorizeTournament(k, HEUTE)).toBe('upcoming');
  });
});
