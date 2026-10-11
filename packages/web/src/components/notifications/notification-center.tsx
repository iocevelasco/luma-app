import { formatDistanceToNow } from 'date-fns';
import { Bell, CheckCheck } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import type { AppNotification } from '@luma/shared';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useDateLocale } from '@/hooks/use-date-locale';
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
} from '@/hooks/notifications/use-notification-queries';
import { cn } from '@/lib/utils';

/**
 * Tope del badge. Más de nueve avisos sin leer ya no es una cantidad que
 * alguien procese: es "tengo un montón", y "+9" lo dice sin romper el círculo.
 */
const BADGE_MAX = 9;

function NotificationRow({
  notification,
  onOpen,
}: {
  notification: AppNotification;
  onOpen: (notification: AppNotification) => void;
}) {
  const { t } = useTranslation();
  const dateLocale = useDateLocale();
  const isUnread = notification.readAt === null;

  return (
    <button
      type="button"
      onClick={() => onOpen(notification)}
      className={cn(
        'flex w-full flex-col items-start gap-0.5 rounded-sm px-3 py-2 text-left transition-colors hover:bg-accent',
        isUnread && 'bg-primary/5',
      )}
    >
      <div className="flex w-full items-start gap-2">
        {/*
          El punto marca lo no leído sin usar color solo: va acompañado del
          fondo y del peso del texto, porque un punto naranja es invisible
          para quien no distingue ese tono.
        */}
        <span
          className={cn(
            'mt-1.5 size-1.5 shrink-0 rounded-full',
            isUnread ? 'bg-primary' : 'bg-transparent',
          )}
          aria-hidden
        />
        <p className={cn('min-w-0 flex-1 text-sm', isUnread && 'font-medium')}>
          {t(`notification.type.${notification.type}`, { name: notification.subjectName })}
        </p>
      </div>
      <p className="pl-3.5 text-2xs text-muted-foreground">
        {notification.projectName}
        {' · '}
        {formatDistanceToNow(new Date(notification.createdAt), {
          addSuffix: true,
          locale: dateLocale,
        })}
      </p>
    </button>
  );
}

/**
 * La bandeja del header. Es el "recibir notificaciones" que la matriz pide en
 * ocho de sus filas.
 *
 * Vive en el chrome del panel y no en una pantalla propia a propósito: un
 * aviso que hay que ir a buscar no es un aviso.
 */
export function NotificationCenter() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { data } = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const notifications = data?.notifications ?? [];
  const unreadCount = data?.unreadCount ?? 0;

  function handleOpen(notification: AppNotification) {
    if (notification.readAt === null) markRead.mutate(notification.id);
    setOpen(false);
    navigate(notification.link);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={
            unreadCount > 0
              ? t('notification.ariaWithUnread', { count: unreadCount })
              : t('notification.aria')
          }
        >
          <Bell className="size-4" />
          {unreadCount > 0 && (
            // `rounded-full` acá es correcto: es un indicador de estado, no un
            // control. Ver la escala de radios en DESIGN.md.
            <span className="absolute -right-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-2xs font-medium text-primary-foreground">
              {unreadCount > BADGE_MAX ? `+${BADGE_MAX}` : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
          <p className="text-sm font-medium">{t('notification.title')}</p>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => markAllRead.mutate()}
              disabled={markAllRead.isPending}
            >
              <CheckCheck className="size-3.5" />
              {t('notification.markAllRead')}
            </Button>
          )}
        </div>

        {notifications.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">
            {t('notification.empty')}
          </p>
        ) : (
          <ScrollArea className="max-h-96">
            <div className="flex flex-col p-1">
              {notifications.map((notification) => (
                <NotificationRow
                  key={notification.id}
                  notification={notification}
                  onOpen={handleOpen}
                />
              ))}
            </div>
          </ScrollArea>
        )}
      </PopoverContent>
    </Popover>
  );
}

export default NotificationCenter;
