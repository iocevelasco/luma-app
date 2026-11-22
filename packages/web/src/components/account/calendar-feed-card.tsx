import type { CalendarFeedLanguage } from '@luma/shared';
import { CalendarPlus, Copy, ExternalLink } from 'lucide-react';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  useCalendarFeed,
  useCreateCalendarFeed,
  useDisableCalendarFeed,
} from '@/hooks/calendar/use-calendar-feed';
import { useDateLocale } from '@/hooks/use-date-locale';
import { format } from 'date-fns';

/** El idioma de la app en el de los textos fijos del feed. */
export function feedLanguage(language: string | undefined): CalendarFeedLanguage {
  if (language?.startsWith('pt')) return 'pt';
  if (language === 'es-AR') return 'es-AR';
  return 'es-ES';
}

/** `webcal://` abre la app de calendario del sistema (Apple, Outlook). */
export function webcalUrl(url: string): string {
  return url.replace(/^https?:\/\//, 'webcal://');
}

/** Google Calendar se suscribe a un feed con `cid=` y la URL `webcal://`. */
export function googleCalendarUrl(url: string): string {
  return `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcalUrl(url))}`;
}

type Confirming = 'regenerate' | 'disable' | null;

/**
 * El feed de calendario personal en la cuenta (ADR-005 §3).
 *
 * La URL se ve una sola vez, al generarla: después la API sólo sabe que existe.
 * "Copiar" es un clic aparte del de generar, porque en Safari copiar fuera del
 * gesto que lo pidió falla. La card dice lo que el feed no puede prometer:
 * quien tenga la URL lee el calendario, tarda horas en actualizarse, y apagarlo
 * no borra lo que el calendario externo ya copió.
 */
export function CalendarFeedCard() {
  const { t, i18n } = useTranslation();
  const dateLocale = useDateLocale();
  const { data: status } = useCalendarFeed();
  const create = useCreateCalendarFeed();
  const disable = useDisableCalendarFeed();
  const [url, setUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState<Confirming>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const generate = () =>
    create.mutate(feedLanguage(i18n.resolvedLanguage ?? i18n.language), {
      onSuccess: (data) => {
        setUrl(data.url);
        setCopied(false);
      },
    });

  async function copy() {
    if (!url) return;
    // `navigator.clipboard` no existe fuera de un contexto seguro y en algunos
    // WebViews de iOS: sin él queda el texto seleccionado para copiar a mano.
    if (typeof navigator.clipboard?.writeText === 'function') {
      try {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        return;
      } catch {
        // Permiso denegado: cae a la selección.
      }
    }
    inputRef.current?.select();
  }

  const enabled = status?.enabled === true;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('auth.calendarFeed.title')}</CardTitle>
        <CardDescription>{t('auth.calendarFeed.description')}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {url ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm">{t('auth.calendarFeed.showOnce')}</p>
            <div className="flex gap-2">
              <Input
                ref={inputRef}
                readOnly
                value={url}
                aria-label={t('auth.calendarFeed.urlLabel')}
                onFocus={(event) => event.currentTarget.select()}
              />
              <Button type="button" variant="outline" onClick={() => void copy()}>
                <Copy aria-hidden="true" />
                {copied ? t('auth.calendarFeed.copied') : t('auth.calendarFeed.copy')}
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline" size="sm">
                <a href={googleCalendarUrl(url)} target="_blank" rel="noopener noreferrer">
                  <ExternalLink aria-hidden="true" />
                  {t('auth.calendarFeed.addToGoogle')}
                </a>
              </Button>
              <Button asChild variant="outline" size="sm">
                <a href={webcalUrl(url)}>
                  <CalendarPlus aria-hidden="true" />
                  {t('auth.calendarFeed.openCalendarApp')}
                </a>
              </Button>
            </div>
          </div>
        ) : enabled ? (
          <p className="text-sm text-muted-foreground">
            {t('auth.calendarFeed.activeSince', {
              date: status?.createdAt ? format(new Date(status.createdAt), 'PP', { locale: dateLocale }) : '',
            })}
          </p>
        ) : null}

        <ul className="flex list-disc flex-col gap-1 pl-5 text-xs text-muted-foreground">
          {(t('auth.calendarFeed.caveats', { returnObjects: true }) as string[]).map((caveat) => (
            <li key={caveat}>{caveat}</li>
          ))}
        </ul>

        <div className="flex flex-wrap gap-2">
          {enabled ? (
            <>
              <Button type="button" variant="outline" disabled={create.isPending} onClick={() => setConfirming('regenerate')}>
                {t('auth.calendarFeed.regenerate')}
              </Button>
              <Button type="button" variant="ghost" disabled={disable.isPending} onClick={() => setConfirming('disable')}>
                {t('auth.calendarFeed.disable')}
              </Button>
            </>
          ) : (
            <Button type="button" disabled={create.isPending} onClick={generate}>
              {create.isPending ? t('common.loading') : t('auth.calendarFeed.generate')}
            </Button>
          )}
        </div>
      </CardContent>

      <AlertDialog open={confirming !== null} onOpenChange={(open) => !open && setConfirming(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirming === 'disable'
                ? t('auth.calendarFeed.disableTitle')
                : t('auth.calendarFeed.regenerateTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirming === 'disable'
                ? t('auth.calendarFeed.disableBody')
                : t('auth.calendarFeed.regenerateBody')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirming === 'disable') {
                  disable.mutate(undefined, { onSuccess: () => setUrl(null) });
                } else {
                  generate();
                }
              }}
            >
              {confirming === 'disable' ? t('auth.calendarFeed.disable') : t('auth.calendarFeed.regenerate')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
