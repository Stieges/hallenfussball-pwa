/**
 * A-15b (R2 PR 2): erneuter Abschluss nach einer angenommenen Korrektur, ohne Zutun. Aus dem Gherkin:
 * - @TM-150 (Record `2026-10-01_turniermodi`), Nikolaus-Art, Platz 1 auszuspielen, kein Folgespiel:
 *   Zeile 1 – SC Ost und TSV West gleich auf Platz 1 → „Besetzung prüfen“ bleibt, die Gruppe ist nicht neu abgeschlossen;
 *   Zeile 2 – SC Ost allein auf Platz 1 → die Gruppe ist neu abgeschlossen, ohne dass „Besetzung prüfen“ stehen bleibt.
 * - @TM-071: Korrektur einer abgeschlossenen Gruppe (FC Nord gegen SV Süd, danach Nord Erster, Süd Zweiter), ohne Wiederöffnen →
 *   die Gruppe bleibt abgeschlossen, nicht angepfiffene Folgespiele werden neu besetzt (Server: `complete_group`).
 * - @TM-145: Lage @W2A-048, Süd–West auf 2:2 korrigiert, beide weiter gleich → Entscheidung aufgehoben, Halbfinale 2 zeigt wieder
 *   „Zweiter Gruppe A“ (Plätze 2 und 3 offen).
 * - Rechte und Netz (A-15b-Brief, Risiko 6): nur das Gerät der Turnierleitung, nur mit Netz; mehrere Geräte/Ablehnung ohne Meldung
 *   und ohne Endlosversuch.
 * - Gast (Befund C-LOKALER-NEUABSCHLUSS-KEIN-ZWILLING): im lokalen Speicher ist eine Gruppe veraltet, wenn die Rangfolge nicht
 *   mehr passt.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import type { Tournament } from '../../types/tournament';
import type { CompleteGroupRequest, CompleteGroupResult } from '../../core/repositories/groupCompletionCloud';
import { useRecompletionAfterCorrection, type RecompletionDeps } from '../useRecompletionAfterCorrection';
import { completion, HC, tournamentFromFixture } from '../../core/standings/__tests__/groupCompletionKit';
import { id, league } from '../../core/standings/__tests__/fixtures';
import { ET021_GRUPPE_A, ET021_GRUPPE_B, zweiGruppen } from '../../core/standings/__tests__/tb4Kit';
import { activeRanking } from '../../core/services/GroupCompletionService';
import { reassignAfterCorrection, recompletionKey } from '../../core/services/followUps';
import { recompletionFailed, resetRecompletionFailures } from '../recompletionFailures';

beforeEach(() => { resetRecompletionFailures(); });

/** @TM-150: vier Teams genügen; Ergebnis West–Ost nach der Korrektur. */
const tm150 = (wOst: string): Tournament => {
  const { tournament } = league('WONB', `W–O ${wOst}; W–N 2:0; W–B 1:0; O–N 2:0; O–B 1:0; N–B 1:0`, { group: undefined });
  return { ...tournament, placementsToPlayOut: [1], groupCompletions: [completion('', [id('W'), id('O'), id('N'), id('B')], { stale: true })] };
};

/**
 * @TM-071: Gruppe A war abgeschlossen, nach der Korrektur ändern Erster und Zweiter die Plätze. Das Gherkin geht von 1. Nord, 2. Süd
 * nach 1. Süd, 2. Nord; die Fixture ET021 (Nord gewinnt alles) gibt die Ergebnisse nach der Korrektur fest vor, deshalb hier
 * gespiegelt: vorher 1. Süd, 2. Nord, danach Nord Erster (Review #384 N6, inhaltlich gleich: Erster und Zweiter tauschen).
 */
const tm071 = (stale: boolean): Tournament => {
  const t = zweiGruppen('NSWO', ET021_GRUPPE_A, 'MBUT', ET021_GRUPPE_B);
  return { ...t, placementsToPlayOut: [1], groupCompletions: [completion('A', [id('S'), id('N'), id('W'), id('O')], { stale })] };
};

/** @TM-145: Lage @W2A-048 (Hallencup Nord), Gruppe A abgeschlossen mit West vor Süd, nach der Korrektur wieder gleich. */
const tm145 = (): Tournament => ({ ...tournamentFromFixture('hallencup'), groupCompletions: [completion('A', [HC.nord, HC.west, HC.sued, HC.ost], { stale: true })] });

function setup(initial: Tournament, over: Partial<RecompletionDeps> = {}, answer: CompleteGroupResult = { status: 'ok', alreadyCompleted: false, changed: [] }) {
  const completeGroup = vi.fn<(id: string, request: CompleteGroupRequest) => Promise<CompleteGroupResult>>(() => Promise.resolve(answer));
  const onDone = vi.fn();
  const deps: RecompletionDeps = { completeGroup, canManage: true, online: true, local: false, onDone, ...over };
  const view = renderHook(({ t, d }: { t: Tournament; d: RecompletionDeps }) => { useRecompletionAfterCorrection(t, d); }, { initialProps: { t: initial, d: deps } });
  return { completeGroup, onDone, rerender: (t: Tournament, d: Partial<RecompletionDeps> = {}) => { view.rerender({ t, d: { ...deps, ...d } }); } };
}

const flush = () => new Promise<void>((resolve) => { setTimeout(resolve, 0); });

describe('@TM-150 der Auslöser nach einer Korrektur (Nikolaus-Art, Platz 1 auszuspielen)', () => {
  it('Zeile 2: SC Ost allein auf Platz 1 → ohne Zutun erneut abgeschlossen (eine Anfrage, keine offenen Plätze), danach frisch geladen', async () => {
    const { completeGroup, onDone } = setup(tm150('0:1'));
    await waitFor(() => { expect(completeGroup).toHaveBeenCalledTimes(1); });
    const [, request] = completeGroup.mock.calls[0];
    expect(request).toMatchObject({ groupId: '', openRanks: [] });
    expect(request.ranking[0]).toBe(id('O'));
    await waitFor(() => { expect(onDone).toHaveBeenCalled(); });
  });

  it('Zeile 1: SC Ost und TSV West gleich auf Platz 1 → kein Aufruf, „Besetzung prüfen“ bleibt (Entscheidung nötig)', async () => {
    const { completeGroup, onDone } = setup(tm150('1:1'));
    await flush();
    expect(completeGroup).not.toHaveBeenCalled();
    expect(onDone).not.toHaveBeenCalled();
  });
});

describe('@TM-071 @TM-145 Folgespiele nach einer Korrektur', () => {
  it('@TM-071 Nord jetzt Erster: Anfrage mit der neuen Rangfolge Nord, Süd – ohne Wiederöffnen, ohne Zutun', async () => {
    const { completeGroup } = setup(tm071(true));
    await waitFor(() => { expect(completeGroup).toHaveBeenCalledTimes(1); });
    const [, request] = completeGroup.mock.calls[0];
    expect(request.groupId).toBe('A');
    expect(request.ranking.slice(0, 2)).toEqual([id('N'), id('S')]);
  });

  it('@TM-145 Süd und West wieder gleich (Platz 2 führt ins Halbfinale): Plätze 2 und 3 gehen auf die Herkunft zurück', async () => {
    const { completeGroup } = setup(tm145());
    await waitFor(() => { expect(completeGroup).toHaveBeenCalledTimes(1); });
    expect(completeGroup.mock.calls[0][1].openRanks).toEqual([2, 3]);
  });

  it('Gegenbeispiel: eine nicht veraltete, abgeschlossene Gruppe ruft nichts auf (Cloud: nur der Server markiert veraltet)', async () => {
    const { completeGroup } = setup(tm071(false));
    await flush();
    expect(completeGroup).not.toHaveBeenCalled();
  });
});

describe('Rechte, Netz und Wiederholung (A-15b, RT-9, Risiko 6)', () => {
  it('Helfer (ohne manageLifecycle): kein Aufruf – „Besetzung prüfen“ bleibt für die Turnierleitung stehen', async () => {
    const { completeGroup } = setup(tm150('0:1'), { canManage: false });
    await flush();
    expect(completeGroup).not.toHaveBeenCalled();
  });

  it('ohne Netz kein Aufruf; mit Netz danach genau einer', async () => {
    const t = tm150('0:1');
    const { completeGroup, rerender } = setup(t, { online: false });
    await flush();
    expect(completeGroup).not.toHaveBeenCalled();
    rerender(t, { online: true });
    await waitFor(() => { expect(completeGroup).toHaveBeenCalledTimes(1); });
  });

  it('zweites Leitungsgerät (Review #384 N2: echte Antwort `ok` mit „schon abgeschlossen“): keine Meldung, kein Fehlschlag vermerkt, derselbe Stand nicht noch einmal', async () => {
    const t = tm150('0:1');
    const { completeGroup, onDone, rerender } = setup(t, {}, { status: 'ok', alreadyCompleted: true, changed: [] });
    await waitFor(() => { expect(onDone).toHaveBeenCalledTimes(1); });
    rerender({ ...t });
    await flush();
    expect(completeGroup).toHaveBeenCalledTimes(1);
    const request = reassignAfterCorrection(t, '');
    expect(request !== null && recompletionFailed(recompletionKey(t.id, request))).toBe(false);
  });

  it('Review #384 M1: bleiben offene Plätze und trägt der Abschluss schon diese Rangfolge, ruft weder dieses noch ein zweites Gerät noch ein neues Einhängen erneut auf', async () => {
    const t = tm145();
    const nachAuto: Tournament = { ...t, groupCompletions: [completion('A', activeRanking(t, 'A'), { stale: true, openRanks: [2, 3] })] };
    const erstes = setup(nachAuto);
    const zweites = setup(nachAuto);
    await flush();
    expect(erstes.completeGroup).not.toHaveBeenCalled();
    expect(zweites.completeGroup).not.toHaveBeenCalled();
  });

  it('Review #384 M3: eine Ablehnung vermerkt den Fehlschlag (dann zeigt die Tabelle „Besetzung prüfen“); ein späterer Erfolg nimmt ihn zurück', async () => {
    const t = tm150('0:1');
    const request = reassignAfterCorrection(t, '');
    if (request === null) { throw new Error('Anfrage erwartet'); }
    const key = recompletionKey(t.id, request);
    const { onDone } = setup(t, {}, { status: 'rejected', code: 'STALE_VERSION' });
    await waitFor(() => { expect(onDone).toHaveBeenCalledTimes(1); });
    expect(recompletionFailed(key)).toBe(true);
    resetRecompletionFailures();
    const ok = setup(t);
    await waitFor(() => { expect(ok.onDone).toHaveBeenCalledTimes(1); });
    expect(recompletionFailed(key)).toBe(false);
  });

  it('Netzfehler beim Aufruf (Review #384 N1): kein Absturz, neu geladen, Fehlschlag vermerkt; nach der Rückkehr des Netzes genau ein neuer Versuch', async () => {
    const t = tm150('0:1');
    const completeGroup = vi.fn<(id: string, request: CompleteGroupRequest) => Promise<CompleteGroupResult>>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue({ status: 'ok', alreadyCompleted: false, changed: [] });
    const { onDone, rerender } = setup(t, { completeGroup });
    await waitFor(() => { expect(onDone).toHaveBeenCalledTimes(1); });
    rerender({ ...t }); // gleicher Stand, weiter „online“: kein Endlosversuch
    await flush();
    expect(completeGroup).toHaveBeenCalledTimes(1);
    rerender({ ...t }, { completeGroup, online: false });
    rerender({ ...t }, { completeGroup, online: true });
    await waitFor(() => { expect(completeGroup).toHaveBeenCalledTimes(2); });
  });
});

describe('Gast (lokaler Speicher, C-LOKALER-NEUABSCHLUSS-KEIN-ZWILLING)', () => {
  it('lokal: abgeschlossen mit Süd vor Nord, nach der Korrektur Nord vorn → erneut abgeschlossen, obwohl niemand „veraltet“ markiert', async () => {
    const { completeGroup } = setup(tm071(false), { local: true });
    await waitFor(() => { expect(completeGroup).toHaveBeenCalledTimes(1); });
    expect(completeGroup.mock.calls[0][1].ranking.slice(0, 2)).toEqual([id('N'), id('S')]);
  });

  it('Gegenbeispiel @W2A-074 (Review #384 N7): Gast, abgeschlossen mit der aktuellen Rangfolge (die Entscheidung kam mit dem Abschluss) → kein erneuter Abschluss', async () => {
    const t = tm071(false);
    const passend: Tournament = { ...t, groupCompletions: [completion('A', activeRanking(t, 'A'))] };
    const { completeGroup } = setup(passend, { local: true });
    await flush();
    expect(completeGroup).not.toHaveBeenCalled();
  });
});
