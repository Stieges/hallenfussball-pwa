/**
 * A-25c, Auflage M2 (Opus-Review `_005`/A-25c, @W2A-025): Die Einstellung „Wertung bei Nichtantritt“ ist gesperrt,
 * sobald das Turnier eine Wertung enthält – sonst änderte sie gespeicherte Wertungen rückwirkend (Gegentore bei
 * „beide nicht angetreten“). Die Regel steht in `core/models/forfeit.ts` (`forfeitScoreLocked`, `changeForfeitScore`,
 * Tests in `core/standings/__tests__/wertung.einstellungSperre.test.ts`). Das Feld selbst baut B-12 (Wizard-Übergabe
 * A-25c); bis dahin fehlt es – und damit seine Sperre. Erwartet rot mit Befund.
 *
 * Achtung (Review A-25c, S-1): Hier fehlt das „Gegeben“ – das Panel nimmt heute kein Turnier mit Wertung entgegen. Der
 * Test bliebe also auch mit einem richtig gebauten Feld rot (aus dem falschen Grund). B-12 baut ihn neu auf: Turnier
 * MIT Wertung → Feld gesperrt, Gegenbeispiel OHNE Wertung → Feld frei; dann `it.fails` entfernen. Die Sperre gehört
 * außerdem in den Speicherweg (C-WERTUNG-EINSTELLUNG-OHNE-SPERRE), nicht nur ans Feld.
 */
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MatchCockpitSettingsPanel } from '../MatchCockpitSettingsPanel';
import { DEFAULT_MATCH_COCKPIT_SETTINGS } from '../../../types/tournament';

describe('A-25c Auflage M2: Sperre der Einstellung in der Oberfläche', () => {
  it.fails('@W2A-025:teil C-NICHTANTRITT-FEHLT C-WERTUNG-EINSTELLUNG-OHNE-SPERRE das Feld „Wertung bei Nichtantritt“ ist gesperrt, sobald eine Wertung existiert', () => {
    render(<MatchCockpitSettingsPanel settings={DEFAULT_MATCH_COCKPIT_SETTINGS} tournamentId="t1" onChange={() => undefined} />);
    expect(screen.getByTestId('settings-forfeit-score')).toBeDisabled();
  });
});
