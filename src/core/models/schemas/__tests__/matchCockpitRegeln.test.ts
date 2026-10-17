/**
 * ZA-0 – Regel-Felder „Spiel leiten“ (Vorgaben, Zod-Schema).
 *
 * Testwerte und Wortlaut stammen aus den Gherkin-Szenarien der Anforderung
 * (docs/anforderungen/2026-10-02_spiel-leiten.md, 2026-09-27_wizard-regelinhalte.md),
 * nicht aus dem Code. Jede Kennung hat mindestens ein Gegenbeispiel.
 */
import { describe, it, expect } from 'vitest';
import { TournamentCreationService } from '../../../services/TournamentCreationService';
import { TournamentSchema } from '../TournamentSchema';
import { ITournamentRepository } from '../../../repositories/ITournamentRepository';
import {
  DEFAULT_MATCH_COCKPIT_SETTINGS,
  completeMatchCockpitSettings,
} from '../../../../types/tournament';
import type { ClockMode } from '../../../match/clockDisplay';
import { serverRules } from '../../../match/client/serverRules';

const service = new TournamentCreationService({} as ITournamentRepository);

/**
 * Neues Turnier wie im Wizard angelegt (über den Service, nicht über Testdaten).
 * Ein neuer Entwurf speichert keine Cockpit-Konfiguration; wie im Cockpit gilt dann die Vorgabe.
 */
function neuesTurnier() {
  const entwurf = service.createDraft({ title: 'Hallencup' });
  const vorgaben = completeMatchCockpitSettings(entwurf.matchCockpitSettings) ?? DEFAULT_MATCH_COCKPIT_SETTINGS;
  return { ...entwurf, matchCockpitSettings: vorgaben };
}

/** Minimal gültiges Turnier mit den gegebenen Cockpit-Einstellungen, für das Zod-Schema. */
function turnierMit(settings: unknown) {
  return {
    id: 't-1',
    title: 'Hallencup',
    teams: [],
    matches: [],
    sport: 'football',
    sportId: 'football',
    tournamentType: 'classic',
    mode: 'classic',
    createdAt: '2026-10-17T10:00:00.000Z',
    updatedAt: '2026-10-17T10:00:00.000Z',
    matchCockpitSettings: settings,
  };
}

describe('@SL-002 / @W2A-035 Uhr-Art als Turnierregel', () => {
  it('@SL-002 ein neues Turnier hat die Uhr-Art „durchlaufend, letzte Minute angehalten“', () => {
    expect(neuesTurnier().matchCockpitSettings?.clockMode).toBe('durchlaufend-letzte-minute-angehalten');
  });

  it('@W2A-035 wählbar sind außerdem „immer durchlaufend“ und „immer angehalten“', () => {
    for (const wert of ['immer-durchlaufend', 'immer-angehalten']) {
      const ergebnis = TournamentSchema.safeParse(turnierMit({ clockMode: wert }));
      expect(ergebnis.success, wert).toBe(true);
    }
  });

  it('@W2A-035 Gegenbeispiel: eine Uhr-Art außerhalb der drei Werte wird abgelehnt', () => {
    const ergebnis = TournamentSchema.safeParse(turnierMit({ clockMode: 'immer-stehend' }));
    expect(ergebnis.success).toBe(false);
  });

  it('@SL-002 die Uhr-Art ist derselbe Typ wie im Cockpit-Hinweis (ClockMode)', () => {
    const wert: ClockMode = neuesTurnier().matchCockpitSettings?.clockMode ?? 'immer-angehalten';
    expect(wert).toBe('durchlaufend-letzte-minute-angehalten');
  });
});

describe('@SL-024 Kartenarten einzeln schaltbar', () => {
  const KARTENARTEN = ['yellow', 'yellowRed', 'red', 'timePenalty'] as const;

  it('@SL-024 ein neues Turnier hat Gelb, Gelb-Rot, Rot und Zeitstrafe eingeschaltet', () => {
    const karten = neuesTurnier().matchCockpitSettings?.enabledCards;
    expect(karten).toEqual({ yellow: true, yellowRed: true, red: true, timePenalty: true });
  });

  it.each(KARTENARTEN)('@SL-024 %s lässt sich einzeln ausschalten, die übrigen bleiben an', (art) => {
    const ergebnis = TournamentSchema.safeParse(turnierMit({ enabledCards: { [art]: false } }));
    expect(ergebnis.success).toBe(true);
    const vervollstaendigt = completeMatchCockpitSettings({ enabledCards: { [art]: false } });
    for (const andere of KARTENARTEN.filter((k) => k !== art)) {
      expect(vervollstaendigt?.enabledCards[andere]).toBe(true);
    }
    expect(vervollstaendigt?.enabledCards[art]).toBe(false);
  });

  it('@SL-024 Gegenbeispiel: ein Kartenschalter ohne Wahrheitswert wird abgelehnt', () => {
    const ergebnis = TournamentSchema.safeParse(turnierMit({ enabledCards: { red: 'aus' } }));
    expect(ergebnis.success).toBe(false);
  });
});

describe('@SL-101 / @W2A-037 Foul-Grenze', () => {
  it('@SL-101 ein neues Turnier hat die Foul-Grenze beim 5. Foul je Halbzeit', () => {
    expect(neuesTurnier().matchCockpitSettings?.foulLimit).toBe(5);
  });

  it('@SL-101 die Foul-Grenze lässt sich ausschalten (null = aus)', () => {
    const ergebnis = TournamentSchema.safeParse(turnierMit({ foulLimit: null }));
    expect(ergebnis.success).toBe(true);
    expect(completeMatchCockpitSettings({ foulLimit: null })?.foulLimit).toBeNull();
  });

  it('@W2A-037 eine andere Grenze ist einstellbar', () => {
    expect(TournamentSchema.safeParse(turnierMit({ foulLimit: 3 })).success).toBe(true);
  });

  it.each([0, -1, 2.5])('@W2A-037 Gegenbeispiel: Grenze %s wird abgelehnt', (wert) => {
    expect(TournamentSchema.safeParse(turnierMit({ foulLimit: wert })).success).toBe(false);
  });
});

describe('@W2A-013 Zeitstrafe endet beim Gegentor', () => {
  it('@W2A-013 die Regel ist im neuen Turnier eingeschaltet', () => {
    expect(neuesTurnier().matchCockpitSettings?.penaltyEndsOnGoal).toBe(true);
  });

  it('@W2A-013 Gegenbeispiel: ausgeschaltet bleibt ausgeschaltet', () => {
    expect(completeMatchCockpitSettings({ penaltyEndsOnGoal: false })?.penaltyEndsOnGoal).toBe(false);
    expect(TournamentSchema.safeParse(turnierMit({ penaltyEndsOnGoal: false })).success).toBe(true);
  });
});

describe('@W2A-017 Unterzahl nach Gelb-Rot oder Rot', () => {
  it('@W2A-017 die Unterzahl-Dauer ist im Grundprofil 120 Sekunden (2 Minuten)', () => {
    expect(neuesTurnier().matchCockpitSettings?.shortHandedSeconds).toBe(120);
  });

  it('@W2A-017 Gegenbeispiel: eine negative Dauer wird abgelehnt', () => {
    expect(TournamentSchema.safeParse(turnierMit({ shortHandedSeconds: -5 })).success).toBe(false);
  });
});

describe('@W2A-038 Abpfiff-Ton und Vibration als Vorbelegung', () => {
  it('@W2A-038 neue Turniere haben Abpfiff-Ton und Vibration eingeschaltet', () => {
    expect(neuesTurnier().matchCockpitSettings?.soundEnabled).toBe(true);
    expect(neuesTurnier().matchCockpitSettings?.hapticEnabled).toBe(true);
  });
});

describe('Fixrunde A2: unbekannte Schlüssel in enabledCards bleiben', () => {
  it('ein Zusatzschlüssel in enabledCards geht beim Parsen nicht verloren', () => {
    const ergebnis = TournamentSchema.parse(turnierMit({ enabledCards: { red: false, zukunft: 'x' } }));
    expect(ergebnis.matchCockpitSettings).toHaveProperty('enabledCards.zukunft', 'x');
    expect(ergebnis.matchCockpitSettings).toHaveProperty('enabledCards.red', false);
  });
});

describe('Fixrunde A4a: Client-Vorgabe = SQL-Rückfall für Schützen und Sudden Death', () => {
  const eingabe = (config: unknown) => ({
    durationMinutes: null,
    phase: 'final',
    groupPhaseDuration: 10,
    finalRoundDuration: 10,
    config,
    finalsConfig: null,
  });

  it('ergänzte Vorgaben ergeben dieselben Regeln wie ein Turnier ohne Cockpit-Konfiguration (5 / 6)', () => {
    const ohneKonfig = serverRules(eingabe({}));
    const mitVorgaben = serverRules(eingabe({ matchCockpitSettings: completeMatchCockpitSettings({}) }));
    expect(mitVorgaben).toEqual(ohneKonfig);
    expect(ohneKonfig.shootersPerTeam).toBe(5);
    expect(ohneKonfig.suddenDeathAfter).toBe(6);
  });
});

describe('Gegenbeispiel: alte Konfiguration ohne die neuen Felder', () => {
  it('fehlende Felder bekommen die Vorgaben, es wird nichts geworfen', () => {
    const alt = { penaltyShootersPerTeam: 5, timerDirection: 'countdown' };
    expect(() => TournamentSchema.parse(turnierMit(alt))).not.toThrow();
    // Datenverlust-Schutz: unbekannte Schlüssel der Konfiguration bleiben beim Parsen erhalten.
    expect(TournamentSchema.parse(turnierMit(alt)).matchCockpitSettings).toHaveProperty('timerDirection', 'countdown');

    const vervollstaendigt = completeMatchCockpitSettings(alt);
    expect(vervollstaendigt?.clockMode).toBe(DEFAULT_MATCH_COCKPIT_SETTINGS.clockMode);
    expect(vervollstaendigt?.foulLimit).toBe(5);
    expect(vervollstaendigt?.enabledCards).toEqual(DEFAULT_MATCH_COCKPIT_SETTINGS.enabledCards);
    expect(vervollstaendigt?.penaltyEndsOnGoal).toBe(true);
    expect(vervollstaendigt?.shortHandedSeconds).toBe(120);
    expect(vervollstaendigt?.penaltyShootersPerTeam).toBe(5);
  });

  it('fehlt die Konfiguration ganz, bleibt sie undefined (Verbraucher nehmen die Vorgaben)', () => {
    expect(completeMatchCockpitSettings(undefined)).toBeUndefined();
    expect(completeMatchCockpitSettings(null)).toBeUndefined();
    expect(completeMatchCockpitSettings([1, 2])).toBeUndefined();
  });
});
