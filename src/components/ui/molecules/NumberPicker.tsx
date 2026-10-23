/**
 * NumberPicker – Nummern-Baustein (Plan Scheibe 3, Aufgabe 3.2; Spec § 5.2).
 *
 * Ein Tipp auf die Nummer übernimmt sie sofort. Das Tor zählt schon mit dem ersten Tipp auf „Tor“ (@SL-083):
 * Schließen über Esc, Zurück, die Abdunkelung oder 10 s ohne Eingabe meldet nur den Grund; die Nummer
 * wird nie geraten. Die ersten 300 ms nach dem Öffnen sind gesperrt (@SL-021, Doppeltipp). „ohne Nummer“
 * liegt gegenüber dem auslösenden Knopf und ist kein Hauptknopf (@SL-020). Keine Felder für Torvorlagen (@SL-037).
 * Mit `tastatur` ist „Andere Nr.“ schon offen und das Feld fokussiert: Eingabetaste übernimmt (nur 1–99, nach der
 * Sperre), Esc schließt. Eine Eingabe außerhalb 1–99 (0, 100, „7a“) weist der Baustein mit einem Hinweis ab; das Tor
 * zählt dann ohne Nummer weiter (@SL-172). Wann `tastatur` gilt (Taste geöffnet oder hover:hover + pointer:fine, nie nach Breite),
 * entscheidet der Aufrufer.
 */
import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent, ReactElement, ReactNode } from 'react';
import { cssVars } from '../../../design-tokens';
import { parseJerseyNumberInput } from '../../../core/match/jerseyNumber';
import { Button } from '../Button';
import { InlineNotice } from './InlineNotice';
import { DialogSurface } from './DialogSurface';

/** @SL-021 */
export const NUMBER_PICKER_SPERRE_MS = 300;
/** @SL-083 */
export const NUMBER_PICKER_ZEITABLAUF_MS = 10_000;

export type NumberPickerSchliessGrund = 'schliessen' | 'abdunkelung' | 'zeitablauf' | 'ohneNummer';
export interface NumberPickerTexte { titel: string; ohneNummer: string; andereNummer: string; uebernehmen: string; eingabeLabel: string; ungueltig: string }
export interface NumberPickerProps {
  isOpen: boolean;
  texte: NumberPickerTexte;
  ausloeserSeite: 'links' | 'rechts';
  onWaehle: (nummer: number) => void;
  onSchliesse: (grund: NumberPickerSchliessGrund) => void;
  eigentor?: { label: string; onWaehle: () => void };
  kopf?: ReactNode;
  /** Tastatur-Modus: Feld offen und fokussiert, Eingabetaste übernimmt */
  tastatur?: boolean;
  testId?: string;
}

const NUMMERN = Array.from({ length: 20 }, (_, i) => i + 1);
const knopfMass: CSSProperties = { minHeight: cssVars.touchTargets.minimum, minWidth: cssVars.touchTargets.minimum };
const rasterStil: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: cssVars.spacing.sm };
const flaecheStil: CSSProperties = { display: 'flex', flexDirection: 'column', gap: cssVars.spacing.md, padding: cssVars.spacing.lg };
const feldStil: CSSProperties = {
  fontSize: cssVars.fontSizes.lg,
  minHeight: cssVars.touchTargets.minimum,
  minWidth: 0,
  boxSizing: 'border-box',
  padding: `0 ${cssVars.spacing.md}`,
  background: cssVars.colors.surface,
  color: cssVars.colors.textPrimary,
  border: `${cssVars.borderWidth.thin} solid ${cssVars.colors.borderControl}`,
  borderRadius: cssVars.borderRadius.md,
};

export function NumberPicker({
  isOpen, texte, ausloeserSeite, onWaehle, onSchliesse, eigentor, kopf, tastatur = false, testId = 'number-picker',
}: NumberPickerProps): ReactElement | null {
  // Sperre als Zeitgeber, nicht über Date.now(): E2E und Bildtests frieren Date ein (freezeClock), Zeitgeber laufen weiter.
  const gesperrtRef = useRef(true);
  const [andere, setAndere] = useState<string | null>(tastatur ? '' : null);
  const [eingabeTakt, setEingabeTakt] = useState(0);
  const feldRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!isOpen) { return undefined; }
    gesperrtRef.current = true;
    setAndere(tastatur ? '' : null);
    const sperre = setTimeout(() => { gesperrtRef.current = false; }, NUMBER_PICKER_SPERRE_MS);
    return () => clearTimeout(sperre);
  }, [isOpen, tastatur]);
  // onSchliesse über eine Ref: Das Cockpit rendert durch den Uhr-Takt laufend neu und übergibt jedes Mal eine neue
  // Funktion – hinge der Zeitgeber an onSchliesse, startete er ständig von vorn und „10 s ohne Eingabe“ griffe nie.
  const onSchliesseRef = useRef(onSchliesse);
  onSchliesseRef.current = onSchliesse;
  useEffect(() => {
    if (!isOpen) { return undefined; }
    const timer = setTimeout(() => onSchliesseRef.current('zeitablauf'), NUMBER_PICKER_ZEITABLAUF_MS);
    return () => clearTimeout(timer);
  }, [isOpen, eingabeTakt]);

  const tippe = (fn: () => void) => () => { if (!gesperrtRef.current) { fn(); } };
  const eingabe = parseJerseyNumberInput(andere ?? '');
  const nummer = eingabe === 'ungueltig' ? null : eingabe;
  const gueltig = nummer !== null;
  const uebernehmen = tippe(() => { if (nummer !== null) { onWaehle(nummer); } });
  const onFeldTaste = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      uebernehmen();
    }
  };
  const gegenueber = ausloeserSeite === 'links' ? 'rechts' : 'links';

  return (
    <DialogSurface isOpen={isOpen} onClose={() => onSchliesse('schliessen')} onBackdropClick={() => onSchliesse('abdunkelung')}
      ariaLabel={texte.titel} testId={testId} scrimTestId={`${testId}-scrim`}
      initialFocusRef={tastatur ? feldRef : undefined}>
      <div style={flaecheStil}>
        <h2 style={{ fontSize: cssVars.fontSizes.lg, margin: 0 }}>{texte.titel}</h2>
        {kopf}
        {eigentor && <Button variant="secondary" onClick={tippe(eigentor.onWaehle)} style={knopfMass}>{eigentor.label}</Button>}
        <div style={rasterStil}>
          {NUMMERN.map((n) => (
            <Button key={n} variant="secondary" onClick={tippe(() => onWaehle(n))} style={knopfMass}>{String(n)}</Button>
          ))}
        </div>
        {andere === null ? (
          <Button variant="ghost" onClick={tippe(() => setAndere(''))} style={knopfMass}>{texte.andereNummer}</Button>
        ) : (
          <div style={{ display: 'flex', gap: cssVars.spacing.sm, alignItems: 'flex-end' }}>
            <label htmlFor={`${testId}-andere`}>{texte.eingabeLabel}</label>
            <input
              id={`${testId}-andere`}
              inputMode="numeric"
              pattern="[0-9]*"
              value={andere}
              style={feldStil}
              ref={feldRef}
              onKeyDown={onFeldTaste}
              onChange={(e) => { setAndere(e.target.value); setEingabeTakt((n) => n + 1); }}
            />
            <Button variant="primary" disabled={!gueltig} onClick={uebernehmen} style={knopfMass}>{texte.uebernehmen}</Button>
          </div>
        )}
        {eingabe === 'ungueltig' && (
          <InlineNotice tone="warn" data-testid={`${testId}-ungueltig`}>{texte.ungueltig}</InlineNotice>
        )}
        <div data-lage={gegenueber} style={{ display: 'flex', justifyContent: ausloeserSeite === 'links' ? 'flex-end' : 'flex-start' }}>
          <Button variant="ghost" onClick={tippe(() => onSchliesse('ohneNummer'))} style={knopfMass}>{texte.ohneNummer}</Button>
        </div>
      </div>
    </DialogSurface>
  );
}
