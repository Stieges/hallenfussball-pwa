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
const melde = vi.fn();
const meldungText = () => '';
/** Ein Hook für den ganzen Ablauf: `rerender` mit dem geänderten Turnier – so rechnet die offene Karte im Cockpit neu. */
const zeigeKarte = (t: Tournament) => renderHook(({ tournament }: { tournament: Tournament }) => useLeibchenKarte({
  tournament, matchId: 'm1', zustand: 'vorAnpfiff', melde, meldungText,
}), { initialProps: { tournament: t } });

const mitSchwarz: Team[] = [{ id: SUED, name: 'SV Süd', colors: { primary: SCHWARZ } }, { id: NORD, name: 'FC Nord', colors: { primary: SCHWARZ } }];
const sueedUnbekannt: Team[] = [{ id: SUED, name: 'SV Süd' }, { id: NORD, name: 'FC Nord', colors: { primary: SCHWARZ } }];

describe('@W3-042 Leibchen-Karte nach „Unbekannt“', () => {
  it('offene Karte: vorher Karte nötig, nach „Unbekannt“ rechnet derselbe Hook ohne Farbe für SV Süd neu (kein Konflikt mehr)', () => {
    const { result, rerender } = zeigeKarte(turnier(mitSchwarz, spiel()));
    expect(result.current?.trikot).toEqual({ a: SCHWARZ, b: SCHWARZ });
    expect(result.current?.nurFestlegen).toBe(false);
    rerender({ tournament: turnier(sueedUnbekannt, spiel()) });
    expect(result.current?.trikot).toEqual({ b: SCHWARZ });
    expect(result.current?.trikot.a).toBeUndefined();
    expect(result.current?.nurFestlegen).toBe(true);
    expect(result.current?.gewaehlt).toBeNull();
  });

  it('bestätigte Wahl bleibt stehen: nach „Unbekannt“ zeigt derselbe Hook weiter Gelb auf Seite a', () => {
    const bestaetigt = spiel({ kitDecision: 'bib', kit: { a: GELB, b: SCHWARZ, bibSide: 'a' } });
    const { result, rerender } = zeigeKarte(turnier(mitSchwarz, bestaetigt));
    expect(result.current?.gewaehlt).toEqual({ art: 'bestaetigt', seite: 'a', farbe: GELB });
    rerender({ tournament: turnier(sueedUnbekannt, bestaetigt) });
    expect(result.current?.gewaehlt).toEqual({ art: 'bestaetigt', seite: 'a', farbe: GELB });
    expect(result.current?.trikot.a).toBeUndefined();
  });
});
