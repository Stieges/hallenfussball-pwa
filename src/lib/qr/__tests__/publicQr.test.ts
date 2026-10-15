/**
 * B-28 C4 – Adresse und Matrix des Zuschauer-QR-Codes (@BM-043, @ZM-064, @BM-009). Rein, ohne Dokument.
 */
// @vitest-environment node
import QRCode from 'qrcode';
import { describe, expect, it } from 'vitest';
import { generateLiveUrl, generateTournamentUrl } from '../../../utils/shareUtils';
import { qrModules, viewerUrl } from '../publicQr';

describe('@BM-043 viewerUrl: nur die Zuschauer-Adresse', () => {
  it('geteiltes Turnier: genau die Adresse des Teilen-Links, mit /live/', () => {
    const url = viewerUrl({ isPublic: true, shareCode: 'ABC123' });

    expect(url).toBe(generateLiveUrl('ABC123'));
    expect(url).toContain('/live/ABC123');
  });

  it.each([
    ['nicht geteilt', { isPublic: false, shareCode: 'ABC123' }],
    ['ohne Schalter', { shareCode: 'ABC123' }],
    ['ohne Code', { isPublic: true }],
    ['leerer Code', { isPublic: true, shareCode: '' }],
  ])('Gegenbeispiel @ZM-064: %s ergibt keine Adresse', (_name, tournament) => {
    expect(viewerUrl(tournament)).toBeNull();
  });

  it('Gegenbeispiel: nie die Verwaltungs-, Anzeige- oder Beitrittsadresse', () => {
    const url = viewerUrl({ isPublic: true, shareCode: 'ABC123' }) ?? '';

    expect(url).not.toBe(generateTournamentUrl('ABC123'));
    for (const fremd of ['/join', '/display/', '/tv']) {
      expect(url, fremd).not.toContain(fremd);
    }
  });
});

describe('@BM-009 qrModules: die Matrix der Adresse', () => {
  it('ist quadratisch und stimmt Zelle für Zelle mit QRCode.create überein', () => {
    const url = generateLiveUrl('ABC123');
    const expected = QRCode.create(url, {}).modules;
    const matrix = qrModules(url);

    expect(matrix.length).toBe(expected.size);
    matrix.forEach(row => expect(row.length).toBe(expected.size));
    for (let r = 0; r < expected.size; r++) {
      for (let c = 0; c < expected.size; c++) {
        expect(matrix[r][c], `Zelle ${r}/${c}`).toBe(Boolean(expected.get(r, c)));
      }
    }
  });

  it('Gegenbeispiel: eine andere Adresse ergibt eine andere Matrix', () => {
    const live = qrModules(generateLiveUrl('ABC123')).flat().join('');
    const join = qrModules(generateTournamentUrl('ABC123')).flat().join('');

    expect(live).not.toBe(join);
  });
});
