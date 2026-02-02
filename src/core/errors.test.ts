import { describe, it, expect } from 'vitest';
import {
  AppError,
  RepositoryError,
  AuthenticationError,
  NetworkError,
  SyncError,
  OptimisticLockError,
  isAbortError,
} from './errors';

describe('Error Hierarchy', () => {
  it('AppError sets feature, action, context', () => {
    const err = new AppError('test', 'auth', 'login', { userId: '123' });
    expect(err.message).toBe('test');
    expect(err.feature).toBe('auth');
    expect(err.action).toBe('login');
    expect(err.context).toEqual({ userId: '123' });
    expect(err.name).toBe('AppError');
    expect(err).toBeInstanceOf(Error);
  });

  it('RepositoryError stores operation and originalError', () => {
    const original = { code: 'PGRST116', message: 'Not found' };
    const err = new RepositoryError('get', 'Failed to fetch', original);
    expect(err.operation).toBe('get');
    expect(err.originalError).toBe(original);
    expect(err.feature).toBe('repository');
    expect(err.action).toBe('get');
    expect(err.name).toBe('RepositoryError');
    expect(err).toBeInstanceOf(AppError);
    expect(err).toBeInstanceOf(Error);
  });

  it('RepositoryError without originalError has no context', () => {
    const err = new RepositoryError('save', 'Failed');
    expect(err.originalError).toBeUndefined();
    expect(err.context).toBeUndefined();
  });

  it('AuthenticationError tags feature=auth', () => {
    const err = new AuthenticationError('Not authenticated', 'save');
    expect(err.feature).toBe('auth');
    expect(err.action).toBe('save');
    expect(err.name).toBe('AuthenticationError');
    expect(err).toBeInstanceOf(AppError);
  });

  it('NetworkError stores isOffline flag', () => {
    const err = new NetworkError('No connection', true);
    expect(err.isOffline).toBe(true);
    expect(err.feature).toBe('network');
    expect(err.name).toBe('NetworkError');
  });

  it('SyncError stores tournamentId', () => {
    const err = new SyncError('Sync failed', 'abc-123');
    expect(err.tournamentId).toBe('abc-123');
    expect(err.feature).toBe('sync');
    expect(err.context).toEqual({ tournamentId: 'abc-123' });
  });

  it('OptimisticLockError match conflict', () => {
    const err = new OptimisticLockError('match-1', 1, 2);
    expect(err.matchId).toBe('match-1');
    expect(err.expectedVersion).toBe(1);
    expect(err.actualVersion).toBe(2);
    expect(err.isMatchConflict()).toBe(true);
    expect(err.name).toBe('OptimisticLockError');
  });
});

describe('isAbortError', () => {
  it('detects AbortError by name', () => {
    const err = new DOMException('The operation was aborted', 'AbortError');
    expect(isAbortError(err)).toBe(true);
  });

  it('detects abort by message containing "aborted"', () => {
    expect(isAbortError(new Error('signal is aborted without reason'))).toBe(true);
  });

  it('detects abort by message containing "AbortError"', () => {
    expect(isAbortError({ message: 'AbortError: signal aborted' })).toBe(true);
  });

  it('detects Cloud fetch timeout', () => {
    expect(isAbortError(new Error('Cloud fetch timeout'))).toBe(true);
  });

  it('detects DOMException code 20 (string)', () => {
    expect(isAbortError({ code: '20', message: 'some error' })).toBe(true);
  });

  it('detects DOMException code 20 (number)', () => {
    expect(isAbortError({ code: 20, message: 'some error' })).toBe(true);
  });

  it('returns false for null/undefined', () => {
    expect(isAbortError(null)).toBe(false);
    expect(isAbortError(undefined)).toBe(false);
  });

  it('returns false for non-abort errors', () => {
    expect(isAbortError(new Error('Network timeout'))).toBe(false);
    expect(isAbortError({ name: 'TypeError', message: 'x is not a function' })).toBe(false);
  });

  it('returns false for non-object values', () => {
    expect(isAbortError('abort')).toBe(false);
    expect(isAbortError(42)).toBe(false);
  });
});
