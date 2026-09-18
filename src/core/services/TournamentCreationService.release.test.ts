/**
 * Task 3 — "Ein Turnier bleibt Entwurf, bis es jemand aktiv freigibt."
 *
 * Der Freigabe-Marker ist `publishedAt`, NICHT `status`: SettingsTab.tsx (~194) setzt ein
 * bereits veröffentlichtes Turnier zum Bearbeiten zurück auf `status: 'draft'`, und nur eine
 * In-App-Rückkehr stellt den Status wieder her (App.tsx, originalStatusRef). Ein Reload mitten
 * in der Bearbeitung lässt ein laufendes Turnier dauerhaft auf `draft` stehen. Eine
 * Status-Prüfung würde es also mitten im Spiel vom Netz nehmen bzw. — hier relevant — ein
 * bewusst privat gestelltes Turnier hinter dem Rücken des Veranstalters wieder teilen.
 */
import { describe, it, expect, vi } from 'vitest';
import { TournamentCreationService } from './TournamentCreationService';
import type { ITournamentRepository } from '../repositories/ITournamentRepository';
import type { Tournament } from '../models/types';

function createService() {
    const save = vi.fn((_tournament: Tournament) => Promise.resolve());
    const repository = { save } as unknown as ITournamentRepository;
    return { service: new TournamentCreationService(repository), save };
}

/** Minimal publizierbares Turnier (2 Teams, 1 Feld) — echter Scheduler, kein Mock. */
const publishable: Partial<Tournament> = {
    title: 'Test-Turnier',
    numberOfFields: 1,
    numberOfTeams: 2,
    teams: [
        { id: 't1', name: 'Team A' },
        { id: 't2', name: 'Team B' },
    ],
};

describe('TournamentCreationService — Freigabe (publishedAt)', () => {
    it('createDraft() erzeugt ein privates Turnier (isPublic false)', () => {
        const { service } = createService();

        const draft = service.createDraft();

        expect(draft.isPublic).toBe(false);
        expect(draft.publishedAt).toBeUndefined();
    });

    it('createDraft() lässt einen explizit übergebenen Wert gewinnen', () => {
        const { service } = createService();

        const draft = service.createDraft({ isPublic: true });

        expect(draft.isPublic).toBe(true);
    });

    it('publish() ohne publishedAt ist die Erstfreigabe: öffentlich, Share-Code, publishedAt gesetzt', async () => {
        const { service } = createService();

        const tournament = await service.publish({ ...publishable });

        expect(tournament.isPublic).toBe(true);
        expect(tournament.shareCode).toBeDefined();
        expect(tournament.shareCode).toHaveLength(6);
        expect(tournament.publishedAt).toBeDefined();
        expect(Number.isNaN(Date.parse(tournament.publishedAt ?? ''))).toBe(false);
    });

    /**
     * RED gegen eine Status-Logik: Das Turnier trägt bewusst `status: 'draft'` (Wizard-Marker
     * der "Erweiterten Bearbeitung"), ist aber bereits freigegeben (`publishedAt`) und vom
     * Veranstalter auf privat gestellt. Eine Prüfung `data.status !== 'published'` würde hier
     * greifen und das Turnier wieder öffentlich machen — genau das darf nicht passieren.
     */
    it('publish() eines bereits freigegebenen, privat gestellten Turniers bleibt privat', async () => {
        const { service } = createService();
        const firstRelease = '2026-01-15T10:00:00.000Z';

        const tournament = await service.publish({
            ...publishable,
            status: 'draft',
            publishedAt: firstRelease,
            isPublic: false,
        });

        expect(tournament.isPublic).toBe(false);
        expect(tournament.shareCode).toBeUndefined();
        expect(tournament.publishedAt).toBe(firstRelease);
    });

    it('publish() erneuert den Share-Code eines freigegebenen, öffentlichen Turniers nicht', async () => {
        const { service } = createService();
        const firstRelease = '2026-01-15T10:00:00.000Z';

        const tournament = await service.publish({
            ...publishable,
            publishedAt: firstRelease,
            isPublic: true,
            shareCode: 'ABC123',
        });

        expect(tournament.shareCode).toBe('ABC123');
        expect(tournament.publishedAt).toBe(firstRelease);
    });
});
