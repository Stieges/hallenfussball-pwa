/**
 * „Leibchenfarben dieses Turniers“ im Reiter „Teams“ der Verwaltung (@W3-029, @W3-041): derselbe Baustein wie im Assistenten
 * (`BibColorsSettings`), auch nach dem Veröffentlichen und am Turniertag. Die Auswahl ist ein Entwurf, „Speichern“ schreibt das
 * Turnier einmal (gleicher Weg wie die Trikotfarben). Die Änderung gilt ab dem nächsten Vorschlag; bestätigte Leibchen der Spiele
 * bleiben (sie stehen am Spiel), eine offene Karte rechnet neu. Angezeigt nur, wo die Turnierleitung ändern darf (`teams`).
 */
import { useEffect, useState, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Card } from '../../../components/ui';
import { cssVars } from '../../../design-tokens';
import type { Tournament } from '../../../types/tournament';
import { BibColorsSettings } from '../../tournament-creation/components/BibColorsSettings';

type BibFields = Pick<Tournament, 'bibColor' | 'bibColors' | 'bibRule'>;
const bibOf = (t: BibFields): BibFields => ({ bibColor: t.bibColor, bibColors: t.bibColors, bibRule: t.bibRule });
const key = (b: BibFields): string => JSON.stringify([b.bibColors ?? (b.bibColor === undefined ? [] : [b.bibColor]), b.bibRule ?? 'home']);

export interface TeamsBibColorsProps {
  tournament: Tournament;
  onTournamentUpdate: (tournament: Tournament) => void;
}

export function TeamsBibColors({ tournament, onTournamentUpdate }: TeamsBibColorsProps): ReactElement {
  const { t } = useTranslation('tournament');
  const [draft, setDraft] = useState<BibFields>(bibOf(tournament));
  const savedKey = key(bibOf(tournament));
  useEffect(() => { setDraft(bibOf(tournament)); }, [savedKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const dirty = key(draft) !== savedKey;

  const update = <K extends keyof BibFields>(field: K, value: BibFields[K]): void => {
    setDraft((prev) => ({ ...prev, [field]: value }));
  };
  const save = (): void => {
    onTournamentUpdate({ ...tournament, ...draft, updatedAt: new Date().toISOString() });
  };

  return (
    <Card style={{ marginBottom: cssVars.spacing.lg }}>
      <div data-testid="teams-bib-colors">
        <BibColorsSettings formData={draft} onUpdate={update} />
        <Button variant="primary" disabled={!dirty} onClick={save} data-testid="teams-bib-save">{t('teams.bib.save')}</Button>
      </div>
    </Card>
  );
}
