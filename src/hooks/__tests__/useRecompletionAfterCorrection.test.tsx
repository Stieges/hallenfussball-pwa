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
import { describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import type { Tournament } from '../../types/tournament';
import type { CompleteGroupRequest, CompleteGroupResult } from '../../core/repositories/groupCompletionCloud';
import { useRecompletionAfterCorrection, type RecompletionDeps } from '../useRecompletionAfterCorrection';
import { completion, HC, tournamentFromFixture } from '../../core/standings/__tests__/groupCompletionKit';
import { id, league } from '../../core/standings/__tests__/fixtures';
import { ET021_GRUPPE_A, ET021_GRUPPE_B, zweiGruppen } from '../../core/standings/__tests__/tb4Kit';

/** @TM-150: vier Teams genügen; Ergebnis West–Ost nach der Korrektur. */
const tm150 = (wOst: string): Tournament => {
  const { tournament } = league('WONB', `W–O ${wOst}; W–N 2:0; W–B 1:0; O–N 2:0; O–B 1:0; N–B 1:0`, { group: undefined });
  return { ...tournament, placementsToPlayOut: [1], groupCompletions: [completion('', [id('W'), id('O'), id('N'), id('B')], { stale: true })] };
};

/** @TM-071: Gruppe A war mit 1. SV Süd, 2. FC Nord abgeschlossen; nach der Korrektur ist FC Nord Erster (ET021: Nord gewinnt alles). */
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

  it('zweites Leitungsgerät: Antwort „schon abgeschlossen“ wirft nicht, derselbe Stand wird nicht noch einmal geschickt', async () => {
    const t = tm150('0:1');
    const { completeGroup, onDone, rerender } = setup(t, {}, { status: 'rejected', code: 'ALREADY_COMPLETED' } as unknown as CompleteGroupResult);
    await waitFor(() => { expect(onDone).toHaveBeenCalledTimes(1); });
    rerender({ ...t });
    await flush();
    expect(completeGroup).toHaveBeenCalledTimes(1);
  });

  it('Netzfehler beim Aufruf: kein Absturz, neu geladen', async () => {
    const completeGroup = vi.fn(() => Promise.reject(new Error('offline')));
    const onDone = vi.fn();
    renderHook(() => { useRecompletionAfterCorrection(tm150('0:1'), { completeGroup, canManage: true, online: true, local: false, onDone }); });
    await waitFor(() => { expect(onDone).toHaveBeenCalledTimes(1); });
  });
});

describe('Gast (lokaler Speicher, C-LOKALER-NEUABSCHLUSS-KEIN-ZWILLING)', () => {
  it('lokal: abgeschlossen mit Süd vor Nord, nach der Korrektur Nord vorn → erneut abgeschlossen, obwohl niemand „veraltet“ markiert', async () => {
    const { completeGroup } = setup(tm071(false), { local: true });
    await waitFor(() => { expect(completeGroup).toHaveBeenCalledTimes(1); });
    expect(completeGroup.mock.calls[0][1].ranking.slice(0, 2)).toEqual([id('N'), id('S')]);
  });
});
