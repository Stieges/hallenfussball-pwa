/**
 * @RE-007: Abgrenzung „reiner Netzfehler“ (wird nicht gemeldet) gegen echte Server-Fehler (bleiben sichtbar).
 * Im Zweifel melden: nur die ganze, bekannte Browser-Meldung zählt, nie ein Teilstück wie „fetch“ oder „timeout“.
 */
import { describe, expect, it } from 'vitest';
import { NetworkError, RepositoryError, SyncError } from '../../errors';
import { isPureNetworkError } from '../networkError';

const postgrest = (message: string, code = '') => ({ message, details: '', hint: '', code });
const withStatus = (status: number, message: string) => Object.assign(new Error(message), { status });

describe('@RE-007 isPureNetworkError', () => {
  it.each<[string, unknown]>([
    ['Chrome: TypeError „Failed to fetch“', new TypeError('Failed to fetch')],
    ['Chrome, von postgrest-js verpackt', new RepositoryError('get', 'TypeError: Failed to fetch', postgrest('TypeError: Failed to fetch'))],
    ['Firefox', new RepositoryError('get', 'TypeError: NetworkError when attempting to fetch resource.', postgrest('TypeError: NetworkError when attempting to fetch resource.'))],
    ['Safari „Load failed“', new RepositoryError('list', 'TypeError: Load failed', postgrest('TypeError: Load failed'))],
    ['Wrapper mit eigener Meldung, Ursache Netz', new RepositoryError('get', 'Laden fehlgeschlagen', postgrest('TypeError: Failed to fetch'))],
    ['Fehler mit cause', new Error('x', { cause: new TypeError('Failed to fetch') })],
    ['Zeitüberschreitung (TimeoutError)', Object.assign(new Error('The operation timed out.'), { name: 'TimeoutError' })],
    ['Abbruch', Object.assign(new Error('The user aborted a request.'), { name: 'AbortError' })],
    ['eigene Zeitgrenze der Liste', new Error('Cloud fetch timeout')],
    ['NetworkError der App', new NetworkError('offline', true)],
  ])('Netz: %s', (_name, error) => {
    expect(isPureNetworkError(error)).toBe(true);
  });

  it.each<[string, unknown]>([
    ['Rechte (RLS) mit Code', new RepositoryError('get', 'permission denied for table tournaments', postgrest('permission denied for table tournaments', '42501'))],
    ['Konflikt mit Code', new RepositoryError('save', 'duplicate key value', postgrest('duplicate key value', '23505'))],
    ['Server-Zeitgrenze (Code 57014), Text enthält „timeout“', new RepositoryError('get', 'canceling statement due to statement timeout', postgrest('canceling statement due to statement timeout', '57014'))],
    ['5xx mit Text', withStatus(503, 'upstream connect error')],
    ['5xx mit Text, der „fetch“ nennt', withStatus(502, 'Bad gateway while trying to fetch upstream')],
    ['Meldung nennt „fetch“ nur als Teilstück', new RepositoryError('get', 'Could not fetch tournament row', postgrest('Could not fetch tournament row'))],
    ['Netz-Text, aber Server-Code in der Ursache', new RepositoryError('get', 'TypeError: Failed to fetch', postgrest('TypeError: Failed to fetch', 'PGRST301'))],
    ['Programmierfehler (TypeError)', new TypeError("Cannot read properties of undefined (reading 'id')")],
    ['SyncError', new SyncError('Abgleich fehlgeschlagen', 't1')],
    ['kein Fehlerobjekt', 'Failed to fetch'],
    ['leer', undefined],
  ])('kein Netz: %s', (_name, error) => {
    expect(isPureNetworkError(error)).toBe(false);
  });
});
