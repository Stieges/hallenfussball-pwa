/**
 * Warteschirm nach „Anfrage senden“ (A-17b, Mockup M1 `e6`, @HE-001, @HE-004, @OB-053): Turnierkarte, „Anfrage von Tom“, die
 * Prüfzahl groß (`CheckNumberBadge`), „Wartet auf Freigabe durch die Turnierleitung“. Der Schirm hat bewusst keine Taste und
 * keine Turnier-Inhalte. Dieselbe Zahl sieht die Turnierleitung bei der Anfrage und tippt sie beim Zulassen (S-1).
 */
import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckNumberBadge } from '../../../components/ui/molecules/CheckNumberBadge';
import { cssVars } from '../../../design-tokens';
import type { JoinTournament } from '../joinFlow';
import { JoinInfoCard } from './JoinInfoCard';
import { JoinNotice } from './JoinNotice';

export interface JoinWaitingCardProps {
  tournament: JoinTournament | null;
  /** Name der Anfrage; fehlt beim erneuten Scannen (der Server liefert ihn nicht zurück). */
  name: string;
  checkNumber: number | null;
}

const card: CSSProperties = {
  display: 'grid',
  justifyItems: 'center',
  textAlign: 'center',
  gap: cssVars.spacing.sm,
  border: `${cssVars.borderWidth.thin} solid ${cssVars.colors.border}`,
  background: cssVars.colors.surface,
  borderRadius: cssVars.borderRadius.md,
  padding: cssVars.spacing.md,
};
const meta: CSSProperties = { margin: 0, color: cssVars.colors.textSecondary, fontSize: cssVars.fontSizes.sm };

export const JoinWaitingCard = ({ tournament, name, checkNumber }: JoinWaitingCardProps) => {
  const { t } = useTranslation('helpers');
  return (
    <>
      {tournament ? <JoinInfoCard title={tournament.title} date={tournament.date} /> : null}
      <section style={card} data-testid="join-waiting">
        {name ? <p style={meta}>{t('join.waiting.requestFrom')} <b>{name}</b></p> : null}
        {checkNumber !== null ? (
          <>
            <CheckNumberBadge value={checkNumber} size="big" label={`${t('join.waiting.checkNumber')} ${checkNumber}`} />
            <p style={meta}>{t('join.waiting.checkNumber')}</p>
          </>
        ) : null}
      </section>
      <JoinNotice
        tone="info"
        title={t('join.waiting.title')}
        text={t('join.waiting.text')}
        data-testid="join-pending-notice"
      />
    </>
  );
};
