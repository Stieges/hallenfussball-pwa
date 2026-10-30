/**
 * R3-7 Programm des Monitors nach dem Abschluss (@ZM-121 Z. 1 und 4, @LZ-076, @ZM-012 Z. 2, @ZM-180): aus der ECHTEN Server-Antwort
 * (`display_final_standings`, Fixture `endstandFixture`) und dem Turnier der Ansicht wird entschieden, was der Monitor zeigt.
 */
import { describe, expect, it } from 'vitest';
import { parsePublicFinalStandings, type PublicFinalStandings } from '../../../core/repositories/publicFinalStandings';
import type { MonitorSlide } from '../../../types/monitor';
import { applyEnd, monitorEnd } from '../monitorEnd';
import { buildMonitorView } from '../monitorView';
import type { ProgramSlide } from '../slideProgramme';
import { buildTournament, slide } from './monitorFixture';
import { serverEndstand, SERVER_NONE } from './endstandFixture';

function gelesen(raw: unknown): PublicFinalStandings {
  const parsed = parsePublicFinalStandings(raw);
  if (parsed === null) { throw new Error('Fixture nicht lesbar'); }
  return parsed;
}
const abgeschlossen = (kids = false) => buildTournament({ lifecycleStatus: 'finished', hideScoresForPublic: kids });
const endeFuer = (raw: unknown, kids = false) => {
  const t = abgeschlossen(kids);
  return monitorEnd(t, buildMonitorView(t), gelesen(raw));
};

const PROGRAMM: MonitorSlide[] = [
  slide('live', { fieldId: 'field-1' }), slide('all-standings'), slide('next-matches'), slide('schedule-field', { fieldId: 'field-1' }),
  slide('sponsor', { sponsorId: 'sp-1' }), slide('custom-text', { headline: 'Danke' }), slide('qr-code'),
];
const typen = (slides: readonly ProgramSlide[]): string[] => slides.map((s) => s.type);

describe('monitorEnd', () => {
  it('@ZM-121 Z. 1: abgeschlossen + Endstand vom Server = Endstand mit den Plätzen des Servers', () => {
    const ende = endeFuer(serverEndstand());
    expect(ende.kind).toBe('final');
    expect(ende.kind === 'final' && ende.ranking.map((r) => r.teamName)).toEqual(['FC Nord', 'SV Süd', 'TSV West', 'SG Mitte', 'SC Ost', 'FC Berg']);
  });

  it('@LZ-075 Gegenbeispiel: ohne Abschluss kein Endstand, auch wenn eine Antwort mit Endstand vorliegt (älterer Stand)', () => {
    const t = buildTournament({ lifecycleStatus: 'fixed' });
    expect(monitorEnd(t, buildMonitorView(t), gelesen(serverEndstand())).kind).toBe('none');
  });

  it('abgeschlossen, aber der Server meldet (noch) keinen Endstand: nichts erfinden, kein Endstand', () => {
    expect(endeFuer(SERVER_NONE).kind).toBe('none');
  });

  it('@ZM-121 Z. 4: Kindermodus = „Turnier beendet – danke fürs Mitspielen“, nie ein Platz – auch wenn der Server Plätze liefert', () => {
    expect(endeFuer(SERVER_NONE, true).kind).toBe('kids');
    expect(endeFuer(serverEndstand(), true).kind).toBe('kids');
  });

  it('@ZM-012 Z. 2: ohne Torschützen-Schalter keine Liste (scorers = null), mit Schalter die gespeicherte Liste', () => {
    const aus = endeFuer(serverEndstand({ scorersPublic: false }));
    const an = endeFuer(serverEndstand());
    expect(aus.kind === 'final' && aus.scorers).toBeNull();
    expect(an.kind === 'final' && an.scorers).toHaveLength(5);
  });
});

describe('applyEnd', () => {
  it('@ZM-121 Z. 1: Endstand ersetzt Live-Spiel, Tabellen, Nächste Spiele und Spielplan; Sponsor, eigener Text und QR laufen weiter', () => {
    const ergebnis = applyEnd(PROGRAMM, endeFuer(serverEndstand({ scorersPublic: false })));
    expect(typen(ergebnis)).toEqual(['final-standings', 'sponsor', 'custom-text', 'qr-code']);
  });

  it('@ZM-012: mit Schalter folgt die Torschützen-Folie hinter dem Endstand', () => {
    expect(typen(applyEnd(PROGRAMM, endeFuer(serverEndstand())))).toEqual(['final-standings', 'final-scorers', 'sponsor', 'custom-text', 'qr-code']);
  });

  it('@ZM-012 Z. 2: ohne Schalter nie eine Torschützen-Folie – auch nicht, wenn das Programm eine „Torschützen“-Folie enthält', () => {
    const ergebnis = applyEnd([...PROGRAMM, slide('top-scorers')], endeFuer(serverEndstand({ scorersPublic: false })));
    expect(typen(ergebnis)).not.toContain('final-scorers');
    expect(typen(ergebnis)).not.toContain('top-scorers');
  });

  it('mit Schalter, aber ohne ein einziges Tor: keine leere Torschützen-Folie', () => {
    expect(typen(applyEnd(PROGRAMM, endeFuer(serverEndstand({ scorers: [] }))))).not.toContain('final-scorers');
  });

  it('@ZM-121 Z. 4: Kindermodus zeigt die Endstand-Folie als Satz, keine Torschützen', () => {
    expect(typen(applyEnd(PROGRAMM, endeFuer(serverEndstand(), true)))).toEqual(['final-standings', 'sponsor', 'custom-text', 'qr-code']);
  });

  it('ein Programm ohne die ersetzten Folien bekommt den Endstand trotzdem (der Monitor zeigt nach dem Ende den Endstand)', () => {
    expect(typen(applyEnd([slide('qr-code')], endeFuer(serverEndstand({ scorersPublic: false }))))).toEqual(['final-standings', 'qr-code']);
  });

  it('@LZ-075: ohne Abschluss bleibt das Programm unverändert', () => {
    const t = buildTournament({ lifecycleStatus: 'fixed' });
    expect(applyEnd(PROGRAMM, monitorEnd(t, buildMonitorView(t), gelesen(SERVER_NONE)))).toEqual(PROGRAMM);
  });
});
