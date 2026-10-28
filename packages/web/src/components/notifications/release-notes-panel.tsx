import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { useDateLocale } from '@/hooks/use-date-locale';
import { fromDayKey } from '@/lib/day-key';
import type { ReleaseNote } from '@/lib/release-notes';
import { cn } from '@/lib/utils';

/**
 * Lo nuevo y lo arreglado: una pantalla propia, oscura como el chrome del panel
 * (`surface-dark`), con la fecha en una píldora, el título en serif y una
 * tarjeta por cambio —ícono, título y qué cambia para quien lo usa—.
 *
 * Se abre desde la pestaña Novedades de la campana. Es una pantalla y no una
 * lista dentro del popover porque cada novedad se explica en dos líneas, y eso
 * no entra en 320 px sin volverse una pared de texto.
 *
 * `freshIds` son las entradas que no había visto al abrir: llevan su marca
 * aunque el punto de la campana ya se haya apagado.
 */
export function ReleaseNotesDialog({
  open,
  onOpenChange,
  notes,
  freshIds,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  notes: readonly ReleaseNote[];
  freshIds: ReadonlySet<string>;
}) {
  const { t } = useTranslation();
  const dateLocale = useDateLocale();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="surface-dark max-h-[85dvh] max-w-2xl gap-0 overflow-y-auto border-border bg-background p-6 text-foreground sm:p-8"
        data-testid="release-notes"
      >
        <DialogDescription className="sr-only">{t('releaseNotes.tabsAria')}</DialogDescription>
        <DialogTitle className="font-serif text-4xl font-normal leading-tight">
          {t('releaseNotes.heading')}
        </DialogTitle>

        <div className="mt-6 flex flex-col gap-8">
          {notes.map((note) => (
            <section key={note.id} className="flex flex-col gap-3">
              <p className="flex w-fit items-center gap-2 rounded-full bg-primary/15 px-3 py-1.5 text-2xs font-medium uppercase tracking-wider text-primary">
                <span aria-hidden className="size-1.5 rounded-full bg-primary" />
                {t('releaseNotes.changesOf', {
                  // `fromDayKey` y no `new Date('2026-10-28')`: ese se lee en UTC y en
                  // Argentina muestra el 27.
                  date: format(fromDayKey(note.date), "d 'de' MMMM 'de' yyyy", {
                    locale: dateLocale,
                  }),
                })}
                {freshIds.has(note.id) && <span>· {t('releaseNotes.fresh')}</span>}
              </p>

              <ul className="flex flex-col gap-3">
                {note.items.map((item) => {
                  const Icon = item.icon;
                  const text = `releaseNotes.entries.${note.id}.${item.key}`;
                  return (
                    <li
                      key={item.key}
                      className="flex items-start gap-4 rounded-3xl bg-card p-5"
                    >
                      <span
                        aria-hidden
                        className={cn(
                          'flex size-10 shrink-0 items-center justify-center rounded-xl',
                          item.kind === 'new'
                            ? 'bg-primary/15 text-primary'
                            : 'bg-muted text-muted-foreground',
                        )}
                      >
                        <Icon className="size-5" />
                      </span>
                      <div className="flex min-w-0 flex-col gap-1">
                        <h3 className="text-base font-medium">
                          {t(`${text}.title`)}
                          <span className="sr-only"> — {t(`releaseNotes.kind.${item.kind}`)}</span>
                        </h3>
                        <p className="text-sm text-muted-foreground">{t(`${text}.description`)}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
