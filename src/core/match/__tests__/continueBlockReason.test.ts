/**
 * R-LT2 (Plan Cockpit Scheibe 3, LT-6): `continueBlockReason` nennt dieselben Gründe wie `applyReopen` – das Cockpit bietet
 * „Spiel fortsetzen“ nur an, wenn die Engine es annähme (@SL-074, @SL-075, @SL-146, @SL-104). Grundlage sind die Fixtures, die
 * auch der SQL-Zwilling liest (scripts/match-engine-parity.sh): je Fixture der Zustand VOR dem REOPEN und dessen Ergebnis.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { continueLog } from '../reduceMatch';
import { initialState } from '../applyEvent';
import type { EngineEvent, MatchContext } from '../types';
import { continueBlockReason } from '../handlers/reopen';

interface FixtureDoc {
  ctx: MatchContext;
  prior?: EngineEvent[];
  events: EngineEvent[];
}

const fixturesDir = path.join(__dirname, '..', '__fixtures__');

/** Zustand vor dem letzten REOPEN eines Helfers und dessen Ergebnis (Grund bei Ablehnung). */
function vorDemFortsetzen(datei: string) {
  const doc = JSON.parse(fs.readFileSync(path.join(fixturesDir, datei), 'utf-8')) as FixtureDoc;
  const alle = [...(doc.prior ?? []), ...doc.events];
  const index = alle.map((e) => e.type === 'REOPEN' && e.actor !== 'leitung').lastIndexOf(true);
  if (index < 0) { throw new Error(`${datei}: kein REOPEN eines Helfers`); }
  const vorher = continueLog(initialState(doc.ctx), alle.slice(0, index), doc.ctx).state;
  const reopen = alle[index];
  const result = continueLog(vorher, [reopen], doc.ctx).results[0];
  const detail = result.detail as { reason?: string } | undefined;
  return { vorher, reopen, status: result.status, reason: result.status === 'rejected' ? detail?.reason ?? null : null };
}

describe('R-LT2 continueBlockReason = Grund von applyReopen (Helfer)', () => {
  it.each([
    ['62a-fortsetzen-helfer-1min.json', null],
    ['62b-fortsetzen-helfer-120s-grenze.json', null],
    ['62c-fortsetzen-helfer-121s.json', 'CONTINUE_WINDOW_EXPIRED'],
    ['62d-fortsetzen-helfer-zweites-mal.json', 'ALREADY_CONTINUED'],
    ['64a-fortsetzen-nach-abpfiff-von-hand.json', 'NOT_ENDED_BY_CLOCK'],
    ['34-reopen-after-shootout-rejected.json', 'SHOOTOUT_FINISHED'],
  ])('%s → %s', (datei, erwartet) => {
    const l = vorDemFortsetzen(datei);
    expect(l.reason).toBe(erwartet);
    expect(continueBlockReason(l.vorher, l.reopen.at)).toBe(erwartet);
  });

  it('@SL-075 Gegenbeispiel: dasselbe Spiel, 20 s nach dem Abpfiff frei, 121 s danach gesperrt (Frist nach Gerätezeit)', () => {
    const l = vorDemFortsetzen('62a-fortsetzen-helfer-1min.json');
    const ende = l.vorher.finishedAt ?? 0;
    expect(continueBlockReason(l.vorher, ende + 20_000)).toBeNull();
    expect(continueBlockReason(l.vorher, ende + 121_000)).toBe('CONTINUE_WINDOW_EXPIRED');
  });
});
