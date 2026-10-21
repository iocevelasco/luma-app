import { AlertTriangle, Hourglass, Lock, Receipt, type LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useCurrentProjectId } from '@/hooks/projects/use-current-project-id';
import { useProject } from '@/hooks/projects/use-project-queries';
import { useMySubscription } from '@/hooks/subscription/use-subscription-queries';
import { ROUTES } from '@/lib/routes';
import { subscriptionNotice, type NoticeTone } from '@/lib/subscription';
import { cn } from '@/lib/utils';
import { useAuth } from '@/providers/auth-provider';

const TONE_CLASSES: Record<NoticeTone, string> = {
  info: 'border-info/40 bg-info/10',
  warning: 'border-warning/50 bg-warning/10',
  danger: 'border-destructive/50 bg-destructive/10',
};

const ICON_BY_KEY: Record<string, LucideIcon> = {
  trialEnding: Hourglass,
  inReview: Receipt,
  paymentFailed: AlertTriangle,
  expired: Lock,
  readOnlyProject: Lock,
};

function NoticeBar({
  tone,
  icon: Icon,
  message,
  action,
}: {
  tone: NoticeTone;
  icon: LucideIcon;
  message: string;
  action?: { label: string; to: string };
}) {
  return (
    <div
      role="status"
      className={cn(
        'mb-4 flex flex-wrap items-center gap-3 rounded-2xl border px-4 py-3 text-sm',
        TONE_CLASSES[tone],
      )}
    >
      <Icon className={cn('size-4 shrink-0', tone === 'danger' && 'text-destructive')} />
      <p className="min-w-0 flex-1">{message}</p>
      {action && (
        <Button asChild size="sm" variant="outline">
          <Link to={action.to}>{action.label}</Link>
        </Button>
      )}
    </div>
  );
}

/**
 * El aviso de la suscripción arriba de cada pantalla del panel.
 *
 * Dos avisos posibles, en este orden:
 * 1. El de MI suscripción (prueba que se termina, pago en revisión, cobro
 *    fallido, vencida), con el link a la pantalla de Suscripción.
 * 2. Dentro de una obra de otro que está en sólo lectura porque venció la
 *    suscripción de SU dueño: sin link, porque no es algo que yo pueda pagar.
 *
 * En la pantalla de Suscripción no se muestra: ahí el estado ya es el título.
 */
export function SubscriptionNotice() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const { user } = useAuth();
  const { data: subscription } = useMySubscription();
  const projectId = useCurrentProjectId();
  const { data: projectData } = useProject(projectId);

  if (pathname === ROUTES.SUBSCRIPTION) return null;

  const notice = subscriptionNotice(subscription);
  const project = projectData?.project;
  // ¿Es la obra de otro? Por identidad, no por rol: si es mía, el aviso de
  // mi suscripción vencida ya lo dice (y con el link para pagar).
  const foreignReadOnly = Boolean(project?.readOnly && project.createdBy !== user?.id);

  if (notice) {
    return (
      <NoticeBar
        tone={notice.tone}
        icon={ICON_BY_KEY[notice.key]!}
        message={t(`subscription.notice.${notice.key}`, { count: notice.count })}
        action={{ label: t('subscription.notice.action'), to: ROUTES.SUBSCRIPTION }}
      />
    );
  }

  if (foreignReadOnly) {
    return (
      <NoticeBar
        tone="info"
        icon={ICON_BY_KEY.readOnlyProject!}
        message={t('subscription.notice.readOnlyProject')}
      />
    );
  }

  return null;
}
