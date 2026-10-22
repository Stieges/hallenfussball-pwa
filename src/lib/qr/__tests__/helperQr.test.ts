/**
 * Adresse des Helfer-QR-Codes (A-18a, @HE-001): der QR trägt die Beitrittsadresse, nie die Zuschauer- oder Monitor-Adresse.
 */
import { describe, it, expect } from 'vitest';
import { helperJoinUrl, shortHelperJoinAddress } from '../helperQr';

describe('helperJoinUrl', () => {
  it('führt zum Beitritt: <Ursprung>/#/join/<Code> (HashRouter)', () => {
    expect(helperJoinUrl('K7MQ4X9R2P', 'https://hallen.example')).toBe('https://hallen.example/#/join/K7MQ4X9R2P');
  });
  it('Gegenbeispiel: nie /live, /display oder /tv', () => {
    expect(helperJoinUrl('K7MQ4X9R2P', 'https://hallen.example')).not.toMatch(/\/(live|display|tv)\b/);
  });
  it('maskiert fremde Zeichen im Code', () => {
    expect(helperJoinUrl('A/B', 'https://x.example')).toBe('https://x.example/#/join/A%2FB');
  });
  it('Kurzadresse = QR-Adresse ohne https://', () => {
    expect(shortHelperJoinAddress('https://hallen.example/#/join/ABC')).toBe('hallen.example/#/join/ABC');
  });
});
