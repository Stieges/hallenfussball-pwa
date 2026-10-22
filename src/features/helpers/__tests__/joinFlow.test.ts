/**
 * Zustandsautomat des Beitritts (A-17a, Plan GA5 v2.1 § 3.2): je Zweig ein Test mit Kennung.
 */
import { describe, expect, it } from 'vitest';
import type { HelperAccessStatus, HelperAccessView, RequestHelperAccessResult } from '../../../core/repositories/helperAccessRpc';
import type { SessionKind } from '../../../core/auth/deviceSession';
import {
  HELPER_NAME_MAX_LENGTH,
  initialJoinFlowState,
  isValidHelperName,
  joinFlowReducer,
  type JoinFlowEvent,
  type JoinFlowState,
} from '../joinFlow';

const CUP = { id: 't-cup', title: 'Live-Cup', date: '2026-11-28' };
const OPEN: HelperAccessStatus = { state: 'open', relation: 'none', tournament: CUP, shareCode: 'SHARE1' };

function loaded(info: HelperAccessStatus, session: SessionKind = 'none', waitingCount: number | null = 0): JoinFlowState {
  return joinFlowReducer(initialJoinFlowState('CODE123456'), { type: 'infoLoaded', info, session, waitingCount });
}

function run(state: JoinFlowState, ...events: JoinFlowEvent[]): JoinFlowState {
  return events.reduce(joinFlowReducer, state);
}

function form(name = 'Tom'): JoinFlowState {
  return run(loaded(OPEN), { type: 'nameChanged', name });
}

function submitting(name = 'Tom'): JoinFlowState {
  return run(form(name), { type: 'submit' });
}

describe('Scan: Anzeige nach § 3.2', () => {
  it('@HE-033 @HE-004 offener Code ohne Sitzung oder mit Gerätesitzung → Namensformular mit Zuschauer-Weg', () => {
    for (const session of ['none', 'device'] as const) {
      expect(loaded(OPEN, session)).toEqual({
        step: 'form', code: 'CODE123456', tournament: CUP, shareCode: 'SHARE1', name: '', notice: null,
      });
    }
  });

  it('@HE-089 Konto, offener Code, nichts wartet → Rückfrage vor dem Abmelden', () => {
    expect(loaded(OPEN, 'account', 0)).toEqual({ step: 'accountConfirm', code: 'CODE123456', tournament: CUP, shareCode: 'SHARE1' });
  });

  it('@HE-092 Konto mit 2 wartenden Einträgen → kein „Weiter“, „Erst verbinden – 2 Einträge warten“', () => {
    const state = loaded(OPEN, 'account', 2);
    expect(state).toEqual({ step: 'accountWaiting', code: 'CODE123456', waitingCount: 2 });
    // In diesem Zustand führt kein Ereignis zum Abmelden.
    expect(run(state, { type: 'confirmSignOut' }, { type: 'signedOut' }, { type: 'submit' })).toBe(state);
  });

  it.each([
    ['Eigentümer', 'open'],
    ['Co-Admin', 'rotated'],
  ] as const)('@HE-091 %s mit Konto: „Du leitest dieses Turnier bereits“, keine Rückfrage (Code %s)', (_rolle, state) => {
    const result = loaded({ state, relation: 'leader', tournament: CUP }, 'account', 3);
    expect(result).toEqual({ step: 'show', code: 'CODE123456', view: { view: 'leader', tournamentId: 't-cup' } });
  });

  it('@HE-095 derselbe QR auf demselben Gerät, zugelassen mit Feld 2 → Feld 2 öffnen, kein Formular', () => {
    const result = loaded({ state: 'open', relation: 'accepted', tournament: CUP, field: 2 }, 'device');
    expect(result).toEqual({ step: 'show', code: 'CODE123456', view: { view: 'openField', tournamentId: 't-cup', field: 2 } });
  });

  const WIEDEREINSTIEG: Array<[string, HelperAccessStatus, HelperAccessView]> = [
    ['Zugang entzogen', { state: 'open', relation: 'revoked', tournament: CUP }, { view: 'noAccess' }],
    // Genau die Server-Form von join_code_info: Abschluss nur über state:'closed', ohne Schlüssel `closed` (Review #331 H-1).
    ['Turnier abgeschlossen', { state: 'closed', relation: 'accepted', tournament: CUP, field: 2 },
      { view: 'finalStandings', tournamentId: 't-cup' }],
    ['Code abgelaufen, Turnier läuft', { state: 'expired', relation: 'accepted', tournament: CUP, field: 2 },
      { view: 'openField', tournamentId: 't-cup', field: 2 }],
  ];
  it.each(WIEDEREINSTIEG)('@HE-098 Wiedereinstieg: %s', (_fall, info, view) => {
    expect(loaded(info, 'device')).toEqual({ step: 'show', code: 'CODE123456', view });
  });

  it.each([
    ['invalid', 'invalidCode'],
    ['rotated', 'codeRotated'],
    ['expired', 'codeExpired'],
    ['closed', 'tournamentClosed'],
  ] as const)('@HE-007 @HE-009 @HE-038 Code %s ohne Beziehung → %s, auch für ein Konto (keine Rückfrage)', (state, view) => {
    expect(loaded({ state }, 'account')).toEqual({ step: 'show', code: 'CODE123456', view: { view } });
  });

  it('@HE-098 Zugangsstatus mit closed:false und Code-Zustand closed fehlt → Feld (closed vom Server gewinnt)', () => {
    expect(loaded({ relation: 'accepted', tournament: CUP, field: 2, closed: false }, 'device'))
      .toMatchObject({ view: { view: 'openField', field: 2 } });
    expect(loaded({ relation: 'accepted', tournament: CUP, field: 2, closed: true }, 'device'))
      .toMatchObject({ view: { view: 'finalStandings' } });
  });

  it('@HE-092 Konto, Zählung gescheitert → gesperrt wie „Erst verbinden“, ohne Zahl (Review #331 M-1)', () => {
    const state = loaded(OPEN, 'account', null);
    expect(state).toEqual({ step: 'accountWaiting', code: 'CODE123456', waitingCount: null });
    expect(run(state, { type: 'confirmSignOut' })).toBe(state);
  });

  it('Sitzung nicht lesbar (unknown) → Namensformular wie ohne Sitzung', () => {
    expect(loaded(OPEN, 'unknown')).toMatchObject({ step: 'form', name: '' });
  });

  it('@HE-001 Anfrage offen → Warteschirm mit Prüfzahl', () => {
    expect(loaded({ state: 'open', relation: 'pending', tournament: CUP, checkNumber: 47 }, 'device')).toEqual({
      step: 'show', code: 'CODE123456', view: { view: 'waiting', checkNumber: 47 },
    });
  });

  it('@HE-015 @HE-093 Scan ohne Netz → „Für den Einstieg brauchst du Netz“, auch mit Konto', () => {
    const state = joinFlowReducer(initialJoinFlowState('C'), { type: 'infoFailed', error: { kind: 'network' } });
    expect(state).toEqual({ step: 'show', code: 'C', view: { view: 'offline' } });
  });

  it('ignoriert Ereignisse, die im Laden-Zustand nicht vorkommen', () => {
    const start = initialJoinFlowState('C');
    expect(joinFlowReducer(start, { type: 'submit' })).toBe(start);
  });
});

describe('Rückfrage und Abmelden', () => {
  it('@HE-090 „Abbrechen“ → angemeldet bleiben, keine Anfrage (Endzustand cancelled)', () => {
    const state = run(loaded(OPEN, 'account'), { type: 'cancel' });
    expect(state).toEqual({ step: 'cancelled', code: 'CODE123456' });
    expect(run(state, { type: 'submit' }, { type: 'signedOut' })).toBe(state);
  });

  it('@HE-089 „Weiter“ → abmelden → Namensformular (Zuschauer-Weg bleibt)', () => {
    const signingOut = run(loaded(OPEN, 'account'), { type: 'confirmSignOut' });
    expect(signingOut).toMatchObject({ step: 'signingOut' });
    expect(run(signingOut, { type: 'signedOut' })).toEqual({
      step: 'form', code: 'CODE123456', tournament: CUP, shareCode: 'SHARE1', name: '', notice: null,
    });
  });

  it('@HE-092 Zählfehler beim „Weiter“ → nicht abmelden, gesperrt ohne Zahl', () => {
    const state = run(loaded(OPEN, 'account'), { type: 'confirmSignOut' }, { type: 'signOutBlocked', reason: 'waiting', waitingCount: null });
    expect(state).toEqual({ step: 'accountWaiting', code: 'CODE123456', waitingCount: null });
  });

  it('@HE-093 Netz weg beim „Weiter“ → nicht abgemeldet, Netz-Hinweis', () => {
    const state = run(loaded(OPEN, 'account'), { type: 'confirmSignOut' }, { type: 'signOutBlocked', reason: 'offline' });
    expect(state).toEqual({ step: 'show', code: 'CODE123456', view: { view: 'offline' } });
  });

  it('@HE-092 Einträge warten seit der Rückfrage → kein Abmelden, „Erst verbinden – N Einträge warten“', () => {
    const state = run(loaded(OPEN, 'account'), { type: 'confirmSignOut' }, { type: 'signOutBlocked', reason: 'waiting', waitingCount: 1 });
    expect(state).toEqual({ step: 'accountWaiting', code: 'CODE123456', waitingCount: 1 });
  });

  it('@HE-091 beim erneuten Prüfen inzwischen leitend → „Du leitest dieses Turnier bereits“; Code erneuert → nicht mehr gültig', () => {
    const signingOut = run(loaded(OPEN, 'account'), { type: 'confirmSignOut' });
    expect(run(signingOut, { type: 'infoLoaded', info: { state: 'open', relation: 'leader', tournament: CUP }, session: 'account', waitingCount: 0 }))
      .toMatchObject({ step: 'show', view: { view: 'leader' } });
    expect(run(signingOut, { type: 'infoFailed', error: { kind: 'unexpected', message: 'x' } }))
      .toMatchObject({ step: 'show', view: { view: 'unexpected' } });
    expect(run(signingOut, { type: 'submit' })).toBe(signingOut);
    expect(run(loaded(OPEN, 'account'), { type: 'submit' })).toMatchObject({ step: 'accountConfirm' });
  });
});

describe('Namensformular und Anfrage', () => {
  it('Name 1–40 Zeichen nach dem Kürzen der Ränder (wie am Server)', () => {
    expect(isValidHelperName('  Tom ')).toBe(true);
    expect(isValidHelperName('   ')).toBe(false);
    expect(isValidHelperName('x'.repeat(HELPER_NAME_MAX_LENGTH))).toBe(true);
    expect(isValidHelperName('x'.repeat(HELPER_NAME_MAX_LENGTH + 1))).toBe(false);
  });

  it('leerer Name → Feldprüfung, kein Absenden; Tippen nimmt den Hinweis weg', () => {
    const invalid = run(form(''), { type: 'submit' });
    expect(invalid).toMatchObject({ step: 'form', notice: 'invalidName' });
    expect(run(invalid, { type: 'nameChanged', name: 'T' })).toMatchObject({ step: 'form', name: 'T', notice: null });
  });

  it('@HE-001 Absenden → Warteschirm mit Prüfzahl', () => {
    const result: RequestHelperAccessResult = { result: 'PENDING', state: 'open', relation: 'pending', tournament: CUP, checkNumber: 31 };
    expect(run(submitting(), { type: 'requestDone', result })).toEqual({
      step: 'show', code: 'CODE123456', view: { view: 'waiting', checkNumber: 31 },
    });
  });

  it('@HE-098 EXISTING bei abgeschlossenem Turnier (Server-Form ohne closed) → Endstand, nicht das Feld', () => {
    const result: RequestHelperAccessResult = { result: 'EXISTING', state: 'closed', relation: 'accepted', tournament: CUP, field: 2 };
    expect(run(submitting(), { type: 'requestDone', result })).toMatchObject({ view: { view: 'finalStandings', tournamentId: 't-cup' } });
  });

  it('@HE-095 Anfrage existiert schon (EXISTING, zugelassen) → Feld öffnen ohne neue Anfrage', () => {
    const result: RequestHelperAccessResult = { result: 'EXISTING', relation: 'accepted', tournament: CUP, field: 2 };
    expect(run(submitting(), { type: 'requestDone', result })).toMatchObject({ view: { view: 'openField', field: 2 } });
  });

  it.each([
    ['BUSY', 'busy'],
    ['ACCOUNT_SESSION', 'retryScan'],
    ['ROTATED', 'codeRotated'],
    ['EXPIRED', 'codeExpired'],
    ['CLOSED', 'tournamentClosed'],
    ['INVALID', 'invalidCode'],
  ] as const)('Ergebnis %s → Anzeige %s', (code, view) => {
    expect(run(submitting(), { type: 'requestDone', result: { result: code } })).toMatchObject({ step: 'show', view: { view } });
  });

  it('@HE-015 ohne Netz beim Absenden → Formular mit Netz-Hinweis, Name bleibt', () => {
    expect(run(submitting('Tom'), { type: 'sessionFailed', reason: 'network' }))
      .toMatchObject({ step: 'form', name: 'Tom', notice: 'offline' });
    expect(run(submitting('Tom'), { type: 'requestFailed', error: { kind: 'network' } }))
      .toMatchObject({ step: 'form', name: 'Tom', notice: 'offline' });
  });

  it('§ 3.2 Auth 429 → Hinweis im Formular, Name bleibt; unavailable/unexpected → allgemeiner Hinweis', () => {
    expect(run(submitting(), { type: 'sessionFailed', reason: 'rateLimited' })).toMatchObject({ step: 'form', notice: 'authRateLimited' });
    expect(run(submitting(), { type: 'sessionFailed', reason: 'unavailable' })).toMatchObject({ step: 'form', notice: 'unexpected' });
    expect(run(submitting(), { type: 'sessionFailed', reason: 'unexpected' })).toMatchObject({ step: 'form', notice: 'unexpected' });
  });

  it('Konto taucht beim Absenden wieder auf → „Bitte noch einmal scannen“, nie still daneben anmelden', () => {
    expect(run(submitting(), { type: 'sessionFailed', reason: 'accountSession' })).toMatchObject({ step: 'show', view: { view: 'retryScan' } });
  });

  it.each([
    [{ kind: 'invalidInput', reason: 'INVALID_NAME' } as const, { step: 'form', notice: 'invalidName' }],
    [{ kind: 'invalidInput', reason: 'INVALID_FIELD' } as const, { step: 'form', notice: 'unexpected' }],
    [{ kind: 'unexpected', message: 'x' } as const, { step: 'form', notice: 'unexpected' }],
    [{ kind: 'noSession' } as const, { step: 'show', view: { view: 'retryScan' } }],
    // N-5: der Helfer sieht nie den Text der Turnierleitung („Nur die Turnierleitung …“).
    [{ kind: 'notAuthorized' } as const, { step: 'form', notice: 'unexpected' }],
  ])('Fehler %o → %o', (error, expected) => {
    expect(run(submitting(), { type: 'requestFailed', error })).toMatchObject(expected);
  });

  it('Endzustände und das Absenden ignorieren fremde Ereignisse', () => {
    const shown = loaded({ state: 'invalid' });
    expect(run(shown, { type: 'submit' })).toBe(shown);
    const sub = submitting();
    expect(run(sub, { type: 'cancel' })).toBe(sub);
    expect(run(form(), { type: 'cancel' })).toMatchObject({ step: 'form' });
  });
});
