/**
 * GA4 A-13b-C Punkt 4, PFLICHT-VERDRAHTUNG (Review TB-3' A1): Der Anbieter `StandingTieProvider` übergibt dem Dienst den
 * ECHTEN Abschluss-Zustand (Abschluss vorhanden, nicht wieder geöffnet) – nicht die Zwischenregel über Folgespiele.
 *
 * Das Nikolaus-Turnier (Jeder gegen jeden) hat KEINE Folgespiele: Die Zwischenregel sagte immer „offen“, ein Zurücknehmen
 * nach „Gruppe abschließen“ wäre weiter angeboten worden. Der Test geht den ganzen Weg: echte Anbieter-Komponente, echter
 * Dienst, echtes Repository (lokaler Speicher), Abschluss über `completeGroup`, Anzeige in `TieGroupHint`.
 *
 * Aus den Anforderungen: @W2A-063 (Annahme mit einem Tipp), @W2A-070 („nach dem Abschluss der Gruppe bietet die App das
 * Zurücknehmen nicht mehr an“, Gegenbeispiel nach dem Wiederöffnen), @W2A-067 (Nikolaus-Lage), @TM-099 (Wiederöffnen).
 */
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { useCallback, useEffect, useState } from 'react';
import type { IStorageAdapter } from '../../../../core/storage/IStorageAdapter';
import type { Tournament } from '../../../../types/tournament';
import { STORAGE_KEYS } from '../../../../constants/storage';
import { nikolaus } from '../../../../core/standings/__tests__/decisionTestKit';
import { prepareGroupCompletion } from '../../../../core/services/GroupCompletionService';
import { i18nWrapper } from './tieTestKit';

const store = new Map<string, unknown>();
vi.mock('../../../../core/storage/StorageFactory', () => ({
  createStorage: () => Promise.resolve({
    get: (key: string) => Promise.resolve(store.get(key) ?? null),
    set: (key: string, value: unknown) => { store.set(key, value); return Promise.resolve(); },
    remove: (key: string) => { store.delete(key); return Promise.resolve(); },
  } as unknown as IStorageAdapter),
}));
vi.mock('../../../../lib/sentry', () => ({ captureFeatureError: vi.fn() }));
vi.unmock('i18next');
vi.unmock('react-i18next');

const hoisted = vi.hoisted((): { repository: { current: unknown } } => ({ repository: { current: null } }));
vi.mock('../../../../core/contexts/RepositoryContext', () => ({
  useRepositories: () => ({ tournamentRepository: hoisted.repository.current }),
}));
vi.mock('../../../auth/hooks/useCan', () => ({ useCan: () => true }));
vi.mock('../../../../hooks/useOnlineStatus', () => ({ useIsOnline: () => true }));

import { LocalStorageRepository } from '../../../../core/repositories/LocalStorageRepository';
import type { RecordDecisionRequest, RecordDecisionResult } from '../../../../core/repositories/groupCompletionCloud';
import { StandingTieProvider } from '../StandingTieProvider';
import { TieGroupHint } from '../TieGroupHint';
import { useStandingTie, type StandingTieContextValue } from '../standingTieContext';

const ID = 't1';

/**
 * Ein Speicher, der das Zurücknehmen nie sperrt – wie ein Server, der den Abschluss (noch) nicht kennt. So prüft der Test die
 * Regel des GERÄTS (Anbieter → Dienst), nicht die zweite Sicherung im Speicher (`WITHDRAW_NOT_ALLOWED` am Server/lokal).
 */
class SpeicherOhneSperre extends LocalStorageRepository {
  override async recordStandingDecision(id: string, request: RecordDecisionRequest, expectedVersion: number): Promise<RecordDecisionResult> {
    const t = await this.get(id);
    if (request.action !== 'withdraw' || t === null) {
      return super.recordStandingDecision(id, request, expectedVersion);
    }
    const version = (t.version ?? 0) + 1;
    await this.cacheCloudCopy({ ...t, standingDecisions: (t.standingDecisions ?? []).filter((d) => d.id !== request.decision.id), version });
    return { status: 'ok', alreadyApplied: false, version };
  }
}

/** Was die Ansicht dem Test herausgibt: der Kontext des Anbieters (mit dem Dienst) und das Neuladen. */
const probe: { tie: StandingTieContextValue | null; reload: () => void } = { tie: null, reload: () => undefined };

function Probe() {
  const tie = useStandingTie();
  useEffect(() => { probe.tie = tie; });
  return null;
}

/** Die Verwaltungsansicht im Kleinen: lädt das Turnier aus dem Repository und neu, wenn der Anbieter `onChanged` ruft. */
function Seite() {
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const load = useCallback(() => {
    void repository().get(ID).then((t) => setTournament(t));
  }, []);
  useEffect(() => { load(); probe.reload = load; }, [load]);
  if (tournament === null) {
    return null;
  }
  return (
    <StandingTieProvider tournamentId={ID} onChanged={load}>
      <Probe />
      <TieGroupHint tournament={tournament} groupId="" />
    </StandingTieProvider>
  );
}

const repository = (): LocalStorageRepository => hoisted.repository.current as LocalStorageRepository;

async function zeigen() {
  const Wrapper = await i18nWrapper('de');
  render(<MemoryRouter><Wrapper><Seite /></Wrapper></MemoryRouter>);
  await screen.findByTestId('tie-hint-choice');
  return { repo: repository() };
}

describe('Pflicht-Verdrahtung Nikolaus (A-13b-C Punkt 4): zurücknehmen hängt am echten Abschluss, nicht an Folgespielen', () => {
  beforeEach(() => {
    store.clear();
    store.set(STORAGE_KEYS.TOURNAMENTS, [{ ...nikolaus(), id: ID, sportId: 'football-indoor', version: 1 }]);
    hoisted.repository.current = new SpeicherOhneSperre();
  });
  afterEach(() => { hoisted.repository.current = null; });

  it('@W2A-063 @W2A-070 Annahme, Abschluss über das Repository: „zurücknehmen“ nicht mehr angeboten, withdraw → WITHDRAW_NOT_ALLOWED; nach dem Wiederöffnen wieder', async () => {
    const { repo } = await zeigen();
    const lade = async (): Promise<Tournament> => {
      const t = await repo.get(ID);
      if (t === null) { throw new Error('Turnier fehlt'); }
      return t;
    };
    const neuLaden = async () => { await act(async () => { probe.reload(); await Promise.resolve(); }); };

    // 1. Annahme mit einem Tipp (Nikolaus hat keine Folgespiele)
    expect((await lade()).matches.some((m) => m.isFinal === true)).toBe(false);
    await userEvent.click(screen.getByTestId('tie-decide-entry'));
    await userEvent.click(await screen.findByTestId('tie-accept-result'));
    expect(await screen.findByTestId('tie-decided-info')).toBeInTheDocument();
    expect(screen.getByTestId('tie-accept-withdraw')).toBeInTheDocument(); // vor dem Abschluss darf zurückgenommen werden
    const [decision] = (await lade()).standingDecisions ?? [];
    expect(decision.kind).toBe('shared');

    // 2. „Gruppe abschließen“ über das Repository (nicht über Folgespiele)
    const vorbereitet = prepareGroupCompletion(await lade(), '');
    if (vorbereitet.code !== 'READY') { throw new Error(`nicht bereit: ${vorbereitet.code}`); }
    const abschluss = await repo.completeGroup(ID, {
      groupId: '', ranking: vorbereitet.ranking, openRanks: vorbereitet.openRanks, tieDecisions: vorbereitet.tieDecisions,
      knownDecisionIds: [decision.id], expectedState: vorbereitet.expectedState,
    });
    expect(abschluss.status).toBe('ok');
    await neuLaden();

    // 3. „zurücknehmen“ wird nicht mehr angeboten, der Dienst lehnt ab, nichts wird geschrieben
    await waitFor(() => expect(screen.queryByTestId('tie-accept-withdraw')).toBeNull());
    expect(screen.getByTestId('tie-closed-note')).toHaveTextContent('Die Gruppe ist abgeschlossen.');
    const versionVorher = (await lade()).version;
    expect(await probe.tie?.service.withdraw(ID, decision.id)).toEqual({ ok: false, code: 'WITHDRAW_NOT_ALLOWED' });
    expect((await lade()).standingDecisions?.map((d) => d.id)).toEqual([decision.id]);
    expect((await lade()).version).toBe(versionVorher);

    // 4. Gegenbeispiel: nach dem Wiederöffnen wird es wieder angeboten und funktioniert
    expect(await repo.reopenGroup(ID, '', 'Ergebnis falsch eingetragen')).toEqual({ status: 'ok' });
    await neuLaden();
    const taste = await screen.findByTestId('tie-accept-withdraw');
    expect(screen.queryByTestId('tie-closed-note')).toBeNull();
    await userEvent.click(taste);
    await waitFor(() => expect(screen.getByTestId('tie-hint-choice')).toBeInTheDocument());
    expect((await lade()).standingDecisions).toEqual([]);
  });

  it('Gegenbeispiel: ein anderer Abschluss (Gruppe „A“) schließt das Nikolaus-Turnier („“) nicht', async () => {
    const { repo } = await zeigen();
    await userEvent.click(screen.getByTestId('tie-decide-entry'));
    await userEvent.click(await screen.findByTestId('tie-accept-result'));
    await screen.findByTestId('tie-accept-withdraw');
    await repo.completeGroup(ID, { groupId: 'A', ranking: [], openRanks: [], tieDecisions: [], knownDecisionIds: [], expectedState: [] });
    await act(async () => { probe.reload(); await Promise.resolve(); });
    expect(screen.getByTestId('tie-accept-withdraw')).toBeInTheDocument();
  });
});
