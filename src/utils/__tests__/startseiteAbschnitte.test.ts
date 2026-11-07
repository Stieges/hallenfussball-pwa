/**
 * @OB-078 Am Turniertag stehen die Turniere des Tages oben (Abschnitt „Heute“), @OB-077/@OB-002 Filter im Reiter Turniere
 * (kein „Beendet“), @OB-030 Filter aus der Adresse. Szenario: docs/anforderungen/2026-10-02_oberflaeche.md (Grundriss
 * „Am Turniertag stehen die Turniere des Tages oben und offen“). Tests aus dem Gherkin, Daten wie im Szenario:
 * F2 (Sa 08:30), F1 (Sa 13:00), D (Sa 16:30), G/E2/E1 am Sonntag, Probe-Kopie F2 vom 26.11., Herbstcup vom 24.10. (läuft).
 */
import { describe, it, expect } from 'vitest';
import { baueStartseiteAbschnitte, istHeuteAbgeschlossen, parseFilterChips, type FilterChip } from '../startseiteAbschnitte';
import type { Tournament } from '../../types/tournament';

const nichtAngepfiffen = [{ id: 'm1', matchStatus: 'scheduled' }];
const angepfiffen = [{ id: 'm1', matchStatus: 'running' }, { id: 'm2', matchStatus: 'scheduled' }];

function turnier(
  id: string, startDate: string, startTime: string,
  lage: 'bereit' | 'laeuft' | 'entwurf' | 'abgeschlossen' = 'bereit', title = id,
): Tournament {
  return {
    id, title, startDate, startTime, teams: [], placementLogic: [],
    status: lage === 'entwurf' ? 'draft' : 'published',
    lifecycleStatus: lage === 'abgeschlossen' ? 'finished' : undefined,
    matches: lage === 'laeuft' ? angepfiffen : nichtAngepfiffen,
  } as unknown as Tournament;
}

/** Das Gerät aus dem Szenario; F2 läuft oder ist abgeschlossen je nach Uhrzeit. */
function geraet(f2: 'bereit' | 'laeuft' | 'abgeschlossen'): Tournament[] {
  return [
    turnier('D', '2026-11-28', '16:30'),
    turnier('F1', '2026-11-28', '13:00'),
    turnier('F2', '2026-11-28', '08:30', f2),
    turnier('G', '2026-11-29', '08:30'),
    turnier('E2', '2026-11-29', '12:30'),
    turnier('E1', '2026-11-29', '16:00'),
    turnier('Probe', '2026-11-26', '08:30', 'bereit', 'F2 Probe-Kopie'),
    turnier('Herbstcup', '2026-10-24', '09:00', 'laeuft'),
    turnier('Fruehjahrscup', '2027-03-06', '09:00', 'entwurf'),
  ];
}
const ids = (list: Tournament[]) => list.map((t) => t.id);
const sa = (stunde: number, minute: number) => new Date(2026, 10, 28, stunde, minute);

describe('@OB-078 Am Turniertag stehen die Turniere des Tages oben', () => {
  it.each([
    ['08:00 nichts angepfiffen', sa(8, 0), 'bereit' as const, ['F2', 'F1', 'D']],
    ['09:10 F2 läuft', sa(9, 10), 'laeuft' as const, ['F2', 'F1', 'D']],
    ['12:40 F2 abgeschlossen', sa(12, 40), 'abgeschlossen' as const, ['F1', 'D', 'F2']],
  ])('%s: „Heute“ führt mit %j', (_name, jetzt, f2, erwartet) => {
    const tournaments = geraet(f2);
    const a = baueStartseiteAbschnitte(tournaments, { now: jetzt, search: '', filters: [] });
    expect(ids(a.heute)).toEqual(erwartet);
  });

  it('Probe-Kopie vom 26.11. und Herbstcup vom 24.10. stehen nicht über den Turnieren von heute', () => {
    const a = baueStartseiteAbschnitte(geraet('bereit'), { now: sa(8, 0), search: '', filters: [] });
    expect(ids(a.heute)).not.toContain('Probe');
    expect(ids(a.heute)).not.toContain('Herbstcup');
    expect(ids(a.running)).toEqual(['Herbstcup']);
    expect(ids(a.upcoming)).toEqual(['Probe', 'G', 'E2', 'E1']);
  });

  it('Läuft zuerst, dann nach Beginn: läuft D (16:30) schon, steht es vor F2 (08:30)', () => {
    const t = [turnier('F2', '2026-11-28', '08:30'), turnier('D', '2026-11-28', '16:30', 'laeuft'), turnier('F1', '2026-11-28', '13:00')];
    const a = baueStartseiteAbschnitte(t, { now: sa(17, 0), search: '', filters: [] });
    expect(ids(a.heute)).toEqual(['D', 'F2', 'F1']);
  });

  it('ein Turnier steht in genau einem Abschnitt', () => {
    const a = baueStartseiteAbschnitte(geraet('laeuft'), { now: sa(9, 10), search: '', filters: [] });
    const alle = [...a.heute, ...a.running, ...a.upcoming, ...a.draft].map((t) => t.id);
    expect(new Set(alle).size).toBe(alle.length);
    expect(alle).toHaveLength(9);
  });

  it('ein Entwurf mit dem Datum von heute ist kein Turnier des Tages, er steht bei den Entwürfen', () => {
    const a = baueStartseiteAbschnitte([turnier('E', '2026-11-28', '10:00', 'entwurf')], { now: sa(8, 0), search: '', filters: [] });
    expect(a.heute).toEqual([]);
    expect(ids(a.draft)).toEqual(['E']);
  });

  it('Gegenbeispiel: ohne Turnier von heute gibt es keinen Abschnitt „Heute“', () => {
    const a = baueStartseiteAbschnitte(geraet('bereit'), { now: new Date(2026, 11, 1, 8, 0), search: '', filters: [] });
    expect(a.heute).toEqual([]);
  });

  it('Gegenbeispiel: derselbe Tag in einem anderen Monat oder Jahr (28.10.2026, 28.11.2025) ist nicht „Heute“', () => {
    const t = [turnier('Oktober', '2026-10-28', '09:00'), turnier('Vorjahr', '2025-11-28', '09:00'), turnier('Heute', '2026-11-28', '09:00')];
    const a = baueStartseiteAbschnitte(t, { now: sa(8, 0), search: '', filters: [] });
    expect(ids(a.heute)).toEqual(['Heute']);
    expect(ids(a.upcoming).sort()).toEqual(['Oktober', 'Vorjahr']);
  });

  it('Gegenbeispiel: ein Turnier ohne Datum fällt nicht in „Heute“ und stürzt nichts ab', () => {
    const ohne = { id: 'x', title: 'x', status: 'published', teams: [], matches: [] } as unknown as Tournament;
    const a = baueStartseiteAbschnitte([ohne], { now: sa(8, 0), search: '', filters: [] });
    expect(a.heute).toEqual([]);
    expect(ids(a.upcoming)).toEqual(['x']);
  });
});

describe('@OB-077 @OB-002 Suche und Filter im Reiter Turniere', () => {
  it('Filter „Läuft“ zeigt nur Läuft (auch das Turnier von heute), „Bereit“ nur Bereit', () => {
    const jetzt = sa(9, 10);
    const laeuft = baueStartseiteAbschnitte(geraet('laeuft'), { now: jetzt, search: '', filters: ['running'] });
    expect(ids(laeuft.heute)).toEqual(['F2']);
    expect(ids(laeuft.running)).toEqual(['Herbstcup']);
    expect(laeuft.upcoming).toEqual([]);
    expect(laeuft.draft).toEqual([]);
    const bereit = baueStartseiteAbschnitte(geraet('laeuft'), { now: jetzt, search: '', filters: ['upcoming'] });
    expect(ids(bereit.heute)).toEqual(['F1', 'D']);
    expect(bereit.running).toEqual([]);
  });

  it('Suche „F1“ findet nur F1; Suche und Filter wirken zusammen', () => {
    const a = baueStartseiteAbschnitte(geraet('bereit'), { now: sa(8, 0), search: 'F1', filters: [] });
    expect(ids(a.heute)).toEqual(['F1']);
    const keine = baueStartseiteAbschnitte(geraet('bereit'), { now: sa(8, 0), search: 'F1', filters: ['running'] });
    expect([...keine.heute, ...keine.running, ...keine.upcoming, ...keine.draft]).toEqual([]);
  });

  it('Abgeschlossenes gehört nie in diesen Reiter (kein Filter „Beendet“)', () => {
    const t = [...geraet('bereit'), turnier('Alt', '2026-06-01', '10:00', 'abgeschlossen')];
    const a = baueStartseiteAbschnitte(t, { now: sa(8, 0), search: '', filters: [] });
    expect([...a.heute, ...a.running, ...a.upcoming, ...a.draft].map((x) => x.id)).not.toContain('Alt');
  });
});

describe('@OB-081 Ein heute abgeschlossenes Turnier bleibt bis zum Ende des Tages unter „Heute“', () => {
  // Gegeben heute ist Samstag, 28.11., 12:40, und Olli hat F2 um 12:30 abgeschlossen
  const mittag = sa(12, 40);

  it('F1 ist die erste Karte unter „Heute“, darunter D, F2 steht als letzte', () => {
    const a = baueStartseiteAbschnitte(geraet('abgeschlossen'), { now: mittag, search: '', filters: [] });
    expect(ids(a.heute)).toEqual(['F1', 'D', 'F2']);
    expect(a.heute[0].id).toBe('F1');
    expect(a.heute[a.heute.length - 1].id).toBe('F2');
  });

  it('auch ein Turnier, das später am Tag beginnt als ein laufendes, bleibt vor dem Abgeschlossenen (Abgeschlossenes immer ganz hinten)', () => {
    const t = [turnier('Frueh', '2026-11-28', '07:00', 'abgeschlossen'), turnier('Spaet', '2026-11-28', '18:00'), turnier('Laeuft', '2026-11-28', '12:00', 'laeuft')];
    const a = baueStartseiteAbschnitte(t, { now: sa(19, 0), search: '', filters: [] });
    expect(ids(a.heute)).toEqual(['Laeuft', 'Spaet', 'Frueh']);
  });

  it('mehrere heute abgeschlossene stehen am Ende, nach Beginn geordnet', () => {
    const t = [turnier('B', '2026-11-28', '13:00', 'abgeschlossen'), turnier('A', '2026-11-28', '08:30', 'abgeschlossen'), turnier('K', '2026-11-28', '16:30')];
    expect(ids(baueStartseiteAbschnitte(t, { now: mittag, search: '', filters: [] }).heute)).toEqual(['K', 'A', 'B']);
  });

  it('F2 steht erst ab Sonntag nur noch im Archiv: am Sonntag ist es nicht mehr unter „Heute“', () => {
    const sonntag = new Date(2026, 10, 29, 8, 0);
    const a = baueStartseiteAbschnitte(geraet('abgeschlossen'), { now: sonntag, search: '', filters: [] });
    expect(ids(a.heute)).toEqual(['G', 'E2', 'E1']);
    expect([...a.heute, ...a.running, ...a.upcoming, ...a.draft].map((t) => t.id)).not.toContain('F2');
  });

  it('bis zum letzten Augenblick des Tages (23:59) bleibt es unter „Heute“; um 00:00 Uhr ist es weg', () => {
    const f2 = turnier('F2', '2026-11-28', '08:30', 'abgeschlossen');
    expect(istHeuteAbgeschlossen(f2, new Date(2026, 10, 28, 23, 59))).toBe(true);
    expect(istHeuteAbgeschlossen(f2, new Date(2026, 10, 29, 0, 0))).toBe(false);
    expect(istHeuteAbgeschlossen(f2, new Date(2026, 10, 28, 0, 0))).toBe(true);
  });

  it('Gegenbeispiele: ein abgeschlossenes Turnier von einem anderen Tag, ein laufendes oder ein Entwurf ist nicht „heute abgeschlossen“', () => {
    expect(istHeuteAbgeschlossen(turnier('Alt', '2026-06-01', '10:00', 'abgeschlossen'), mittag)).toBe(false);
    expect(istHeuteAbgeschlossen(turnier('L', '2026-11-28', '10:00', 'laeuft'), mittag)).toBe(false);
    expect(istHeuteAbgeschlossen(turnier('B', '2026-11-28', '10:00'), mittag)).toBe(false);
    expect(istHeuteAbgeschlossen(turnier('E', '2026-11-28', '10:00', 'entwurf'), mittag)).toBe(false);
  });

  it('ein heute abgebrochenes Turnier wird wie ein abgeschlossenes behandelt: letzte Karte unter „Heute“, am Folgetag nicht mehr', () => {
    const abgebrochen = { ...turnier('A', '2026-11-28', '10:00'), lifecycleStatus: 'cancelled' } as Tournament;
    const t = [abgebrochen, turnier('K', '2026-11-28', '16:30')];
    expect(ids(baueStartseiteAbschnitte(t, { now: mittag, search: '', filters: [] }).heute)).toEqual(['K', 'A']);
    expect(istHeuteAbgeschlossen(abgebrochen, new Date(2026, 10, 29, 0, 0))).toBe(false);
  });

  it('Gegenbeispiel: ein im Papierkorb liegendes abgeschlossenes Turnier ist nicht dabei', () => {
    const geloescht = { ...turnier('P', '2026-11-28', '10:00', 'abgeschlossen'), deletedAt: '2026-11-28T09:00:00.000Z' } as Tournament;
    expect(istHeuteAbgeschlossen(geloescht, mittag)).toBe(false);
  });

  it('die Suche wirkt auch auf das Abgeschlossene; ein gesetzter Filter (Läuft, Bereit, Entwurf) blendet es aus', () => {
    const t = geraet('abgeschlossen');
    expect(ids(baueStartseiteAbschnitte(t, { now: mittag, search: 'F2', filters: [] }).heute)).toEqual(['F2']);
    expect(ids(baueStartseiteAbschnitte(t, { now: mittag, search: 'F1', filters: [] }).heute)).toEqual(['F1']);
    expect(ids(baueStartseiteAbschnitte(t, { now: mittag, search: '', filters: ['upcoming'] }).heute)).toEqual(['F1', 'D']);
  });
});

describe('@OB-030 Filter aus der Adresse', () => {
  it('liest ?s=running,draft in fester Reihenfolge', () => {
    expect(parseFilterChips('draft,running')).toEqual<FilterChip[]>(['running', 'draft']);
  });
  it('Gegenbeispiel: leer, null und Unbekanntes (der entfernte Filter „finished“) ergeben keinen Filter', () => {
    expect(parseFilterChips(null)).toEqual([]);
    expect(parseFilterChips('')).toEqual([]);
    expect(parseFilterChips('finished,quatsch')).toEqual([]);
  });
});
