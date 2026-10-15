/**
 * B-28a3-4 Punkt 3: Stand-, Fußzeilen- und Abschlusstext über `t()` (DE und EN, wörtlich). Szenarien: @ZP-052, @BM-023.
 */
import { describe, expect, it } from 'vitest';
import { closedLine, footerLine, standLine } from '../standText';
import { translatorFor } from './pdfText';

const JETZT = new Date(2026, 10, 14, 15, 7);
const de = translatorFor('de');
const en = translatorFor('en');

describe('@ZP-052 Stand im Spielplan-PDF', () => {
  it('DE: „Stand 14.11. 15:07“', () => {
    expect(standLine(JETZT, true, de)).toBe('Stand 14.11. 15:07');
  });

  it('EN: „As of 14.11. 15:07“', () => {
    expect(standLine(JETZT, true, en)).toBe('As of 14.11. 15:07');
  });

  it('@BM-023 Gegenbeispiel: ohne Netz (online: false) steht „– ohne Verbindung“ dahinter, mit Netz nicht', () => {
    expect(standLine(JETZT, false, de)).toBe('Stand 14.11. 15:07 – ohne Verbindung');
    expect(standLine(JETZT, false, en)).toBe('As of 14.11. 15:07 – offline');
    expect(standLine(JETZT, true, de)).not.toContain('ohne Verbindung');
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

describe('@ZP-052 Endstand-Fassung: „abgeschlossen am …“', () => {
  it('DE und EN wörtlich', () => {
    expect(closedLine(JETZT, de)).toBe('abgeschlossen am 14.11. 15:07');
    expect(closedLine(JETZT, en)).toBe('closed on 14.11. 15:07');
  });
});
