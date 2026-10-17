/**
 * L6 (Cockpit-Spec § 10 L6, @SL-089, @W2A-020, @SL-111, @SL-128, @SL-131, @W2A-019):
 * Sperr-Hinweis nach Rot als reine Ableitung aus dem Engine-Zustand (nur wirksame Karten,
 * `CardRecord.type` – NICHT das RuntimeEvent, dort ist Gelb-Rot als `RED_CARD` abgebildet).
 *
 * Testwerte und Wortlaut aus dem Gherkin der Szenarien (docs/anforderungen/):
 * `2026-10-02_spiel-leiten.md` (@SL-089 Z. 884, @SL-128 Z. 405, @SL-131 Z. 436, @SL-111 Z. 1213)
 * und `2026-09-27_wizard-regelinhalte.md` (@W2A-019 Z. 176, @W2A-020 Z. 183).
 *
 * Zone 1 „Sperre" (spiel-leiten.md, wörtlich):
 * - „Gelb-Rot und Rot führen zur Unterzahl nach den Turnierregeln, Rot zeigt in späteren Spielen
 *   den Sperr-Hinweis (Record Regelinhalte)." (Z. 168-169)
 * - „… eine Karte nimmt dabei ihr Foul mit (Fundament), eine Rote Karte auch Unterzahl und
 *   Sperr-Hinweis." (Z. 208-210)
 * - „Sie zählen nirgends mehr: nicht im Ergebnis, nicht in der Tabelle, nicht bei den Torschützen,
 *   nicht in der Fair-Play-Tabelle und nicht für eine Sperre nach Rot, denn die Grundlage der
 *   Einträge besteht nicht mehr." (Z. 221-224)
 */
import { describe, it, expect } from 'vitest';
import { redCardSuspensions, type SperrHinweis, type SuspensionMatchRef } from '../suspensions';
import { reduceMatch } from '../reduceMatch';
import type { EngineEvent, MatchRules } from '../types';

const RULES: MatchRules = {
  sections: 2,
  sectionSeconds: 600,
  breakSeconds: 60,
  knockout: false,
  tiebreak: null,
  overtimeSeconds: 0,
  shootersPerTeam: 5,
  suddenDeathAfter: 5,
  penaltySeconds: 120,
};

function ev(partial: Partial<EngineEvent> & Pick<EngineEvent, 'id' | 'type' | 'at'>): EngineEvent {
  return { actor: 'helper', section: 1, clockMs: null, payload: {}, ...partial };
}

function anpfiff(id = 'start'): EngineEvent {
  return ev({ id, type: 'MATCH_START', at: 1000, payload: { rules: RULES } });
}

function rot(id: string, teamId: string, playerNumber: number | undefined, at = 2000): EngineEvent {
  return ev({
    id,
    type: 'RED_CARD',
    at,
    teamId,
    clockMs: 30_000,
    payload: playerNumber === undefined ? {} : { playerNumber },
  });
}

function gelbRot(id: string, teamId: string, playerNumber: number | undefined, at = 2000): EngineEvent {
  return ev({
    id,
    type: 'YELLOW_RED_CARD',
    at,
    teamId,
    clockMs: 30_000,
    payload: playerNumber === undefined ? {} : { playerNumber },
  });
}

function zurueck(targetId: string, at = 3000): EngineEvent {
  return ev({ id: `r-${targetId}`, type: 'RETRACT', at, targetId });
}

function spiel(id: string, matchNumber: number, heim: string, gast: string): SuspensionMatchRef {
  return { id, matchNumber, teamIds: [heim, gast] };
}

function zustand(log: readonly EngineEvent[], heim: string, gast: string, matchId = 'm'): MatchStateKarten {
  return reduceMatch(log, { matchId, teamAId: heim, teamBId: gast }).state;
}

type MatchStateKarten = ReturnType<typeof reduceMatch>['state'];

function zustandVon(logs: Record<string, readonly EngineEvent[]>, seiten: Record<string, [string, string]>): (matchId: string) => MatchStateKarten | undefined {
  return (matchId: string) => {
    const log = logs[matchId];
    const seite = seiten[matchId];
    if (log === undefined || seite === undefined) {
      return undefined;
    }
    return zustand(log, seite[0], seite[1], matchId);
  };
}

const SPIELE: SuspensionMatchRef[] = [
  spiel('spiel-4', 4, 'fc-nord', 'sv-sued'),
  spiel('spiel-11', 11, 'fc-nord', 'sv-sued'),
];

const LEER = { 'spiel-4': [anpfiff()], 'spiel-11': [anpfiff('start-11')] };
const SEITEN = { 'spiel-4': ['fc-nord', 'sv-sued'], 'spiel-11': ['fc-nord', 'sv-sued'] } as Record<string, [string, string]>;

describe('redCardSuspensions – Szenarien (Gherkin)', () => {
  it('@SL-089 Dann: „Nr. 7 ist für dieses Turnier gesperrt“ – Nummer 7 von FC Nord sah in Spiel 4 Rot, geöffnet wird Spiel 11', () => {
    // Gegeben die Nummer 7 von FC Nord hat in einem früheren Spiel Rot gesehen
    // Wenn Tom Spiel 11 öffnet
    const hinweise = redCardSuspensions(
      SPIELE,
      zustandVon({ ...LEER, 'spiel-4': [anpfiff(), rot('k1', 'fc-nord', 7)] }, SEITEN),
      'spiel-11',
    );
    expect(hinweise).toEqual([{ teamId: 'fc-nord', playerNumber: 7, ausSpielNummer: 4 }]);
  });

  it('@SL-089 Und / @W2A-020 Und: die Erfassung wird nicht verhindert – die Ableitung liefert nur den Hinweis und lässt den Zustand unangetastet', () => {
    // Und Tom kann für die Nummer 7 von FC Nord trotzdem ein Tor erfassen
    // Und die App verhindert die Erfassung nicht
    const log4 = [anpfiff(), rot('k1', 'fc-nord', 7)];
    const state4 = zustand(log4, 'fc-nord', 'sv-sued', 'spiel-4');
    const vorher = JSON.stringify(state4);
    const hinweise = redCardSuspensions(SPIELE, zustandVon({ ...LEER, 'spiel-4': log4 }, SEITEN), 'spiel-11');
    expect(hinweise).toEqual([{ teamId: 'fc-nord', playerNumber: 7, ausSpielNummer: 4 }]);
    expect(JSON.stringify(state4)).toBe(vorher);
  });

  it('@W2A-020 Dann: „Nr. 7 ist für dieses Turnier gesperrt“ – Spieler mit Rückennummer 7 von Team A hat im Turnier Rot gesehen', () => {
    const spiele = [spiel('spiel-2', 2, 'team-a', 'team-b'), spiel('spiel-5', 5, 'team-a', 'team-b')];
    const hinweise = redCardSuspensions(
      spiele,
      zustandVon({ 'spiel-2': [anpfiff(), rot('k1', 'team-a', 7)], 'spiel-5': [anpfiff('start-5')] }, {
        'spiel-2': ['team-a', 'team-b'],
        'spiel-5': ['team-a', 'team-b'],
      }),
      'spiel-5',
    );
    expect(hinweise).toEqual([{ teamId: 'team-a', playerNumber: 7, ausSpielNummer: 2 }]);
  });

  it('@SL-111 Und: „in späteren Spielen von SV Süd erscheint kein Sperr-Hinweis für Nr. 5“ – zurückgenommene Rote (echtes Log nach RETRACT)', () => {
    // Gegeben Tom hat für die Nummer 5 von SV Süd eine Rote Karte erfasst …
    // Wenn Tom diese Karte zurücknimmt
    // Dann … in späteren Spielen von SV Süd erscheint kein Sperr-Hinweis für Nr. 5
    const log4 = [anpfiff(), rot('k1', 'sv-sued', 5), zurueck('k1')];
    const state4 = zustand(log4, 'fc-nord', 'sv-sued', 'spiel-4');
    expect(state4.cards).toEqual([]);
    expect(
      redCardSuspensions(
        [spiel('spiel-4', 4, 'fc-nord', 'sv-sued'), spiel('spiel-11', 11, 'fc-nord', 'sv-sued')],
        zustandVon({ ...LEER, 'spiel-4': log4 }, SEITEN),
        'spiel-11',
      ),
    ).toEqual([]);
  });

  it('@SL-128 Beispiel „die Sperre nach Rot“: nach dem Zurücksetzen zählt kein Eintrag – Nummer 7 von SG Mitte ist nicht gesperrt', () => {
    // Gegeben Tom hat in Spiel 13 … für die Nummer 7 von SG Mitte eine Rote Karte erfasst
    // Wenn Olli Spiel 13 mit dem Grund „falsches Spiel angepfiffen“ zurücksetzt
    // Dann gilt die Sperre nach Rot: die Nummer 7 von SG Mitte ist nicht gesperrt
    const spiele = [spiel('spiel-13', 13, 'tsv-west', 'sg-mitte'), spiel('spiel-14', 14, 'sg-mitte', 'tsv-west')];
    const leerNachReset: EngineEvent[] = [];
    const hinweise = redCardSuspensions(
      spiele,
      zustandVon({ 'spiel-13': leerNachReset, 'spiel-14': [anpfiff('start-14')] }, {
        'spiel-13': ['tsv-west', 'sg-mitte'],
        'spiel-14': ['sg-mitte', 'tsv-west'],
      }),
      'spiel-14',
    );
    expect(hinweise).toEqual([]);
  });

  it('@SL-128 (Pflichttest Brief): Spiel 4 mit leerem Log (Zurücksetzen nachgestellt) → kein Sperr-Hinweis', () => {
    const leer = zustand([], 'fc-nord', 'sv-sued', 'spiel-4');
    expect(leer.cards).toEqual([]);
    expect(redCardSuspensions(SPIELE, () => leer, 'spiel-11')).toEqual([]);
  });

  it('@SL-131 Dann: „bleibt die Rote Karte aus Spiel 10 gültig und die Nummer 7 von SG Mitte ist weiter gesperrt“ – Spiel 13 zurückgesetzt', () => {
    // Gegeben die Nummer 7 von SG Mitte hat in Spiel 10 Rot gesehen und in Spiel 13 ein Tor erzielt
    // Wenn Olli Spiel 13 zurücksetzt
    const spiele = [
      spiel('spiel-10', 10, 'sg-mitte', 'tsv-west'),
      spiel('spiel-13', 13, 'tsv-west', 'sg-mitte'),
      spiel('spiel-14', 14, 'sg-mitte', 'tsv-west'),
    ];
    const hinweise = redCardSuspensions(
      spiele,
      zustandVon(
        {
          'spiel-10': [anpfiff('start-10'), rot('k10', 'sg-mitte', 7)],
          'spiel-13': [],
          'spiel-14': [anpfiff('start-14')],
        },
        {
          'spiel-10': ['sg-mitte', 'tsv-west'],
          'spiel-13': ['tsv-west', 'sg-mitte'],
          'spiel-14': ['sg-mitte', 'tsv-west'],
        },
      ),
      'spiel-14',
    );
    expect(hinweise).toEqual([{ teamId: 'sg-mitte', playerNumber: 7, ausSpielNummer: 10 }]);
  });

  it('@SL-131 (Pflichttest Brief): Rot in Spiel 4, Spiel 6 zurückgesetzt → Hinweis bleibt', () => {
    const spiele = [...SPIELE, spiel('spiel-6', 6, 'sv-sued', 'fc-nord')];
    const hinweise = redCardSuspensions(
      spiele,
      zustandVon(
        {
          ...LEER,
          'spiel-4': [anpfiff(), rot('k1', 'fc-nord', 7)],
          'spiel-6': [anpfiff('start-6')],
        },
        { ...SEITEN, 'spiel-6': ['sv-sued', 'fc-nord'] },
      ),
      'spiel-11',
    );
    expect(hinweise).toEqual([{ teamId: 'fc-nord', playerNumber: 7, ausSpielNummer: 4 }]);
  });
});

describe('redCardSuspensions – Gegenbeispiele (fast richtig)', () => {
  it('@W2A-019 Dann: „es wird kein Sperr-Hinweis angezeigt“ – Gelb-Rot Nr. 7 von Team A (gleiche Rückennummer, gleiches Team)', () => {
    // Gegeben ein Spieler von Team A hat in Spiel 3 Gelb-Rot gesehen
    // Wenn die Spielleitung das nächste Spiel von Team A öffnet
    const spiele = [spiel('spiel-3', 3, 'team-a', 'team-b'), spiel('spiel-4', 4, 'team-a', 'team-b')];
    const hinweise = redCardSuspensions(
      spiele,
      zustandVon({ 'spiel-3': [anpfiff(), gelbRot('k1', 'team-a', 7)], 'spiel-4': [anpfiff('start-4')] }, {
        'spiel-3': ['team-a', 'team-b'],
        'spiel-4': ['team-a', 'team-b'],
      }),
      'spiel-4',
    );
    expect(hinweise).toEqual([]);
  });

  it('Gegenbeispiel: Rote im aktuellen Spiel selbst erzeugt keinen Hinweis für dieses Spiel', () => {
    const hinweise = redCardSuspensions(
      SPIELE,
      zustandVon({ ...LEER, 'spiel-11': [anpfiff('start-11'), rot('k1', 'fc-nord', 7)] }, SEITEN),
      'spiel-11',
    );
    expect(hinweise).toEqual([]);
  });

  it('Gegenbeispiel: Rote im späteren Spiel 12 zählt nicht rückwärts', () => {
    const spiele = [...SPIELE, spiel('spiel-12', 12, 'fc-nord', 'sv-sued')];
    const hinweise = redCardSuspensions(
      spiele,
      zustandVon({ ...LEER, 'spiel-12': [anpfiff('start-12'), rot('k1', 'fc-nord', 7)] }, { ...SEITEN, 'spiel-12': ['fc-nord', 'sv-sued'] }),
      'spiel-11',
    );
    expect(hinweise).toEqual([]);
  });

  it('Gegenbeispiel: Rote des anderen Teams mit gleicher Rückennummer betrifft nur dieses Team', () => {
    const log4 = [anpfiff(), rot('k1', 'sv-sued', 7)];
    const hinweise = redCardSuspensions(SPIELE, zustandVon({ ...LEER, 'spiel-4': log4 }, SEITEN), 'spiel-11');
    expect(hinweise).toEqual([{ teamId: 'sv-sued', playerNumber: 7, ausSpielNummer: 4 }]);
    expect(hinweise.some((hinweis) => hinweis.teamId === 'fc-nord')).toBe(false);
  });

  it('Gegenbeispiel: gleiche Rückennummer bei beiden Teams ergibt je Team einen eigenen Hinweis', () => {
    const log4 = [anpfiff(), rot('k1', 'fc-nord', 7), rot('k2', 'sv-sued', 7, 2100)];
    const hinweise = redCardSuspensions(SPIELE, zustandVon({ ...LEER, 'spiel-4': log4 }, SEITEN), 'spiel-11');
    expect(hinweise).toEqual([
      { teamId: 'fc-nord', playerNumber: 7, ausSpielNummer: 4 },
      { teamId: 'sv-sued', playerNumber: 7, ausSpielNummer: 4 },
    ]);
  });

  it('Gegenbeispiel: zurückgenommene Rote erzeugt keinen Hinweis (echtes Log, kein handgebautes cards)', () => {
    const log4 = [anpfiff(), rot('k1', 'fc-nord', 7), zurueck('k1')];
    expect(redCardSuspensions(SPIELE, zustandVon({ ...LEER, 'spiel-4': log4 }, SEITEN), 'spiel-11')).toEqual([]);
  });

  it('Gegenbeispiel: Rot ohne Rückennummer erzeugt keinen Hinweis', () => {
    const log4 = [anpfiff(), rot('k1', 'fc-nord', undefined)];
    expect(redCardSuspensions(SPIELE, zustandVon({ ...LEER, 'spiel-4': log4 }, SEITEN), 'spiel-11')).toEqual([]);
  });

  it('Gegenbeispiel: Rot eines Teams, das nicht in Spiel 11 spielt, bleibt draußen', () => {
    const spiele = [...SPIELE, spiel('spiel-4b', 4, 'tsv-west', 'sg-mitte')];
    const hinweise = redCardSuspensions(
      spiele,
      zustandVon({ ...LEER, 'spiel-4b': [anpfiff('start-4b'), rot('k1', 'sg-mitte', 7)] }, {
        ...SEITEN,
        'spiel-4b': ['tsv-west', 'sg-mitte'],
      }),
      'spiel-11',
    );
    expect(hinweise).toEqual([]);
  });

  it('Dedupe: zweimal Rot (Spiel 2 und Spiel 4) ergibt einen Hinweis mit ausSpielNummer 2', () => {
    const spiele = [spiel('spiel-2', 2, 'fc-nord', 'sv-sued'), ...SPIELE];
    const hinweise = redCardSuspensions(
      spiele,
      zustandVon({ ...LEER, 'spiel-2': [anpfiff('start-2'), rot('k1', 'fc-nord', 7)] }, { ...SEITEN, 'spiel-2': ['fc-nord', 'sv-sued'] }),
      'spiel-11',
    );
    const mitSpiel4 = redCardSuspensions(
      spiele,
      zustandVon(
        { ...LEER, 'spiel-2': [anpfiff('start-2'), rot('k1', 'fc-nord', 7)], 'spiel-4': [anpfiff(), rot('k2', 'fc-nord', 7, 2100)] },
        { ...SEITEN, 'spiel-2': ['fc-nord', 'sv-sued'] },
      ),
      'spiel-11',
    );
    expect(hinweise).toEqual([{ teamId: 'fc-nord', playerNumber: 7, ausSpielNummer: 2 }]);
    expect(mitSpiel4).toEqual([{ teamId: 'fc-nord', playerNumber: 7, ausSpielNummer: 2 }]);
  });

  it('Reihenfolge stabil: Heim-Team des aktuellen Spiels zuerst, dann Rückennummer aufsteigend', () => {
    const spiele = [
      spiel('spiel-2', 2, 'sv-sued', 'fc-nord'),
      spiel('spiel-4', 4, 'sv-sued', 'fc-nord'),
      spiel('spiel-11', 11, 'sv-sued', 'fc-nord'),
    ];
    const hinweise = redCardSuspensions(
      spiele,
      zustandVon(
        {
          'spiel-2': [anpfiff('start-2'), rot('k1', 'fc-nord', 9), rot('k2', 'sv-sued', 3)],
          'spiel-4': [anpfiff(), rot('k3', 'fc-nord', 7), rot('k4', 'sv-sued', 10)],
          'spiel-11': [anpfiff('start-11')],
        },
        {
          'spiel-2': ['sv-sued', 'fc-nord'],
          'spiel-4': ['sv-sued', 'fc-nord'],
          'spiel-11': ['sv-sued', 'fc-nord'],
        },
      ),
      'spiel-11',
    );
    expect(hinweise).toEqual([
      { teamId: 'sv-sued', playerNumber: 3, ausSpielNummer: 2 },
      { teamId: 'sv-sued', playerNumber: 10, ausSpielNummer: 4 },
      { teamId: 'fc-nord', playerNumber: 7, ausSpielNummer: 4 },
      { teamId: 'fc-nord', playerNumber: 9, ausSpielNummer: 2 },
    ]);
  });

  it('Spiel ohne lokalen Zustand wird übersprungen (kein Wurf)', () => {
    const stateOf = (matchId: string) => (matchId === 'spiel-11' ? zustand([anpfiff('start-11')], 'fc-nord', 'sv-sued', 'spiel-11') : undefined);
    expect(redCardSuspensions(SPIELE, stateOf, 'spiel-11')).toEqual([]);
  });

  it('defensiv: ohne Eintrag des aktuellen Spiels in der Liste bleibt der Hinweis leer', () => {
    expect(redCardSuspensions(SPIELE, zustandVon({ ...LEER, 'spiel-4': [anpfiff(), rot('k1', 'fc-nord', 7)] }, SEITEN), 'spiel-99')).toEqual([]);
  });
});

describe('Barrel-Export (Schritt 3)', () => {
  it('src/core/match/index.ts exportiert redCardSuspensions und SperrHinweis', async () => {
    const kern = await import('..');
    const hinweis: SperrHinweis = { teamId: 'fc-nord', playerNumber: 7, ausSpielNummer: 4 };
    expect(typeof kern.redCardSuspensions).toBe('function');
    expect(kern.redCardSuspensions(SPIELE, zustandVon({ ...LEER, 'spiel-4': [anpfiff(), rot('k1', 'fc-nord', 7)] }, SEITEN), 'spiel-11')).toEqual([hinweis]);
  });
});
