/**
 * @FU-109 „Verwerfen ohne erreichbaren Server löscht nichts und lädt den Stand des Servers nach“: die Statuszeile des
 * betroffenen Turniers sagt, dass der Stand des Servers geladen wird, sobald die Verbindung steht. Andere Turniere zeigen sie
 * nicht. Sie steht im normalen Fluss (kein `position: fixed`), damit der Inhalt nachrückt (Review Version-Fix R1).
 * Echte i18next-Instanz (DE/EN).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactElement } from 'react';
import { render, screen } from '@testing-library/react';
import { createInstance } from 'i18next';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import deCommon from '../../../../i18n/locales/de/common.json';
import enCommon from '../../../../i18n/locales/en/common.json';
import { AwaitingServerCopyLine } from '../AwaitingServerCopyLine';

vi.unmock('i18next');
vi.unmock('react-i18next');

const hoisted = vi.hoisted(() => ({ sync: { isCloudSyncAvailable: true, awaitingServerCopyIds: [] as string[] } }));

vi.mock('../../../../hooks/useSyncStatus', () => ({ useSyncStatus: () => hoisted.sync }));

async function renderWithI18n(ui: ReactElement, lng: 'de' | 'en' = 'de') {
  const instance = createInstance();
  await instance.use(initReactI18next).init({
    lng,
    fallbackLng: 'de',
    defaultNS: 'common',
    ns: ['common'],
    resources: { de: { common: deCommon }, en: { common: enCommon } },
    interpolation: { escapeValue: false },
    returnNull: false,
  });
  return render(<I18nextProvider i18n={instance}>{ui}</I18nextProvider>);
}

describe('@FU-109 Statuszeile „Verworfen – …“ unter dem Kopf', () => {
  beforeEach(() => {
    hoisted.sync.awaitingServerCopyIds = [];
    hoisted.sync.isCloudSyncAvailable = true;
  });

  it('@FU-109 ohne Verbindung nach dem Verwerfen: klarer Hinweis in DE, im normalen Fluss (verdeckt nichts)', async () => {
    hoisted.sync.awaitingServerCopyIds = ['T'];
    await renderWithI18n(<AwaitingServerCopyLine tournamentId="T" />);

    const zeile = screen.getByTestId('sync-awaiting-server-copy');
    expect(zeile.textContent).toBe('Verworfen – der Stand des Servers wird geladen, sobald die Verbindung steht');
    expect(zeile.getAttribute('role')).toBe('status');
    expect(zeile.style.position).not.toBe('fixed');
    expect(zeile.style.position).not.toBe('absolute');
  });

  it('@FU-109 derselbe Hinweis in EN', async () => {
    hoisted.sync.awaitingServerCopyIds = ['T'];
    await renderWithI18n(<AwaitingServerCopyLine tournamentId="T" />, 'en');

    expect(screen.getByTestId('sync-awaiting-server-copy').textContent).toBe('Discarded – the state of the server will load once the connection is back');
  });

  it('@FU-109 unter einem festen Kopf bleibt sie beim Scrollen darunter stehen (sticky), statt über dem Inhalt zu liegen', async () => {
    hoisted.sync.awaitingServerCopyIds = ['T'];
    await renderWithI18n(<AwaitingServerCopyLine tournamentId="T" stickyTop={56} />);

    expect(screen.getByTestId('sync-awaiting-server-copy').style.position).toBe('sticky');
  });

  it('Gegenbeispiel: ist der Stand des Servers übernommen (nichts gemerkt), erscheint keine Zeile', async () => {
    await renderWithI18n(<AwaitingServerCopyLine tournamentId="T" />);

    expect(screen.queryByTestId('sync-awaiting-server-copy')).toBeNull();
  });

  it('Gegenbeispiel @FU-109 je Turnier: wartet ein anderes Turnier, zeigt dieses Turnier keine Zeile', async () => {
    hoisted.sync.awaitingServerCopyIds = ['ANDERES'];
    await renderWithI18n(<AwaitingServerCopyLine tournamentId="T" />);

    expect(screen.queryByTestId('sync-awaiting-server-copy')).toBeNull();
  });

  it('Gegenbeispiel: im Gastmodus (ohne Cloud) keine Zeile', async () => {
    hoisted.sync.awaitingServerCopyIds = ['T'];
    hoisted.sync.isCloudSyncAvailable = false;
    await renderWithI18n(<AwaitingServerCopyLine tournamentId="T" />);

    expect(screen.queryByTestId('sync-awaiting-server-copy')).toBeNull();
  });
});
