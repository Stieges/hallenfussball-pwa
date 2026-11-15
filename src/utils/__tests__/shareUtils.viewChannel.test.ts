/**
 * @RZ-029 Der Kanal-Zusatz an der Zuschauer-Adresse: `?k=q` (QR-Code) und `?k=l` (Link), kurz und mit Hash.
 */
import { describe, expect, it } from 'vitest';
import { generateLiveUrl, generateShortLiveUrl, withViewChannel } from '../shareUtils';

describe('@RZ-029 withViewChannel', () => {
  it('kurze Adresse und Hash-Adresse bekommen ?k=q bzw. ?k=l', () => {
    expect(withViewChannel(generateShortLiveUrl('NIKO26', 'https://h.example'), 'q')).toBe('https://h.example/live/NIKO26?k=q');
    expect(withViewChannel(generateShortLiveUrl('NIKO26', 'https://h.example'), 'l')).toBe('https://h.example/live/NIKO26?k=l');
    expect(withViewChannel(generateLiveUrl('NIKO26', 'https://h.example'), 'q')).toBe('https://h.example/#/live/NIKO26?k=q');
  });

  it('Gegenbeispiel: hat die Adresse schon eine Suche, kommt der Zusatz mit & dazu; die Zieladresse davor bleibt gleich', () => {
    expect(withViewChannel('https://h.example/live/NIKO26?s=finished', 'l')).toBe('https://h.example/live/NIKO26?s=finished&k=l');
    const mitZusatz = withViewChannel(generateShortLiveUrl('NIKO26', 'https://h.example'), 'q');
    expect(mitZusatz.startsWith(generateShortLiveUrl('NIKO26', 'https://h.example'))).toBe(true);
  });
});
