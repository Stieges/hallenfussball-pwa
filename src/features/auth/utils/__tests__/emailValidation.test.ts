/**
 * validateEmail — Registrierungs-Prüfung der E-Mail-Adresse (A-07h, Abdeckung features/auth).
 *
 * Jeder Fall hat ein Gegenbeispiel: eine Adresse, die gültig bleiben muss, oder ein Fehler,
 * der NICHT auftreten darf.
 */
import { describe, it, expect } from 'vitest';
import { validateEmail } from '../emailValidation';

describe('validateEmail', () => {
  it('weist eine leere Eingabe mit Pflichtfeld-Meldung ab', () => {
    expect(validateEmail('   ')).toEqual({ isValid: false, error: 'E-Mail ist erforderlich' });
  });

  it('akzeptiert eine gewöhnliche Adresse und ignoriert Groß-/Kleinschreibung und Leerzeichen', () => {
    expect(validateEmail('  Max.Mustermann@Example.DE ')).toEqual({ isValid: true });
  });

  it('weist ein Format ohne @ mit der Format-Meldung ab', () => {
    expect(validateEmail('max.example.de')).toEqual({
      isValid: false,
      error: 'Bitte gib eine gültige E-Mail-Adresse ein',
    });
  });

  it('weist einen Lokalteil über 64 Zeichen ab', () => {
    const local = 'a'.repeat(65);

    expect(validateEmail(`${local}@example.de`)).toEqual({
      isValid: false,
      error: 'E-Mail-Adresse vor @ ist zu lang',
    });
  });

  it('Gegenbeispiel: ein Lokalteil mit genau 64 Zeichen ist erlaubt', () => {
    const local = 'a'.repeat(64);

    expect(validateEmail(`${local}@example.de`)).toEqual({ isValid: true });
  });

  it('bietet bei häufigem Tippfehler der Domain eine Korrektur an', () => {
    expect(validateEmail('max@gmial.com')).toEqual({
      isValid: false,
      error: 'Meintest du max@gmail.com?',
      suggestion: 'max@gmail.com',
    });
  });

  it('Gegenbeispiel: die korrekte Domain gmail.com wird nicht als Tippfehler gemeldet', () => {
    expect(validateEmail('max@gmail.com')).toEqual({ isValid: true });
  });

  it('sperrt bekannte Wegwerf-Domains', () => {
    expect(validateEmail('max@mailinator.com')).toEqual({
      isValid: false,
      error: 'Wegwerf-E-Mail-Adressen sind nicht erlaubt',
    });
  });

  it('Gegenbeispiel: eine normale Domain, die nur ähnlich klingt, wird nicht gesperrt', () => {
    expect(validateEmail('max@mailinator.de')).toEqual({ isValid: true });
  });

  it('lässt unbekannte kurze Endungen durch (nur sehr lange Endungen werden abgelehnt)', () => {
    expect(validateEmail('max@example.xyz')).toEqual({ isValid: true });
  });

  it('weist eine unbekannte, sehr lange Endung ab', () => {
    expect(validateEmail('max@example.abcdefgh')).toEqual({
      isValid: false,
      error: 'Bitte überprüfe die Domain-Endung',
    });
  });

  it('Gegenbeispiel: eine kurze bekannte Endung wie .gov bleibt gültig', () => {
    expect(validateEmail('max@stadt.gov')).toEqual({ isValid: true });
  });
});
