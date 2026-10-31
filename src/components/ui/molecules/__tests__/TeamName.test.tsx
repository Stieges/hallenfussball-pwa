/**
 * Aufgabe 3.1 (Spielanzeige): Molekül `TeamName` – Logo bzw. Initialen vor dem Namen, Zusatzzeilen, Umbruch statt „…“.
 * Werte aus dem Gherkin: @ZM-157 (FC Nord ohne Logo → „FN“, SG Mitte mit Logo, zwei freigehaltene Zeilen),
 * @ZM-088 / @ZM-155 (50 Zeichen brechen um, nie „…“), RF4 (offene Seite: Platzhalter statt Initialen).
 */
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { displayLayout } from '../../../../design-tokens';
import { TeamName } from '../TeamName';

const LANG = 'Sportgemeinschaft Fußballfreunde Nordheim-Süd 1921';
type Props = ComponentProps<typeof TeamName>;

function props(over: Partial<Props> = {}): Props {
  return {
    team: { name: 'FC Nord' }, name: 'FC Nord', layout: 'stacked', avatarSize: 'display',
    addons: [], reserveAddonLines: 2, testId: 'tn', ...over,
  };
}

/** Alle Elemente samt Wurzel */
const alle = (root: HTMLElement) => [root, ...Array.from(root.querySelectorAll<HTMLElement>('*'))];

describe('TeamName', () => {
  it('@ZM-157 FC Nord ohne Logo: vor dem Namen „FN“, außerhalb des Kastens', () => {
    render(<TeamName {...props()} />);
    const avatar = screen.getByTestId('tn-avatar');
    expect(avatar).toHaveTextContent('FN');
    expect(avatar.compareDocumentPosition(screen.getByText('FC Nord')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByTestId('tn-box')).toBeNull();
  });

  it('@ZM-157 SG Mitte mit Logo: vor dem Namen das Logo', () => {
    render(<TeamName {...props({ team: { name: 'SG Mitte', logo: { type: 'base64', value: 'data:image/png;base64,AAAA' } }, name: 'SG Mitte' })} />);
    const avatar = screen.getByTestId('tn-avatar');
    expect(avatar.querySelector('img')).not.toBeNull();
    expect(avatar.querySelector('img')).toHaveAttribute('src', 'data:image/png;base64,AAAA');
  });

  it('@ZM-157 zwei freigehaltene Zeilen: Höhe gleich mit 0, 1 und 2 Zusätzen', () => {
    const hoehe = (addons: readonly string[]) => {
      const { unmount } = render(<TeamName {...props({ addons })} />);
      const zeilen = screen.getByTestId('tn-addons');
      const h = `${zeilen.style.minHeight}|${zeilen.style.height}`;
      unmount();
      return h;
    };
    const keiner = hoehe([]);
    expect(keiner).not.toBe('|');
    expect(hoehe(['nach Verlängerung'])).toBe(keiner);
    expect(hoehe(['nach Verlängerung', 'gewertet – nicht gespielt'])).toBe(keiner);
  });

  it('@ZM-157 die Zusätze stehen in ihren Zeilen, nicht im Namen', () => {
    render(<TeamName {...props({ addons: ['nach Verlängerung', 'gewertet – nicht gespielt'] })} />);
    expect(screen.getByTestId('tn-addon-0')).toHaveTextContent('nach Verlängerung');
    expect(screen.getByTestId('tn-addon-1')).toHaveTextContent('gewertet – nicht gespielt');
  });

  it('@ZM-157 Gegenbeispiel: ohne Zusatz keine gefüllte Zusatzzeile, Karte (0 Zeilen) reserviert nichts', () => {
    render(<TeamName {...props({ reserveAddonLines: 0 })} />);
    expect(screen.queryByTestId('tn-addon-0')).toBeNull();
    expect(screen.queryByTestId('tn-addons')).toBeNull();
  });

  it('@ZM-157 Avatar-Platz gleich breit mit und ohne Logo', () => {
    const { unmount } = render(<TeamName {...props()} />);
    const ohne = screen.getByTestId('tn-avatar').style.width;
    unmount();
    render(<TeamName {...props({ team: { name: 'SG Mitte', logo: { type: 'base64', value: 'data:image/png;base64,AAAA' } } })} />);
    expect(screen.getByTestId('tn-avatar').style.width).toBe(ohne);
    expect(ohne).toBe(displayLayout.scoreArea.avatarSize);
  });

  it('@ZM-088 50-Zeichen-Name bricht an Leerzeichen um, kein „…“', () => {
    render(<TeamName {...props({ team: { name: LANG }, name: LANG })} />);
    const wurzel = screen.getByTestId('tn');
    expect(wurzel).toHaveTextContent(LANG);
    for (const el of alle(wurzel)) {
      expect(el.style.textOverflow).not.toBe('ellipsis');
      expect(el.style.hyphens).not.toBe('auto');
      expect(el.style.whiteSpace).not.toBe('nowrap');
    }
  });

  it('@ZM-155 kein Teamname endet mit „…“', () => {
    render(<TeamName {...props({ team: { name: LANG }, name: LANG })} />);
    expect(screen.getByTestId('tn').textContent).not.toMatch(/…|\.\.\.$/);
  });

  it('RF4 offene Seite: Platzhalter statt Initialen', () => {
    render(<TeamName {...props({ team: { name: 'Sieger Halbfinale 1', pending: true }, name: 'Sieger Halbfinale 1' })} />);
    expect(screen.getByTestId('tn-avatar')).toBeInTheDocument();
    expect(screen.getByTestId('tn-avatar')).not.toHaveTextContent('SH');
    expect(screen.getByTestId('tn')).toHaveTextContent('Sieger Halbfinale 1');
  });

  it('inline: Avatar vor dem Namen in einer Zeile, mit Größenstufe', () => {
    render(<TeamName {...props({ layout: 'inline', avatarSize: 'sm', reserveAddonLines: 0 })} />);
    expect(screen.getByTestId('tn-avatar').style.width).toBe('32px');
    expect(screen.getByTestId('tn').dataset.layout).toBe('inline');
  });

  it('Sieger ist fett, Verlierer zurückgenommen (Kennzeichnung am Wurzelelement)', () => {
    render(<TeamName {...props({ emphasis: 'loser' })} />);
    expect(screen.getByTestId('tn').dataset.emphasis).toBe('loser');
  });

  describe('avatarPlacement', () => {
    const LOGO = { type: 'base64' as const, value: 'data:image/png;base64,AAAA' };
    const lage = (a: HTMLElement, b: HTMLElement) => a.compareDocumentPosition(b);

    it('@ZM-157 above (Monitor Live): Avatar mittig über dem Namen, Name behält die volle Breite', () => {
      render(<TeamName {...props({ avatarPlacement: 'above' })} />);
      const reihe = screen.getByTestId('tn-avatar').parentElement!;
      expect(reihe.dataset.avatarPlacement).toBe('above');
      expect(reihe.style.flexDirection).toBe('column');
      expect(reihe.style.alignItems).toBe('center');
      expect(lage(screen.getByTestId('tn-avatar'), screen.getByText('FC Nord')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(screen.getByText('FC Nord').style.width).toBe('100%');
    });

    it('@ZM-185 after (Nächste Spiele, Heimseite): Avatar hinter dem Namen', () => {
      render(<TeamName {...props({ layout: 'inline', avatarSize: 'list', reserveAddonLines: 0, avatarPlacement: 'after' })} />);
      expect(lage(screen.getByText('FC Nord'), screen.getByTestId('tn-avatar')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(screen.getByTestId('tn-avatar').parentElement!.style.flexDirection).toBe('row');
    });

    it('@ZM-185 before (Handy, Gastseite): Avatar vor dem Namen – Standard bleibt unverändert', () => {
      render(<TeamName {...props({ layout: 'inline', avatarSize: 'list', reserveAddonLines: 0 })} />);
      expect(screen.getByTestId('tn-avatar').parentElement!.dataset.avatarPlacement).toBe('before');
      expect(lage(screen.getByTestId('tn-avatar'), screen.getByText('FC Nord')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it('@ZM-185 Team ohne Logo: Initialen im gleich großen Kreis an derselben Stelle wie das Logo, in jeder Lage', () => {
      for (const avatarPlacement of ['before', 'after', 'above'] as const) {
        const ersteAnsicht = render(<TeamName {...props({ avatarPlacement })} />);
        const ohne = screen.getByTestId('tn-avatar');
        const reiheOhne = Array.from(ohne.parentElement!.children).indexOf(ohne);
        const breiteOhne = ohne.style.width;
        ersteAnsicht.unmount();
        const zweiteAnsicht = render(<TeamName {...props({ avatarPlacement, team: { name: 'SG Mitte', logo: LOGO } })} />);
        const mit = screen.getByTestId('tn-avatar');
        expect(Array.from(mit.parentElement!.children).indexOf(mit), `Platz in der Reihe (${avatarPlacement})`).toBe(reiheOhne);
        expect(mit.style.width).toBe(breiteOhne);
        zweiteAnsicht.unmount();
      }
    });
  });
});
