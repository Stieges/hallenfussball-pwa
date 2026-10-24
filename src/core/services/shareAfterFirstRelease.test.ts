/**
 * C-FESTLEGEN-TEILT-NICHT (@W1-020, @W1-037): Beim ersten Festlegen eines Konto-Turniers mit Netz teilt die App das
 * Turnier ueber denselben Weg wie „Teilen“ unter Sichtbarkeit; der Server-Code gilt. Echter Service, Repository-Mock.
 */
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { shareAfterFirstRelease } from './shareAfterFirstRelease';
import { TournamentCreationService } from './TournamentCreationService';
import type { ITournamentRepository } from '../repositories/ITournamentRepository';
import type { Tournament } from '../models/types';
import { testUuid } from '../../test/testIds';

const input: Partial<Tournament> = {
    title: 'Teilen-Cup', numberOfFields: 1, numberOfTeams: 2,
    teams: [{ id: testUuid(1), name: 'Team A' }, { id: testUuid(2), name: 'Team B' }],
};

function setup(makePublic: ITournamentRepository['makeTournamentPublic']) {
    const spy = vi.fn(makePublic);
    const repository = { save: vi.fn(() => Promise.resolve()), makeTournamentPublic: spy } as unknown as ITournamentRepository;
    return { repository, spy, service: new TournamentCreationService(repository) };
}

const serverReply = { shareCode: 'SERVR2', createdAt: '2026-10-24T10:00:00.000Z' };

describe('shareAfterFirstRelease', () => {
    // publish() erzeugt den lokalen Code ueber window.crypto; unter Node fehlt window.
    beforeAll(() => { vi.stubGlobal('window', { crypto: globalThis.crypto }); });
    afterAll(() => { vi.unstubAllGlobals(); });

    it('Erstfestlegen online im Konto: ruft make_tournament_public auf und uebernimmt den Server-Code', async () => {
        const { repository, spy, service } = setup(() => Promise.resolve(serverReply));
        const released = await service.publish({ ...input });
        const localCode = released.shareCode;
        expect(localCode).toBeDefined();

        const outcome = await shareAfterFirstRelease(repository, released, { firstRelease: true, mayShare: true });

        expect(spy).toHaveBeenCalledWith(released.id, { requireCloud: true });
        expect(outcome.status).toBe('shared');
        expect(outcome.tournament.shareCode).toBe('SERVR2');
        expect(outcome.tournament.shareCode).not.toBe(localCode);
        expect(outcome.tournament.shareCodeCreatedAt).toBe(serverReply.createdAt);
        expect(outcome.tournament.isPublic).toBe(true);
    });

    it.each([
        ['Gast, ohne Netz oder anonymes Konto (mayShare false)', { firstRelease: true, mayShare: false }],
        ['bereits festgelegt (auch privat gestellt)', { firstRelease: false, mayShare: true }],
    ])('%s: kein Aufruf, Turnier unveraendert', async (_name, flags) => {
        const { repository, spy, service } = setup(() => Promise.resolve(serverReply));
        const released = await service.publish({ ...input });

        const outcome = await shareAfterFirstRelease(repository, released, flags);

        expect(spy).not.toHaveBeenCalled();
        expect(outcome.status).toBe('skipped');
        expect(outcome.tournament).toBe(released);
    });

    it('bereits festgelegt und privat: erneutes Festlegen macht es nicht oeffentlich und ruft nichts auf', async () => {
        const { repository, spy, service } = setup(() => Promise.resolve(serverReply));
        const released = await service.publish({ ...input, publishedAt: '2026-01-01T10:00:00.000Z', isPublic: false });
        expect(released.isPublic).toBe(false);

        const outcome = await shareAfterFirstRelease(repository, released, { firstRelease: false, mayShare: true });

        expect(spy).not.toHaveBeenCalled();
        expect(outcome.tournament.isPublic).toBe(false);
    });

    it('Fehler beim Teilen: Turnier bleibt festgelegt, Ergebnis „failed“, kein zweiter Versuch', async () => {
        const { repository, spy, service } = setup(() => Promise.reject(new Error('Failed to fetch')));
        const released = await service.publish({ ...input });

        const outcome = await shareAfterFirstRelease(repository, released, { firstRelease: true, mayShare: true });

        expect(outcome.status).toBe('failed');
        expect(outcome.tournament.isPublic).toBe(false);
        expect(outcome.tournament.shareCode).toBeUndefined();
        expect(outcome.tournament.shareCodeCreatedAt).toBeUndefined();
        expect(outcome.tournament.status).toBe('published');
        expect(outcome.tournament.publishedAt).toBeDefined();
        expect(spy).toHaveBeenCalledTimes(1);
    });

    it('Server liefert nichts (null): als gescheitert behandeln, nicht als geteilt', async () => {
        const { repository, service } = setup(() => Promise.resolve(null));
        const released = await service.publish({ ...input });

        const outcome = await shareAfterFirstRelease(repository, released, { firstRelease: true, mayShare: true });

        expect(outcome.status).toBe('failed');
        expect(outcome.tournament.isPublic).toBe(false);
        expect(outcome.tournament.shareCode).toBeUndefined();
    });
});
