/**
 * @W1-038 Das Datum ist nach deutscher Zeit mit heute vorbelegt.
 * Gegeben es ist der 24.10.2026, 0:30 Uhr deutscher Zeit (= 23.10.2026, 22:30 UTC),
 * wenn der Assistent geöffnet wird, dann ist das Datum der 24.10.2026 und es erscheint
 * keine Meldung, das Datum liege in der Vergangenheit.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { TournamentCreationService } from './TournamentCreationService';
import type { ITournamentRepository } from '../repositories/ITournamentRepository';

const repo = {} as unknown as ITournamentRepository;
const VERGANGENHEIT = 'Startdatum darf nicht in der Vergangenheit liegen';

describe('@W1-038 Datum nach deutscher Zeit', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('0:30 Uhr deutscher Zeit (22:30 UTC): Vorbelegung ist der 24.10.2026, keine Vergangenheits-Meldung', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-23T22:30:00Z'));
    const service = new TournamentCreationService(repo);
    const draft = service.createDraft();
    expect(draft.date).toBe('2026-10-24');
    const errors = service.validateStep(1, { title: 'T', date: draft.date, location: { name: 'Halle' }, status: 'draft' });
    expect(errors).not.toContain(VERGANGENHEIT);
  });

  it('Gegenbeispiel 10:00 UTC am 24.10.2026: Vorbelegung bleibt der 24.10.2026, der Vortag ist vergangen', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-24T10:00:00Z'));
    const service = new TournamentCreationService(repo);
    expect(service.createDraft().date).toBe('2026-10-24');
    const errors = service.validateStep(1, { title: 'T', date: '2026-10-23', location: { name: 'Halle' }, status: 'draft' });
    expect(errors).toContain(VERGANGENHEIT);
  });

  it('Prüfer in deutscher Zeit: um 0:30 Uhr am 24.10.2026 (22:30 UTC) ist der 23.10.2026 vergangen', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-23T22:30:00Z'));
    const service = new TournamentCreationService(repo);
    const errors = service.validateStep(1, { title: 'T', date: '2026-10-23', location: { name: 'Halle' }, status: 'draft' });
    expect(errors).toContain(VERGANGENHEIT);
  });
});
