/**
 * B-14 (@ZM-001): Vorbelegung der Zuschauer-Inhalte. Dieselbe Datei `publicContentDefaults.json` prüft der Container-Beweis
 * gegen die Server-Funktion `public_view.switches('{}')` (scripts/public-payload-check.sh, Kategorie P).
 */
import { describe, expect, it } from 'vitest';
import { PUBLIC_CONTENT_DEFAULTS, publicContentSwitchesOf } from '../publicContentSwitches';
import defaults from '../publicContentDefaults.json';

describe('Zuschauer-Schalter (B-14)', () => {
  const vorbelegung = publicContentSwitchesOf({});

  it.each([
    ['@ZM-001 Gruppentabellen', 'tables', true],
    ['@ZM-001 Finalrunde mit Herkunft', 'tables', true],
    ['@ZM-001 Live-Stand laufender Spiele mit Spielzeit', 'liveScore', true],
    ['@ZM-001 Ereignisse je Spiel', 'events', true],
    ['@ZM-001 Torschützen – Zwischenstand', 'scorers', false],
  ] as const)('%s: Vorbelegung ohne veränderten Schalter', (_name, key, expected) => {
    expect(vorbelegung[key]).toBe(expected);
  });

  it('@ZM-001 Spielplan: immer an, ohne Schalter (kein Schlüssel im Schalter-Satz)', () => {
    expect(Object.keys(vorbelegung).sort()).toEqual(['events', 'kidsMode', 'liveScore', 'scorers', 'tables']);
    expect(vorbelegung.kidsMode).toBe(false);
  });

  it('@ZM-001 Vorbelegung = gemeinsame Datei mit dem Server (publicContentDefaults.json)', () => {
    expect(vorbelegung).toEqual(defaults);
    expect(PUBLIC_CONTENT_DEFAULTS).toEqual(defaults);
  });

  it('@ZM-001 Gegenbeispiel: gesetzte Schalter überstimmen die Vorbelegung', () => {
    expect(publicContentSwitchesOf({
      hideScoresForPublic: true, hideRankingsForPublic: true, publicLiveScore: false, publicEvents: false, publicScorers: true,
    })).toEqual({ kidsMode: true, tables: false, liveScore: false, events: false, scorers: true });
  });

  it('@ZM-001 nur echte Wahrheitswerte zählen (wie am Server), sonst Vorbelegung', () => {
    expect(publicContentSwitchesOf({ publicScorers: 'true', publicEvents: 0, hideRankingsForPublic: 'ja' })).toEqual(vorbelegung);
    expect(publicContentSwitchesOf(null)).toEqual(vorbelegung);
  });
});
