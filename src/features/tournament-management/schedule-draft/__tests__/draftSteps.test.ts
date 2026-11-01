/**
 * Entwurf des Spielplan-Bearbeitens (rein): @ZP-100 Tausch von Uhrzeit und Feld, @ZP-102 Speichern lässt Änderungen an
 * inzwischen angepfiffenen Spielen aus und nennt sie, @ZP-093 angepfiffene Spiele bleiben stehen.
 */
import { describe, it, expect } from 'vitest';
import type { TFunction } from 'i18next';
import { applyDraftSteps, diffStep, fieldStep, refereeStep, swapPhaseOf, swapStep, type DraftStep } from '../draftSteps';
import { describeSkipped, matchNumberLookup } from '../draftTexts';
import { at, hallencup, matchOf } from './draftFixture';

/** Übersetzung wie im Test-Setup: Schlüssel mit eingesetzten Werten */
const t = ((key: string, opts?: Record<string, unknown>) =>
  Object.entries(opts ?? {}).reduce((s, [k, v]) => s.replace(`{{${k}}}`, String(v)), key)) as unknown as TFunction<'tournament'>;

const step = (s: DraftStep | null): DraftStep => {
  if (!s) { throw new Error('kein Schritt'); }
  return s;
};

describe('@ZP-100 Tausch per Ziehen: Uhrzeit und Feld wechseln', () => {
  it('@ZP-100 Spiel 6 auf Spiel 3 gezogen: beide tauschen Uhrzeit und Feld, die anderen Spiele bleiben', () => {
    const base = hallencup();
    const { tournament, skipped } = applyDraftSteps(base, [step(swapStep(base, 's6', 's3'))]);
    expect(matchOf(tournament, 's6')).toMatchObject({ scheduledTime: at(12), field: 1 });
    expect(matchOf(tournament, 's3')).toMatchObject({ scheduledTime: at(24), field: 2 });
    expect(matchOf(tournament, 's5')).toEqual(matchOf(base, 's5'));
    expect(skipped).toEqual([]);
  });

  it('@ZP-100 der Entwurf ändert das gespeicherte Turnier nicht (erst „Speichern“)', () => {
    const base = hallencup();
    applyDraftSteps(base, [step(swapStep(base, 's6', 's3'))]);
    expect(matchOf(base, 's6')).toMatchObject({ scheduledTime: at(24), field: 2 });
  });

  it('@ZP-100 Gegenbeispiel: ein Spiel mit sich selbst ergibt keinen Schritt', () => {
    expect(swapStep(hallencup(), 's3', 's3')).toBeNull();
  });
});

describe('@ZP-102 Speichern übernimmt den Rest und nennt, was angepfiffen ist', () => {
  // Gegeben: Spiel 6 und 9 getauscht, SR von Spiel 4 geändert; Tom hat Spiel 6 inzwischen angepfiffen
  const entwurf = () => {
    const vorher = hallencup();
    return [step(swapStep(vorher, 's6', 's9')), step(refereeStep(vorher, 's4', 3))];
  };

  it('@ZP-102 die Änderung an Spiel 4 wird übernommen, der Tausch mit dem angepfiffenen Spiel 6 nicht', () => {
    const jetzt = hallencup({}, { 6: { matchStatus: 'running' } });
    const { tournament, skipped, appliedSteps } = applyDraftSteps(jetzt, entwurf());
    expect(matchOf(tournament, 's4').referee).toBe(3);
    expect(tournament.refereeConfig?.manualAssignments).toEqual({ s4: 3 });
    expect(matchOf(tournament, 's6')).toMatchObject({ scheduledTime: at(24), field: 2 });
    expect(matchOf(tournament, 's9')).toMatchObject({ scheduledTime: at(48), field: 1 });
    expect(appliedSteps).toBe(1);
    expect(skipped).toEqual([{ kind: 'swap', matchIds: ['s6', 's9'], startedIds: ['s6'], changedIds: [] }]);
  });

  it('@ZP-102 die Meldung nennt den Tausch mit Spielnummern und dass Spiel 6 angepfiffen ist', () => {
    const jetzt = hallencup({}, { 6: { matchStatus: 'paused' } });
    const { skipped } = applyDraftSteps(jetzt, entwurf());
    expect(describeSkipped(skipped, matchNumberLookup(jetzt.matches), t)).toBe('draft.skipped.swap – draft.skipped.started');
    const text = describeSkipped(skipped, matchNumberLookup(jetzt.matches), ((k: string, o?: Record<string, unknown>) => `${k}:${JSON.stringify(o)}`) as unknown as TFunction<'tournament'>);
    expect(text).toContain('draft.skipped.swap:{"a":6,"b":9}');
    expect(text).toContain('draft.skipped.started:{"number":6}');
  });

  it('@ZP-102 Gegenbeispiel: ist nichts angepfiffen, wird alles übernommen und nichts gemeldet', () => {
    const { tournament, skipped, appliedSteps } = applyDraftSteps(hallencup(), entwurf());
    expect(appliedSteps).toBe(2);
    expect(skipped).toEqual([]);
    expect(matchOf(tournament, 's6')).toMatchObject({ scheduledTime: at(48), field: 1 });
  });
});

describe('@ZP-106 eine inzwischen auf einem anderen Gerät geänderte Zeit wird nicht still überschrieben', () => {
  const entwurf = () => {
    const vorher = hallencup();
    return [step(swapStep(vorher, 's6', 's9')), step(refereeStep(vorher, 's4', 3))];
  };

  it('@ZP-106 Ute hat Spiel 9 inzwischen verschoben (noch nicht angepfiffen): der Tausch entfällt, wird genannt, Spiel 9 bleibt auf der neuen Zeit', () => {
    const jetzt = hallencup({}, { 9: { scheduledTime: at(70) } });
    const { tournament, skipped } = applyDraftSteps(jetzt, entwurf());
    expect(matchOf(tournament, 's9').scheduledTime).toEqual(at(70));
    expect(matchOf(tournament, 's6').scheduledTime).toEqual(at(24));
    expect(matchOf(tournament, 's4').referee).toBe(3);
    expect(skipped).toEqual([{ kind: 'swap', matchIds: ['s6', 's9'], startedIds: [], changedIds: ['s9'] }]);
    const text = describeSkipped(skipped, matchNumberLookup(jetzt.matches), ((k: string, o?: Record<string, unknown>) => `${k}:${JSON.stringify(o)}`) as unknown as TFunction<'tournament'>);
    expect(text).toContain('draft.skipped.changedElsewhere:{"number":9}');
  });

  it('@ZP-106 ein anderswo geänderter Schiedsrichter wird nicht überschrieben, samt Hand-Zuteilung', () => {
    const jetzt = hallencup({}, { 4: { referee: 1 } });
    const { tournament, skipped } = applyDraftSteps(jetzt, entwurf());
    expect(matchOf(tournament, 's4').referee).toBe(1);
    expect(tournament.refereeConfig?.manualAssignments?.s4).toBeUndefined();
    expect(skipped.map((s) => s.changedIds)).toEqual([['s4']]);
  });

  it('@ZP-106 Gegenbeispiel: eine Änderung an einem anderen Spiel (Spiel 2) hindert nichts', () => {
    const jetzt = hallencup({}, { 2: { scheduledTime: at(70), field: 1, referee: 3 } });
    const { tournament, skipped, appliedSteps } = applyDraftSteps(jetzt, entwurf());
    expect(skipped).toEqual([]);
    expect(appliedSteps).toBe(2);
    expect(matchOf(tournament, 's6').scheduledTime).toEqual(at(48));
  });
});

describe('@ZP-093 angepfiffene Spiele bleiben im Entwurf stehen', () => {
  it.each(['running', 'paused', 'finished'] as const)('@ZP-093 neu verteilen lässt Spiel 5 (%s) aus, die übrigen Einträge gelten', (status) => {
    const jetzt = hallencup({}, { 5: { matchStatus: status } });
    const verteilen: DraftStep = { kind: 'redistributeFields', atomic: false, patches: [{ matchId: 's5', field: 2, from: { field: 1 } }, { matchId: 's7', field: 2, from: { field: 1 } }] };
    const { tournament, skipped } = applyDraftSteps(jetzt, [verteilen]);
    expect(matchOf(tournament, 's5').field).toBe(1);
    expect(matchOf(tournament, 's7').field).toBe(2);
    expect(skipped).toEqual([{ kind: 'redistributeFields', matchIds: ['s5'], startedIds: ['s5'], changedIds: [] }]);
  });

  it('@ZP-093 ein vorgemerkter Feldwechsel eines inzwischen beendeten Spiels wird nicht gespeichert', () => {
    const vorher = hallencup();
    const jetzt = hallencup({}, { 5: { matchStatus: 'finished' } });
    const { tournament } = applyDraftSteps(jetzt, [step(fieldStep(vorher, 's5', 2))]);
    expect(matchOf(tournament, 's5').field).toBe(1);
    expect(tournament.fieldAssignments?.s5).toBeUndefined();
  });

  it('@ZP-093 Gegenbeispiel: bei einem geplanten Spiel gilt der Feldwechsel', () => {
    const base = hallencup();
    const { tournament } = applyDraftSteps(base, [step(fieldStep(base, 's5', 2))]);
    expect(matchOf(tournament, 's5').field).toBe(2);
    expect(tournament.fieldAssignments?.s5).toBe(2);
  });
});

describe('@ZP-107 Phase', () => {
  it('@ZP-107 Gruppenspiel und Finalspiel gehören zu verschiedenen Phasen, Halbfinale und Finale zur selben', () => {
    expect(swapPhaseOf({ phase: 'groupStage' })).not.toBe(swapPhaseOf({ phase: 'semifinal', isFinal: true }));
    expect(swapPhaseOf({ phase: 'semifinal' })).toBe(swapPhaseOf({ phase: 'final' }));
    expect(swapPhaseOf({ isFinal: true })).toBe('finals');
    expect(swapPhaseOf({})).toBe('group');
  });
});

describe('@ZP-101 Raster: Ablegen wird ein Schritt im Entwurf', () => {
  it('@ZP-101 der Unterschied zweier Spiellisten ergibt einen Schritt mit Uhrzeit und Feld', () => {
    const base = hallencup();
    const nachher = base.matches.map((m) => (m.id === 's3' ? { ...m, scheduledTime: at(60), field: 2 } : m));
    expect(diffStep(base.matches, nachher)).toEqual({ kind: 'move', atomic: true, patches: [{ matchId: 's3', scheduledTime: at(60), field: 2, from: { scheduledTime: at(12), field: 1 } }] });
  });

  it('@ZP-104 Gegenbeispiel: ohne Unterschied entsteht kein Schritt', () => {
    const base = hallencup();
    expect(diffStep(base.matches, base.matches.map((m) => ({ ...m })))).toBeNull();
    expect(refereeStep(base, 's4', matchOf(base, 's4').referee ?? null)).toBeNull();
    expect(fieldStep(base, 's4', matchOf(base, 's4').field)).toBeNull();
  });
});
