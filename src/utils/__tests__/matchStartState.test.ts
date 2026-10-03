/**
 * getMatchStartState — gemeinsame Funktion „Ist das Turnier angepfiffen?"
 * (drei Ergebnisse: angepfiffen / nicht angepfiffen / nicht feststellbar).
 *
 * S2 (Fixrunde 1): Der Auswertungskern lag bislang nur in
 * features/tournament-admin/categories/DangerZone/index.tsx. Er wird hierher
 * gezogen, damit DangerZone, SettingsTab („Im Wizard bearbeiten") und
 * TournamentCard (Papierkorb) dieselbe Funktion nutzen statt Kopien.
 *
 * K1-Regeln (Ruling): fehlendes matchStatus = 'scheduled' (geplant) — publish()
 * erzeugt die Spiele ohne matchStatus. Nicht feststellbar ist NUR: fehlende/
 * ungültige Match-Liste oder ein unbekannter Status-String.
 */
import { describe, it, expect } from 'vitest';
import { getMatchStartState } from '../matchStartState';
import type { Match } from '../../types/tournament';

function matchWith(status: string | undefined): Match {
  return { id: 'm1', matchStatus: status } as unknown as Match;
}

describe('getMatchStartState — Anpfiff-Zustand (S2, K1)', () => {
  it('fehlende Match-Liste ist nicht feststellbar', () => {
    expect(getMatchStartState(undefined)).toBe('unknown');
  });

  it('unbekannter Status-String ist nicht feststellbar', () => {
    expect(getMatchStartState([matchWith('irgendwas')])).toBe('unknown');
  });

  it('fehlendes matchStatus gilt als geplant (K1, publish()-Zustand)', () => {
    expect(getMatchStartState([matchWith(undefined)])).toBe('not-started');
  });

  it('leere Match-Liste: kein Spiel angepfiffen', () => {
    expect(getMatchStartState([])).toBe('not-started');
  });

  it.each(['scheduled', 'waiting', 'skipped'] as const)(
    'geplantes Spiel (%s) ist nicht angepfiffen',
    (status) => {
      expect(getMatchStartState([matchWith(status)])).toBe('not-started');
    }
  );

  it.each(['running', 'paused', 'finished'] as const)(
    'Spiel-Status %s bedeutet angepfiffen',
    (status) => {
      expect(getMatchStartState([matchWith(status)])).toBe('started');
    }
  );

  it('ein angepfiffenes Spiel genügt (Mix)', () => {
    expect(
      getMatchStartState([matchWith('scheduled'), matchWith('running'), matchWith('scheduled')])
    ).toBe('started');
  });
});

describe('getMatchStartState — Live-Stand (S3, W1)', () => {
  const planned = () => [matchWith('scheduled')];

  it('(a) Live-Stand zeigt gestartetes Spiel, matches noch geplant: angepfiffen', () => {
    expect(getMatchStartState(planned(), { status: 'ok', anyStarted: true })).toBe('started');
  });

  it('(b) Live-Stand nicht lesbar: nicht feststellbar (fail-closed)', () => {
    expect(getMatchStartState(planned(), { status: 'error' })).toBe('unknown');
  });

  it('(c) Gegenbeispiel: alles geplant, Live-Stand leer: nicht angepfiffen', () => {
    expect(getMatchStartState(planned(), { status: 'ok', anyStarted: false })).toBe('not-started');
  });

  it('Live-Stand noch nicht geladen: nicht feststellbar', () => {
    expect(getMatchStartState(planned(), { status: 'loading' })).toBe('unknown');
  });

  it('kein Live-Signal (rein lokal): die Match-Liste entscheidet', () => {
    expect(getMatchStartState(planned())).toBe('not-started');
  });

  it('matches zeigen angepfiffen, Live-Lesen fehlgeschlagen: angepfiffen', () => {
    expect(getMatchStartState([matchWith('finished')], { status: 'error' })).toBe('started');
  });

  it('matches unbekannt, Live-Stand leer: nicht feststellbar', () => {
    expect(getMatchStartState([matchWith('irgendwas')], { status: 'ok', anyStarted: false })).toBe(
      'unknown'
    );
  });
});
