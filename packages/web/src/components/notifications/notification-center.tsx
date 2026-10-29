import { formatDistanceToNow } from 'date-fns';
import { Bell, CheckCheck, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import type { AppNotification } from '@luma/shared';
import { ReleaseNotesDialog } from '@/components/notifications/release-notes-panel';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useDateLocale } from '@/hooks/use-date-locale';
import { useReleaseNotes } from '@/hooks/use-release-notes';
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

type BellTab = 'avisos' | 'novedades';

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

  const { notes, unseen, hasUnseen, markSeen } = useReleaseNotes();
  const [tab, setTab] = useState<BellTab>('avisos');
  const [newsOpen, setNewsOpen] = useState(false);
  // Lo que no había visto al abrir: sigue marcado aunque el punto se apague al mirarlo.
  const [freshIds, setFreshIds] = useState<ReadonlySet<string>>(new Set());

  const notifications = data?.notifications ?? [];
  const unreadCount = data?.unreadCount ?? 0;

  function handleOpen(notification: AppNotification) {
    if (notification.readAt === null) markRead.mutate(notification.id);
    setOpen(false);
    navigate(notification.link);
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) return;
    setFreshIds(new Set(unseen.map((note) => note.id)));
    setTab('avisos');
  }

  // Verlas es leerlas: al mostrarse la pestaña, se marcan como vistas.
  useEffect(() => {
    if (newsOpen && hasUnseen) markSeen();
  }, [newsOpen, hasUnseen, markSeen]);

  const ariaLabel = [
    unreadCount > 0
      ? t('notification.ariaWithUnread', { count: unreadCount })
      : t('notification.aria'),
    hasUnseen ? t('releaseNotes.ariaWithNews') : null,
  ]
    .filter(Boolean)
    .join('. ');

  return (
    <>
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={ariaLabel}>
          <Bell className="size-4" />
          {unreadCount > 0 ? (
            // `rounded-full` acá es correcto: es un indicador de estado, no un
            // control. Ver la escala de radios en DESIGN.md.
            <span className="absolute -right-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-2xs font-medium text-primary-foreground">
              {unreadCount > BADGE_MAX ? `+${BADGE_MAX}` : unreadCount}
            </span>
          ) : (
            // Lo nuevo de Luma es un punto, nunca un número: el número de la
            // campana quiere decir "alguien necesita algo de vos", y si se
            // encendiera por un lanzamiento enseñaría a ignorarlo.
            hasUnseen && (
              <span
                aria-hidden
                data-testid="release-notes-dot"
                className="absolute right-1.5 top-1.5 size-2 rounded-full bg-primary ring-2 ring-background"
              />
            )
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-80 p-0">
        <Tabs
          value={tab}
          onValueChange={(next) => {
            // Novedades es una pantalla propia: la pestaña la abre y cierra el popover.
            if (next === 'novedades') {
              setOpen(false);
              setNewsOpen(true);
            } else setTab(next as BellTab);
          }}
        >
          {notes.length > 0 && (
            <div className="border-b border-border p-2">
              <TabsList aria-label={t('releaseNotes.tabsAria')} className="w-full">
                <TabsTrigger value="avisos" icon={Bell}>
                  {t('notification.title')}
                </TabsTrigger>
                <TabsTrigger value="novedades" icon={Sparkles}>
                  {t('releaseNotes.title')}
                  {/* Con avisos sin leer la campana abre en Avisos y el número tapa el
                      punto: sin esta marca, quien más avisos tiene nunca vería la novedad. */}
                  {hasUnseen && (
                    <span aria-hidden className="size-1.5 rounded-full bg-primary" />
                  )}
                </TabsTrigger>
              </TabsList>
            </div>
          )}

          <TabsContent value="avisos">
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
              // El tope va en el visor y no en la raíz: Radix le da al visor el 100% de una raíz
              // sin alto fijo, y con `max-h` en la raíz la lista crece y se sale del popover.
              <ScrollArea className="[&_[data-slot=scroll-area-viewport]]:max-h-96">
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
          </TabsContent>

        </Tabs>
      </PopoverContent>
    </Popover>
    <ReleaseNotesDialog open={newsOpen} onOpenChange={setNewsOpen} notes={notes} freshIds={freshIds} />
    </>
  );
}

export default NotificationCenter;
