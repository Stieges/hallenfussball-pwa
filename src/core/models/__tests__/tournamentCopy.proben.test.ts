/**
 * Kopie fürs Proben (Paket KP) – Szenarien @W5-024 bis @W5-027 aus
 * docs/anforderungen/2026-09-27_wizard-nach-dem-anlegen.md; Befunde C-COPY-DASH, C-COPY-AC-ID,
 * C-KOPIE-ERGEBNISSE, C-COPY-AC-FELDER. Geschrieben aus dem Gherkin, nicht am Code abgelesen.
 */
import { describe, it, expect } from 'vitest';
import { buildCopiedTournament } from '../tournamentCopy';
import { categorizeTournament, isTournamentCompleted } from '../../../utils/tournamentCategories';
import {
  hallencupOstGespielt, OST_ID, OST_CODE, OST_TEAM_A, OST_TEAM_B, OST_M_GRUPPE, OST_M_FINALE,
} from '../__fixtures__/hallencupOstGespielt';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const NOW = '2026-11-20T10:00:00.000Z';
const NEW_ID = crypto.randomUUID();

function kopieVon(original = hallencupOstGespielt()) {
  return buildCopiedTournament(original, { newId: NEW_ID, title: 'Hallencup Ost (Kopie)', now: NOW, makeId: () => crypto.randomUUID() });
}

describe('@W5-024 Kopie übernimmt keine Freigabe', () => {
  it('@W5-024 die Kopie ist nicht öffentlich und trägt nicht den Freigabe-Code des Hallencup Ost', () => {
    const kopie = kopieVon();
    expect(kopie.isPublic).toBe(false);
    expect(kopie.shareCode).not.toBe(OST_CODE);
    expect(kopie.shareCode).toBeUndefined(); // eigener Code entsteht erst bei der Freigabe (serverseitig, ohne Migration)
    expect(kopie.shareCodeCreatedAt).toBeUndefined();
  });

  it('@W5-024 Gegenbeispiel: der Freigabe-Code des Hallencup Ost führt weiter zum Hallencup Ost (Original unverändert)', () => {
    const original = hallencupOstGespielt();
    kopieVon(original);
    expect(original).toEqual(hallencupOstGespielt());
    expect(original.shareCode).toBe(OST_CODE);
    expect(original.isPublic).toBe(true);
    expect(original.id).toBe(OST_ID);
  });

  it('@W5-024 C-COPY-AC-FELDER: nirgends in der Kopie steht der alte Freigabe-Code', () => {
    expect(JSON.stringify(kopieVon())).not.toContain(OST_CODE);
  });
});

describe('@W5-025 Eine Kopie fürs Proben startet leer', () => {
  it('@W5-025 alle Spiele sind geplant und ohne Ergebnis, Tor, Karte', () => {
    const kopie = kopieVon();
    expect(kopie.matches).toHaveLength(2);
    for (const spiel of kopie.matches) {
      expect(spiel.matchStatus).toBe('scheduled');
      expect(spiel.scoreA).toBeUndefined(); // kein Ergebnis, auch kein 0:0 (C-COPY-DASH)
      expect(spiel.scoreB).toBeUndefined();
      expect(spiel.events).toEqual([]);
    }
  });

  it('@W5-025 C-KOPIE-ERGEBNISSE: keine Abschluss-, Entscheidungs-, Verlängerungs-, Timer- oder Korrekturfelder', () => {
    for (const spiel of kopieVon().matches) {
      for (const feld of [
        'finishedAt', 'decidedBy', 'correctionHistory', 'overtimeScoreA', 'overtimeScoreB', 'penaltyScoreA', 'penaltyScoreB',
        'timerStartTime', 'timerPausedAt', 'timerElapsedSeconds', 'skippedReason', 'skippedAt', 'liveState', 'kit',
      ] as const) {
        expect(spiel[feld], feld).toBeUndefined();
      }
    }
  });

  it('@W5-025 C-COPY-AC-FELDER: das Turnier ist nicht abgeschlossen, nicht abgebrochen, ohne Endstand-Schnappschuss', () => {
    const kopie = kopieVon();
    for (const feld of ['manuallyCompleted', 'completedAt', 'cancelledAt', 'cancelledReason', 'statsSnapshot', 'dashboardStatus', 'deletedAt'] as const) {
      expect(kopie[feld], feld).toBeUndefined();
    }
  });

  it('@W5-025 die Kopie steht auf der Startseite bei „kommend“, nicht bei „beendet“ oder „Entwurf“', () => {
    const original = hallencupOstGespielt();
    expect(isTournamentCompleted(original)).toBe(true); // Ausgangslage: abgeschlossen
    expect(isTournamentCompleted(kopieVon(original))).toBe(false);
    expect(categorizeTournament(kopieVon(original), new Date('2026-11-20T10:00:00Z'))).toBe('upcoming');
  });

  it('@W5-025 C-COPY-DASH: kein Spiel wirkt gespielt (kein 0:0 mit Ergebnisstatus), Struktur bleibt änderbar', () => {
    const kopie = kopieVon();
    expect(kopie.matches.every((spiel) => spiel.matchStatus === 'scheduled' && spiel.finishedAt === undefined)).toBe(true);
  });

  it('@W5-025 Gegenbeispiel: das Original behält Ergebnisse, Abschluss und Status', () => {
    const original = hallencupOstGespielt();
    kopieVon(original);
    expect(original).toEqual(hallencupOstGespielt());
    expect(original.matches[0]).toMatchObject({ scoreA: 3, scoreB: 1, matchStatus: 'finished', decidedBy: 'penalty' });
    expect(original.completedAt).toBeDefined();
  });
});

describe('Kopie übernimmt Teams, Gruppen, Spielplan und Regeln (Gegenbeispiel: nicht leergeräumt)', () => {
  it('Teams: gleiche Namen und Gruppen, neue IDs', () => {
    const kopie = kopieVon();
    expect(kopie.teams.map((team) => [team.name, team.group])).toEqual([['FC Nord', 'A'], ['VfB Ufer', 'A']]);
    expect(kopie.teams.map((team) => team.id)).not.toContain(OST_TEAM_A);
    expect(kopie.teams.map((team) => team.id)).not.toContain(OST_TEAM_B);
  });

  it('Gruppen, Felder, Sponsoren, Punktesystem und Cockpit-Regeln sind übernommen', () => {
    const original = hallencupOstGespielt();
    const kopie = kopieVon(original);
    expect(kopie.groups).toEqual(original.groups);
    expect(kopie.fields).toEqual(original.fields);
    expect(kopie.sponsors).toEqual(original.sponsors);
    expect(kopie.pointSystem).toEqual(original.pointSystem);
    expect(kopie.matchCockpitSettings).toEqual(original.matchCockpitSettings);
    expect(kopie.startDate).toBe(original.startDate);
    expect(kopie.startTime).toBe(original.startTime);
  });

  it('Spielplan: gleiche Reihenfolge, Runden, Felder, Gruppen; Verweise zeigen auf die neuen Spiele', () => {
    const kopie = kopieVon();
    expect(kopie.matches.map((spiel) => [spiel.round, spiel.field, spiel.group])).toEqual([[1, 1, 'A'], [2, 1, undefined]]);
    const [gruppe, finale] = kopie.matches;
    expect(finale.slotA).toMatchObject({ source: { kind: 'matchResult', matchId: gruppe.id, role: 'winner' } });
    const json = JSON.stringify(kopie);
    for (const alt of [OST_TEAM_A, OST_TEAM_B, OST_M_GRUPPE, OST_M_FINALE, OST_ID]) { expect(json).not.toContain(alt); }
  });

  it('Feld- und Schiedsrichter-Zuweisungen hängen an den NEUEN Spiel-IDs', () => {
    const kopie = kopieVon();
    const neueGruppenspielId = kopie.matches[0].id;
    expect(kopie.fieldAssignments).toEqual({ [neueGruppenspielId]: 1 });
    expect(kopie.refereeConfig?.manualAssignments).toEqual({ [neueGruppenspielId]: 2 });
  });
});

describe('C-COPY-AC-ID: echte UUIDs', () => {
  it('Turnier-, Team- und Spiel-IDs der Kopie sind UUID v4 und alle verschieden vom Original', () => {
    const kopie = kopieVon();
    const ids = [kopie.id, ...kopie.teams.map((team) => team.id), ...kopie.matches.map((spiel) => spiel.id)];
    for (const id of ids) { expect(id).toMatch(UUID); }
    expect(new Set(ids).size).toBe(ids.length);
    expect(kopie.id).not.toBe(OST_ID);
  });

  it('Zeitstempel und Titel der Kopie sind neu, Version/Änderungszählung des Originals reisen nicht mit', () => {
    const kopie = kopieVon();
    expect(kopie).toMatchObject({ title: 'Hallencup Ost (Kopie)', createdAt: NOW, updatedAt: NOW });
    expect(kopie.version).toBeUndefined();
    expect(kopie.changeRevision).toBeUndefined();
  });
});

describe('@W5-026 Helfer und Bildschirme gehören nicht zur Kopie', () => {
  it('@W5-026 die Monitore des Hallencup Ost stehen nicht in der Kopie („Monitore übernehmen“ holt sie)', () => {
    expect(kopieVon().monitors).toBeUndefined();
  });

  it('@W5-026 Gegenbeispiel: das Original behält seine Monitore', () => {
    const original = hallencupOstGespielt();
    kopieVon(original);
    expect(original.monitors).toHaveLength(1);
    expect(original.monitors?.[0].id).toBe('mon-1');
  });
});

describe('@W5-024 Status der Kopie: festgelegt bleibt festgelegt, ein Entwurf bleibt Entwurf', () => {
  it('Original veröffentlicht → Kopie ist festgelegt (spielbereit), aber nicht öffentlich', () => {
    const kopie = kopieVon();
    expect(kopie.status).toBe('published');
    expect(kopie.publishedAt).toBe(NOW);
  });

  it('Original Entwurf → Kopie bleibt Entwurf ohne Freigabe-Marker', () => {
    const entwurf = { ...hallencupOstGespielt(), status: 'draft' as const, publishedAt: undefined };
    const kopie = kopieVon(entwurf);
    expect(kopie.status).toBe('draft');
    expect(kopie.publishedAt).toBeUndefined();
  });
});
