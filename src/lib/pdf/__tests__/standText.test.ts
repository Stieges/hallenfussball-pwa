/**
 * B-28a3-4 Punkt 3: Stand-, Fußzeilen- und Abschlusstext über `t()` (DE und EN, wörtlich). Szenarien: @ZP-052, @BM-023.
 */
import { describe, expect, it } from 'vitest';
import { closedLine, footerLine, standLine } from '../standText';
import { translatorFor } from './pdfText';

const JETZT = new Date(2026, 10, 14, 15, 7);
const ABSCHLUSS = new Date(2026, 10, 14, 17, 40);
const de = translatorFor('de');
const en = translatorFor('en');

describe('@ZP-052 Stand im Spielplan-PDF', () => {
  it('DE: „Stand 14.11. 15:07“', () => {
    expect(standLine(JETZT, true, de)).toBe('Stand 14.11. 15:07');
  });

  it('EN: „As of 14.11. 15:07“', () => {
    expect(standLine(JETZT, true, en)).toBe('As of 14.11. 15:07');
  });

  it('@BM-023 ohne Netz (online: false): „– ohne Verbindung, Einträge anderer Geräte können fehlen“, wörtlich', () => {
    expect(standLine(JETZT, false, de)).toBe('Stand 14.11. 15:07 – ohne Verbindung, Einträge anderer Geräte können fehlen');
    expect(standLine(JETZT, false, en)).toBe('As of 14.11. 15:07 – offline, entries from other devices may be missing');
  });

  it('@BM-023 Gegenbeispiel: mit Netz (online: true) steht kein Zusatz', () => {
    expect(standLine(JETZT, true, de)).not.toContain('ohne Verbindung');
    expect(standLine(JETZT, true, en)).not.toContain('offline');
  });
});

describe('@ZP-052 Fußzeile: Titel · Stand · Seite', () => {
  it('DE: „Hallencup Nord · Stand 14.11. 15:07 · Seite 2 von 3“', () => {
    expect(footerLine('Hallencup Nord', standLine(JETZT, true, de), 2, 3, de)).toBe(
      'Hallencup Nord · Stand 14.11. 15:07 · Seite 2 von 3',
    );
  });

  it('EN: „Hallencup Nord · As of 14.11. 15:07 · Page 2 of 3“', () => {
    expect(footerLine('Hallencup Nord', standLine(JETZT, true, en), 2, 3, en)).toBe(
      'Hallencup Nord · As of 14.11. 15:07 · Page 2 of 3',
    );
  });
});

describe('@BM-035 @DR-011 Endstand-Fassung: „Endstand – abgeschlossen am …“ (B-28a3-4F F2)', () => {
  it('DE wörtlich: „Endstand – abgeschlossen am 14.11.2026 um 17:40“', () => {
    expect(closedLine(ABSCHLUSS, de)).toBe('Endstand – abgeschlossen am 14.11.2026 um 17:40');
  });

  it('EN sinngleich mit Jahr und Uhrzeit: „Final result – closed on 14.11.2026 at 17:40“', () => {
    expect(closedLine(ABSCHLUSS, en)).toBe('Final result – closed on 14.11.2026 at 17:40');
  });
});
