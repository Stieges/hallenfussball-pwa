/**
 * core/errors — A-06a (Brief A1): `isTransientMutationError` erkennt TimeoutError
 * (`name === 'TimeoutError'`) bzw. `code === 23` (Zahl) als vorübergehend.
 * Unit-node, echte Error-Objekte, KEINE `DOMException`.
 * Szenarien: @FU-013, @FU-016, @FU-009.
 */
import { describe, it, expect } from 'vitest';
import {
  RepositoryError,
  GuestStoreReadError,
  TeamStillReferencedError,
  isTransientMutationError,
} from '../errors';
import { createRequestTimeoutError } from '../utils/syncRetryTiming';
import { classifySendFailure } from '../match/client/sendErrors';

describe('isTransientMutationError — A1 TimeoutError (@FU-016)', () => {
  it('A1 Test 1: Error mit name TimeoutError ist transient', () => {
    const error = Object.assign(new Error('signal timed out'), { name: 'TimeoutError' });
    expect(isTransientMutationError(error)).toBe(true);
  });

  it('A1 Test 2: postgrest-Form mit TimeoutError-Text ist transient, classifySendFailure: transient (@FU-013)', () => {
    const error = new RepositoryError('appendMatchEvents', 'TimeoutError: signal timed out', {
      message: 'TimeoutError: signal timed out',
      details: '',
      hint: '',
      code: '',
    });
    expect(isTransientMutationError(error)).toBe(true);
    expect(classifySendFailure(error).kind).toBe('transient');
  });

  it('A1 Test 3: Abbruch ohne Grund (AbortError-Text) in RepositoryError ist transient', () => {
    const error = new RepositoryError('appendMatchEvents', 'AbortError: This operation was aborted', {
      message: 'AbortError: This operation was aborted',
      code: '',
    });
    expect(isTransientMutationError(error)).toBe(true);
  });

  it('A1 Test 4: createRequestTimeoutError ist transient (@FU-009)', () => {
    expect(isTransientMutationError(createRequestTimeoutError(15000))).toBe(true);
  });

  it('A1 Test 5: code 23 (Zahl, strikter Vergleich) ist transient', () => {
    const error = Object.assign(new Error('x'), { code: 23 });
    expect(isTransientMutationError(error)).toBe(true);
  });
});

describe('isTransientMutationError — A1 Gegenbeispiele (@FU-016, @FU-009)', () => {
  it('Gegenbeispiel: new Error(\'Zeitlimit\') ohne name ist permanent', () => {
    expect(isTransientMutationError(new Error('Zeitlimit'))).toBe(false);
  });

  it('Gegenbeispiel: code 23505 (duplicate key) ist permanent — kein Präfix-Vergleich auf 23', () => {
    const error = new RepositoryError('save', 'duplicate key', {
      code: '23505',
      message: 'duplicate key',
    });
    expect(isTransientMutationError(error)).toBe(false);
  });

  it('Gegenbeispiel: GuestStoreReadError mit name TimeoutError bleibt permanent (Klasse vor Name)', () => {
    const cause = Object.assign(new Error('signal timed out'), { name: 'TimeoutError' });
    const error = Object.assign(new GuestStoreReadError('x', { cause }), { name: 'TimeoutError' });
    expect(isTransientMutationError(error)).toBe(false);
  });

  it('Gegenbeispiel: TeamStillReferencedError mit name TimeoutError bleibt permanent (@FU-013)', () => {
    const error = Object.assign(new TeamStillReferencedError('match-1'), { name: 'TimeoutError' });
    expect(isTransientMutationError(error)).toBe(false);
  });
});
