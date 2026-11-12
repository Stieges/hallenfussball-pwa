/**
 * StatusZeile – die gemeinsame Statuszeile unter dem Kopf (G6, @HT-045): ordnet und kürzt ihre Pillen. Fachfrei: Verwaltung, Cockpit
 * und die Probe liefern nur `StatusEintrag`; hier steht kein Wissen über Lautsprecher oder Probe.
 *  - Reihenfolge: `rang` (stoerung → probe → hinweis → bereit), dann `reihe`.
 *  - Mehr als zwei Einträge: Störung und Probe bleiben, die übrigen werden zu „+n weitere“ (öffnet die Liste).
 *  - Unter 480 px und bei zwei oder mehr Einträgen gilt `kurz` statt `text`.
 *  - Ohne Einträge rendert sie nichts (kein leerer Streifen).
 * Zusammenfassen mehrerer Felder zu einem Eintrag („Feld 1, 2 nicht bereit“) macht der Gastgeber vorher, nicht diese Zeile.
 * Eine Zeile im normalen Fluss über die volle Breite, die Pillen brechen in die nächste Zeile um und überlagern nichts.
 */
import { useState, type CSSProperties, type ReactElement } from 'react';
import { cssVars, iconSizeValues } from '../../../design-tokens';
import { Icons } from '../Icons';
import { StatusPille } from '../atoms/StatusPille';
import { kuerzeEintraege, sortiereEintraege } from './statusZeileLogik';
import type { StatusEintrag, StatusZeileProps } from './statusZeileTypen';
import { useSchmaleBreite } from './statusZeileBreite';

export type { StatusEintrag, StatusRang, StatusZeileProps } from './statusZeileTypen';

const zeileStil: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: cssVars.spacing.xs,
  boxSizing: 'border-box',
  width: '100%',
  padding: `${cssVars.spacing.xs} ${cssVars.spacing.sm}`,
  backgroundColor: cssVars.colors.surfaceSolid,
  borderBottom: `${cssVars.borderWidth.thin} solid ${cssVars.colors.border}`,
};

const gruppeStil: CSSProperties = { display: 'inline-flex', flexWrap: 'wrap', alignItems: 'center', gap: cssVars.spacing.xs, maxWidth: '100%' };

export function StatusZeile({ eintraege, weitereText, onNavigiere, label, 'data-testid': testId = 'status-zeile' }: StatusZeileProps): ReactElement | null {
  const schmal = useSchmaleBreite();
  const [aufgeklappt, setAufgeklappt] = useState(false);
  const sortiert = sortiereEintraege(eintraege);
  const weitere = kuerzeEintraege(sortiert, false).weitere;
  // Schrumpft die Liste auf höchstens zwei Einträge, verschwindet die Sammelpille: das Aufklappen gilt dann nicht mehr (kein Aufklappen „auf Vorrat“)
  if (weitere === 0 && aufgeklappt) { setAufgeklappt(false); }
  if (eintraege.length === 0) { return null; }
  const kurz = schmal && eintraege.length >= 2;
  const sichtbar = kuerzeEintraege(sortiert, aufgeklappt).sichtbar;

  const pille = (e: StatusEintrag): ReactElement => (
    <StatusPille
      key={e.id}
      ton={e.ton}
      symbol={e.symbol}
      rand={e.rand}
      aktion={e.aktion}
      onNavigiere={onNavigiere}
      lesetext={e.lesetext}
      data-testid={`${testId}-${e.id}`}
    >
      {kurz ? (e.kurz ?? e.text) : e.text}
    </StatusPille>
  );
  const mitDaneben = (e: StatusEintrag): ReactElement =>
    e.daneben === undefined ? pille(e) : <span key={e.id} style={gruppeStil}>{pille(e)}{pille(e.daneben)}</span>;

  return (
    <div role="region" aria-label={label} style={zeileStil} data-testid={testId} data-kurz={kurz}>
      {sichtbar.map(mitDaneben)}
      {weitere > 0 ? (
        <StatusPille
          ton="neutral"
          rand="gestrichelt"
          symbol={aufgeklappt ? <Icons.ChevronUp size={iconSizeValues.xs} /> : <Icons.ChevronDown size={iconSizeValues.xs} />}
          aktion={{ art: 'ausloesen', onClick: () => setAufgeklappt((a) => !a) }}
          aria-expanded={aufgeklappt}
          data-testid={`${testId}-weitere`}
        >
          {weitereText(weitere)}
        </StatusPille>
      ) : null}
    </div>
  );
}
