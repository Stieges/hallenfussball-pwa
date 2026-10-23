/**
 * B-14 (@W1-030, @W1-031): Häkchen „Ansprechpartner öffentlich zeigen“ unter den Kontaktdaten. Ohne Häkchen bleibt der Kontakt
 * intern (der Server liefert ihn dann nicht aus, scripts/public-payload-check.sh); am Häkchen steht, wer die Angaben sieht.
 * react-i18next ist global gemockt (Schlüssel statt Text); der Wortlaut DE/EN prüft terms:check.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ContactForm } from '../ContactForm';
import type { ContactInfo } from '../../types/tournament';

const olli: ContactInfo = { name: 'Olga Orga', email: 'olga@orga.test', phone: '0171 1112223' };

describe('ContactForm – Ansprechpartner öffentlich zeigen (B-14)', () => {
  it('@W1-031 am Häkchen steht, wer die Angaben sehen kann (Hinweis vor dem Setzen)', () => {
    render(<ContactForm value={olli} onChange={vi.fn()} />);
    expect(screen.getByText('wizard:contact.showPublic')).toBeInTheDocument();
    expect(screen.getByText('wizard:contact.showPublicHint')).toBeInTheDocument();
  });

  it('@W1-030 Vorbelegung: Häkchen nicht gesetzt', () => {
    render(<ContactForm value={olli} onChange={vi.fn()} />);
    expect(screen.getByTestId('contact-show-public')).not.toBeChecked();
  });

  it('@W1-031 Häkchen setzen → showPublic true, Angaben bleiben', () => {
    const onChange = vi.fn();
    render(<ContactForm value={olli} onChange={onChange} />);
    fireEvent.click(screen.getByTestId('contact-show-public'));
    expect(onChange).toHaveBeenCalledWith({ ...olli, showPublic: true });
  });

  it('@W1-030 Gegenbeispiel: Häkchen wieder entfernen → kein showPublic (intern)', () => {
    const onChange = vi.fn();
    render(<ContactForm value={{ ...olli, showPublic: true }} onChange={onChange} />);
    expect(screen.getByTestId('contact-show-public')).toBeChecked();
    fireEvent.click(screen.getByTestId('contact-show-public'));
    expect(onChange).toHaveBeenCalledWith({ ...olli, showPublic: undefined });
  });
});
