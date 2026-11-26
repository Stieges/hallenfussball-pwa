/**
 * @W3-042 (Gherkin, Wizard-Record): Wird SV Süd wieder auf „Unbekannt“ gestellt und ist für das nächste Spiel von SV Süd schon eine Leibchen-Karte
 * offen, rechnet sie ohne Farbe für SV Süd neu; eine schon bestätigte Wahl bleibt stehen. Geprüft an dem Hook, der die Karte liefert.
 * Hallencup Nord: SV Süd und FC Nord, beide Schwarz → Karte nötig (@SL-137).
 */
import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useLeibchenKarte } from '../useLeibchenKarte';
import { teamSlot } from '../../../../core/models/matchSlot';
import type { Match, Team, Tournament } from '../../../../types/tournament';

vi.mock('../../../../hooks/useKitChoices', () => ({
  useKitChoices: () => ({ entries: [], notices: [], choose: vi.fn(), dismissNotice: vi.fn() }),
}));

const SUED = '00000000-0000-4000-8000-0000000000b1';
const NORD = '00000000-0000-4000-8000-0000000000b2';
const SCHWARZ = '#000000';
const GELB = '#FFCC00';

const spiel = (extra: Partial<Match> = {}): Match => ({
  id: 'm1', round: 1, field: 1, matchNumber: 1, slotA: teamSlot(SUED), slotB: teamSlot(NORD), matchStatus: 'scheduled', ...extra,
});
const turnier = (teams: Team[], match: Match): Tournament => ({ id: 't', title: 'Hallencup Nord', teams, matches: [match] }) as unknown as Tournament;
const karte = (t: Tournament) => renderHook(() => useLeibchenKarte({
  tournament: t, matchId: 'm1', zustand: 'vorAnpfiff', melde: vi.fn(), meldungText: () => '',
})).result.current;

const mitSchwarz: Team[] = [{ id: SUED, name: 'SV Süd', colors: { primary: SCHWARZ } }, { id: NORD, name: 'FC Nord', colors: { primary: SCHWARZ } }];
const sueedUnbekannt: Team[] = [{ id: SUED, name: 'SV Süd' }, { id: NORD, name: 'FC Nord', colors: { primary: SCHWARZ } }];

describe('@W3-042 Leibchen-Karte nach „Unbekannt“', () => {
  it('offene Karte: vorher Karte nötig, danach rechnet sie ohne Farbe für SV Süd neu (kein Konflikt mehr)', () => {
    const vorher = karte(turnier(mitSchwarz, spiel()));
    expect(vorher?.trikot).toEqual({ a: SCHWARZ, b: SCHWARZ });
    expect(vorher?.nurFestlegen).toBe(false);
    const nachher = karte(turnier(sueedUnbekannt, spiel()));
    expect(nachher?.trikot).toEqual({ b: SCHWARZ });
    expect(nachher?.trikot.a).toBeUndefined();
    expect(nachher?.nurFestlegen).toBe(true);
    expect(nachher?.gewaehlt).toBeNull();
  });

  it('bestätigte Wahl bleibt stehen, auch wenn SV Süd wieder „Unbekannt“ ist', () => {
    const bestaetigt = spiel({ kitDecision: 'bib', kit: { a: GELB, b: SCHWARZ, bibSide: 'a' } });
    const nachher = karte(turnier(sueedUnbekannt, bestaetigt));
    expect(nachher?.gewaehlt).toEqual({ art: 'bestaetigt', seite: 'a', farbe: GELB });
    expect(nachher?.trikot.a).toBeUndefined();
  });
});
