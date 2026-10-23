/**
 * Wohin führt die Adresse der App auf einem Helfer-Gerät? @HE-096 (direkt ans Feld), @HE-098 (entzogen / abgeschlossen /
 * abgelaufen), @HE-099 (Auswahl), Pflichtzeilen GA5 (Gast-Turniere sichtbar, nie allein wegen is_anonymous).
 */
import { describe, expect, it } from 'vitest';
import type { HelperAccessEntry } from '../../../core/repositories/helperAccessRpc';
import { decideHelperStart, END_REDIRECT_MAX_AGE_DAYS } from '../helperStartTarget';

const NOW = new Date('2026-11-28T12:00:00Z');
const entry = (o: Partial<HelperAccessEntry>): HelperAccessEntry => ({
  tournamentId: 't-cup', title: 'Live-Cup', date: '2026-11-28', code: 'CUPCODE123', field: 2, relation: 'accepted',
  closed: false, checkNumber: null, homeHintDismissed: false, offlineReadyAt: null, updatedAt: '2026-11-28T10:00:00Z', ...o,
});
const decide = (entries: HelperAccessEntry[], o: { session?: 'device' | 'unknown' | 'account' | 'none'; other?: boolean } = {}) =>
  decideHelperStart({ sessionKind: o.session ?? 'device', entries, hasOtherTournaments: o.other ?? false, now: NOW });

describe('@HE-096 Adresse der App → Feld', () => {
  it('ein laufender Zugang → direkt Feld 2, ohne Startseite', () => {
    expect(decide([entry({})])).toEqual({ kind: 'field', tournamentId: 't-cup', field: 2 });
  });

  it('ohne Feldzuteilung → Feld 1', () => {
    expect(decide([entry({ field: null })])).toEqual({ kind: 'field', tournamentId: 't-cup', field: 1 });
  });

  it('Gegenbeispiel: kein Index-Eintrag → bleiben (nie allein wegen is_anonymous)', () => {
    expect(decide([])).toEqual({ kind: 'stay' });
  });

  it('Gegenbeispiel: Konto angemeldet → bleiben, auch mit altem Eintrag', () => {
    expect(decide([entry({})], { session: 'account' })).toEqual({ kind: 'stay' });
  });

  it('@HE-028 Sitzung nicht lesbar (Halle ohne Netz) → trotzdem ans Feld aus dem Index', () => {
    expect(decide([entry({})], { session: 'unknown' })).toEqual({ kind: 'field', tournamentId: 't-cup', field: 2 });
  });
});

describe('@HE-098 Wiedereinstieg nach Änderung', () => {
  it('Zeile 1: Zugang entzogen → Endkarte über /join/:code, nie das Feld', () => {
    const target = decide([entry({ relation: 'revoked' })]);
    expect(target).toEqual({ kind: 'join', code: 'CUPCODE123' });
  });

  it('Zeile 2: Turnier abgeschlossen → Endkarte (Endstand), nie das Feld', () => {
    expect(decide([entry({ closed: true })])).toEqual({ kind: 'join', code: 'CUPCODE123' });
  });

  it('Zeile 3: Code abgelaufen, Turnier läuft → Feld 2 (der Zugang endet erst mit dem Turnier)', () => {
    expect(decide([entry({ relation: 'accepted', closed: false })])).toEqual({ kind: 'field', tournamentId: 't-cup', field: 2 });
  });

  it('nur zusehen und offene Anfrage führen ebenfalls zur Endkarte', () => {
    expect(decide([entry({ relation: 'viewer' })]).kind).toBe('join');
    expect(decide([entry({ relation: 'pending', checkNumber: 47 })]).kind).toBe('join');
  });

  it('Gegenbeispiel: abgelehnt/verfallen holen die Startseite nicht weg', () => {
    expect(decide([entry({ relation: 'declined' })])).toEqual({ kind: 'stay' });
    expect(decide([entry({ relation: 'expired' })])).toEqual({ kind: 'stay' });
  });

  it('Gegenbeispiel: ein alter Endzustand (über der Altersgrenze) hält die Startseite nicht gefangen', () => {
    const old = new Date(NOW.getTime() - (END_REDIRECT_MAX_AGE_DAYS + 1) * 24 * 60 * 60 * 1000).toISOString();
    expect(decide([entry({ relation: 'revoked', updatedAt: old })])).toEqual({ kind: 'stay' });
  });

  it('mehrere Endzustände: der jüngste gewinnt', () => {
    const target = decide([
      entry({ relation: 'revoked', code: 'ALT', updatedAt: '2026-11-27T10:00:00Z' }),
      entry({ tournamentId: 't-2', relation: 'revoked', code: 'NEU', updatedAt: '2026-11-28T11:00:00Z' }),
    ]);
    expect(target).toEqual({ kind: 'join', code: 'NEU' });
  });
});

describe('@HE-099 Auswahl bei mehreren Turnieren', () => {
  const nikolaus = entry({ tournamentId: 't-niko', title: 'Nikolaus-Turnier', code: 'NIKO', field: 1 });

  it('zwei laufende Turniere → Auswahl statt Startseite', () => {
    expect(decide([entry({}), nikolaus])).toEqual({ kind: 'chooser' });
  });

  it('Aber: ist eines abgeschlossen, öffnet sich das andere direkt', () => {
    expect(decide([entry({ closed: true }), nikolaus])).toEqual({ kind: 'field', tournamentId: 't-niko', field: 1 });
  });

  it('Gegenbeispiel: zwei abgeschlossene → keine Auswahl (Endkarte des jüngsten)', () => {
    const target = decide([entry({ closed: true }), { ...nikolaus, closed: true }]);
    expect(target.kind).toBe('join');
  });

  it('Gegenbeispiel: ein entzogenes und ein laufendes → direkt ans laufende, ohne Auswahl', () => {
    expect(decide([entry({ relation: 'revoked' }), nikolaus]).kind).toBe('field');
  });
});

describe('Pflichtzeile GA5: Gast-Turniere bleiben sichtbar', () => {
  it('ein laufender Zugang neben lokalen Turnieren → Auswahl (mit Weg zur Startseite) statt direkt ins Feld', () => {
    expect(decide([entry({})], { other: true })).toEqual({ kind: 'chooser' });
  });

  it('kein laufender Zugang, aber lokale Turniere → Startseite bleibt', () => {
    expect(decide([entry({ relation: 'revoked' })], { other: true })).toEqual({ kind: 'stay' });
  });
});
