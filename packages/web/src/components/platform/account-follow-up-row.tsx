import { useState } from 'react';
import { formatDistanceToNowStrict } from 'date-fns';
import { ChevronDown, ShieldCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  ACCOUNT_STAGES,
  membershipBucket,
  type PlatformFollowUpRow,
  type ProjectRole,
} from '@luma/shared';
import { RowCard, RowCardAction, RowCardBody, RowCardEnd } from '@/components/common/row-card-list';
import { Badge } from '@/components/ui/badge';
import { useDateLocale } from '@/hooks/use-date-locale';
import { HEALTH_TONE, MEMBERSHIP_TONE } from '@/lib/platform-accounts';
import { cn } from '@/lib/utils';

/** Cuánto de la cadena de etapas está cumplido, de 1 a 6. */
function stageProgress(stage: PlatformFollowUpRow['stage']) {
  return ACCOUNT_STAGES.indexOf(stage) + 1;
}

/**
 * Una cuenta con membresía, como fila. Línea 1: quién es. Líneas 2 y 3: mail,
 * alta y estado de la membresía; y lo que hizo, solo en cantidades. A la
 * derecha, en qué etapa está, el estado de la membresía y el semáforo. "Ver"
 * abre el detalle; nunca muestra nombres de clientes, descripciones ni montos.
 */
export function AccountFollowUpRow({ row }: { row: PlatformFollowUpRow }) {
  const { t } = useTranslation();
  const locale = useDateLocale();
  const [open, setOpen] = useState(false);

  const bucket = membershipBucket(row.membership);
  const joined = formatDistanceToNowStrict(new Date(row.createdAt), { locale, addSuffix: true });
  const lastAction = row.lastActionAt
    ? formatDistanceToNowStrict(new Date(row.lastActionAt), { locale, addSuffix: true })
    : t('platform.followUp.noActivity');
  // Solo la prueba dice algo que las etiquetas no dicen: cuántos días le quedan.
  const term =
    row.membership === 'prueba' && row.trialDaysLeft !== null
      ? t('platform.followUp.trialLeft', { count: row.trialDaysLeft })
      : null;
  const invitedParts = (Object.entries(row.invitedByRole) as [ProjectRole, number][]).map(
    ([role, count]) => `${count} ${t(`project.role.${role}`).toLowerCase()}`,
  );
  const progress = stageProgress(row.stage);
  const detailId = `follow-up-${row.id}`;

  return (
    <RowCard>
      <RowCardBody
        title={<span className="truncate">{row.name}</span>}
        meta={
          <>
            <span className="block break-words">
              {[row.email, t('platform.followUp.joined', { when: joined }), term]
                .filter(Boolean)
                .join(' · ')}
            </span>
            <span className="block break-words">
              {[
                t('platform.followUp.metrics.projects', { count: row.projects }),
                t('platform.followUp.metrics.invited', { count: row.invited }),
                t('platform.followUp.metrics.activities', { count: row.activities }),
                t('platform.followUp.lastAction', { when: lastAction }),
              ].join(' · ')}
            </span>
          </>
        }
      />
      <div className="flex w-full flex-col gap-1.5 sm:w-44 sm:shrink-0">
        <span className="text-xs text-muted-foreground">
          {t(`platform.funnel.stages.${row.stage}`)}
        </span>
        <div
          role="img"
          aria-label={t('platform.followUp.stageProgress', {
            current: progress,
            total: ACCOUNT_STAGES.length,
          })}
          className="flex gap-0.5"
        >
          {ACCOUNT_STAGES.map((stage, index) => (
            <span
              key={stage}
              className={cn('h-1 flex-1 rounded-full', index < progress ? 'bg-primary' : 'bg-muted')}
            />
          ))}
        </div>
      </div>
      <RowCardEnd>
        {bucket && (
          <Badge variant={MEMBERSHIP_TONE[bucket]}>
            {t(`platform.census.membership.${bucket}`)}
          </Badge>
        )}
        <Badge variant={HEALTH_TONE[row.health]} icon>
          {t(`platform.followUp.health.${row.health}`)}
        </Badge>
        <RowCardAction
          type="button"
          aria-expanded={open}
          aria-controls={detailId}
          onClick={() => setOpen((current) => !current)}
        >
          {t('platform.followUp.view')}
          <ChevronDown className={cn('size-4 transition-transform', open && 'rotate-180')} />
        </RowCardAction>
      </RowCardEnd>

      {open && (
        <div id={detailId} className="flex basis-full flex-col gap-4 border-t border-border pt-4">
          <ol className="grid grid-cols-2 gap-3 sm:grid-cols-6">
            {ACCOUNT_STAGES.map((stage, index) => (
              <li key={stage} className="flex flex-col gap-2 text-xs">
                <span
                  className={cn('h-1 rounded-full', index < progress ? 'bg-primary' : 'bg-muted')}
                />
                <span className={index < progress ? 'text-foreground' : 'text-muted-foreground'}>
                  {t(`platform.funnel.stages.${stage}`)}
                </span>
              </li>
            ))}
          </ol>
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Fact label={t('platform.followUp.detail.projects')} value={String(row.projects)} />
            <Fact
              label={t('platform.followUp.detail.invited')}
              value={String(row.invited)}
              hint={invitedParts.length > 0 ? invitedParts.join(' · ') : t('platform.followUp.detail.noInvites')}
            />
            <Fact label={t('platform.followUp.detail.activities')} value={String(row.activities)} />
            <Fact label={t('platform.followUp.detail.lastAction')} value={lastAction} />
          </dl>
          <p className="flex items-start gap-2 text-xs text-muted-foreground">
            <ShieldCheck aria-hidden className="mt-0.5 size-4 shrink-0" />
            {t('platform.followUp.privacy', { name: row.name.split(' ')[0] })}
          </p>
        </div>
      )}
    </RowCard>
  );
}

function Fact({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-lg tabular-nums">{value}</dd>
      {hint && <dd className="text-xs text-muted-foreground">{hint}</dd>}
    </div>
  );
}
