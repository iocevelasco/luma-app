import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import type {
  Milestone,
  MilestoneAttachment,
  MilestoneSeverity,
  MilestoneType,
} from '@luma/shared';
import { format } from 'date-fns';
import {
  ChevronDown,
  CircleCheck,
  EyeOff,
  FileText,
  FileWarning,
  Flag,
  ListChecks,
  MoreHorizontal,
  Package,
  Pencil,
  Shuffle,
  Clock,
  Trash2,
  TriangleAlert,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { fromDayKey } from '@/components/common/date-range-filter';
import { MarkdownView } from '@/components/markdown/markdown-view';
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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useDeleteMilestone } from '@/hooks/milestones/use-milestone-queries';
import { useDateLocale } from '@/hooks/use-date-locale';
import { projectMilestoneEditPath } from '@/lib/routes';
import { cn } from '@/lib/utils';

/**
 * El tipo es lo primero que se busca al recorrer la cronología ("¿cuándo fue
 * la última reunión?"), así que cada uno tiene su ícono y no sólo un rótulo.
 */
const TYPE_ICON: Record<MilestoneType, LucideIcon> = {
  etapa_concluida: CircleCheck,
  compra_significativa: Package,
  permisologia: FileWarning,
  vicio_oculto: TriangleAlert,
  retraso: Clock,
  cambio_proyecto: Shuffle,
  reunion: Users,
  otro: Flag,
};

/**
 * La gravedad con los colores de **estado**, no con el verde de marca: el
 * verde es "esto se toca", y "atención" no lo es. `info` no lleva badge —
 * es el valor por defecto, y marcarlo en cada card es ruido.
 */
const SEVERITY_BADGE: Partial<Record<MilestoneSeverity, string>> = {
  atencion: 'border-transparent bg-status-warning/15 text-status-warning',
  critico: 'border-transparent bg-status-danger/15 text-status-danger',
};

/** Cuántos asistentes se nombran antes del "+N". */
const ATTENDEES_SHOWN = 3;

/**
 * Un hito en la cronología. De arriba abajo, en el orden en que se lee:
 *
 * 1. **Qué y cuándo** — ícono del tipo, tipo, fecha y las marcas que
 *    cambian cómo se lee (gravedad, interno).
 * 2. **El título**, que es lo que nombra al hito.
 * 3. **Quiénes**, sólo en una reunión.
 * 4. **El texto**, y debajo **la evidencia**: fotos y PDF adjuntos.
 *    El texto: Sólo un hito crítico lo muestra de entrada, recortado:
 *    es el que alguien tiene que leer ya. En el resto queda a un click, y la
 *    lista se puede recorrer sin que una minuta de una página tape todo.
 * 5. **De dónde salió** — quién lo reportó y la tarea enlazada.
 *
 * **Toda la card se toca.** Quien puede editar va directo a la edición; quien
 * no (el cliente), abre y cierra el texto. Es un link "estirado": el `<a>` del
 * título cubre la card con un `::after`, y lo que tiene su propia acción
 * (el menú, "Ver más") va por encima con `relative z-10`. Así no hay un `<a>`
 * envolviendo botones, que es HTML inválido y en Safari roba los clicks.
 */
export function MilestoneCard({
  projectId,
  milestone,
  canManage,
}: {
  projectId: string;
  milestone: Milestone;
  /** Editar y borrar: mismo criterio que la API — ver `MilestoneEditPanel`. */
  canManage: boolean;
}) {
  const { t } = useTranslation();
  const dateLocale = useDateLocale();
  const TypeIcon = TYPE_ICON[milestone.type];
  const severityClass = SEVERITY_BADGE[milestone.severity];
  const critical = milestone.severity === 'critico';
  const [expanded, setExpanded] = useState(false);
  const hasBody = Boolean(milestone.description);
  const clickable = canManage || hasBody;

  // El área estirada: cubre la card entera y deja el foco visible en el borde.
  const stretched =
    'text-left after:absolute after:inset-0 after:rounded-lg focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-ring';

  return (
    <article
      aria-labelledby={`milestone-${milestone.id}-title`}
      className={cn(
        'relative flex flex-col gap-3 rounded-lg border border-border bg-card p-4 shadow-surface transition-colors',
        clickable && 'hover:border-foreground/25',
        // Lo crítico se distingue antes de leer el badge.
        critical && 'border-status-danger/40 hover:border-status-danger/70',
      )}
    >
      <header className="flex items-start gap-3">
        <div
          aria-hidden
          className={cn(
            'flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground',
            critical && 'bg-status-danger/15 text-status-danger',
          )}
        >
          <TypeIcon className="size-4" />
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <span>{t(`milestone.type.${milestone.type}`)}</span>
            <span aria-hidden>·</span>
            <time dateTime={milestone.occurredOn}>
              {format(fromDayKey(milestone.occurredOn), 'd MMM', { locale: dateLocale })}
            </time>
            {severityClass && (
              <Badge className={severityClass}>
                {t(`milestone.severity.${milestone.severity}`)}
              </Badge>
            )}
            {/*
              Marcar lo interno y no lo público: lo normal es que un hito sea
              para el cliente. Lo que hay que ver de un vistazo es qué NO salió
              de adentro.
            */}
            {milestone.audience === 'interno' && (
              <Badge variant="outline" className="gap-1">
                <EyeOff className="size-3" />
                {t('milestone.audience.interno')}
              </Badge>
            )}
          </div>

          <h3
            id={`milestone-${milestone.id}-title`}
            className="text-base leading-snug font-medium break-words"
          >
            {canManage ? (
              <Link to={projectMilestoneEditPath(projectId, milestone.id)} className={stretched}>
                {milestone.title}
              </Link>
            ) : hasBody ? (
              <button
                type="button"
                onClick={() => setExpanded((value) => !value)}
                aria-expanded={expanded}
                className={stretched}
              >
                {milestone.title}
              </button>
            ) : (
              milestone.title
            )}
          </h3>
        </div>

        {canManage && (
          <div className="relative z-10">
            <MilestoneActions projectId={projectId} milestone={milestone} />
          </div>
        )}
      </header>

      {milestone.attendees && milestone.attendees.length > 0 && (
        <Attendees names={milestone.attendees} />
      )}

      {milestone.description && (
        <MilestoneBody
          markdown={milestone.description}
          preview={critical}
          isMeeting={milestone.type === 'reunion'}
          expanded={expanded}
          onExpandedChange={setExpanded}
        />
      )}

      {milestone.attachments.length > 0 && <Evidence attachments={milestone.attachments} />}

      <footer className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border pt-3 text-xs text-muted-foreground">
        <span>{t('milestone.reportedByName', { name: milestone.reportedByName })}</span>
        {milestone.activityName && (
          <span className="flex min-w-0 items-center gap-1">
            <ListChecks className="size-3.5 shrink-0" />
            <span className="truncate">
              {t('milestone.linkedTask', { name: milestone.activityName })}
            </span>
          </span>
        )}
      </footer>
    </article>
  );
}

/** Cuántas miniaturas entran antes del "+N". */
const THUMBNAILS_SHOWN = 4;

/**
 * La evidencia del hito: las fotos en miniatura (es lo que se quiere ver de
 * un vistazo en un vicio oculto) y los PDF como chip con su nombre. Cada una
 * abre el archivo en otra pestaña; van por encima del área cliqueable de la
 * card.
 */
function Evidence({ attachments }: { attachments: MilestoneAttachment[] }) {
  const { t } = useTranslation();
  const images = attachments.filter((item) => item.contentType.startsWith('image/'));
  const files = attachments.filter((item) => !item.contentType.startsWith('image/'));
  const shownImages = images.slice(0, THUMBNAILS_SHOWN);
  const hiddenImages = images.length - shownImages.length;

  return (
    <div
      className="relative z-10 flex flex-col gap-2"
      aria-label={t('milestone.attachments.title')}
    >
      {shownImages.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {shownImages.map((image, index) => (
            <li key={image.id} className="relative">
              <EvidenceLink attachment={image} className="block">
                <img
                  src={image.url ?? undefined}
                  alt={image.fileName}
                  loading="lazy"
                  className="size-16 rounded-md border border-border bg-muted object-cover md:size-20"
                />
                {/* El "+N" va sobre la última miniatura, no en una celda aparte. */}
                {hiddenImages > 0 && index === shownImages.length - 1 && (
                  <span className="absolute inset-0 flex items-center justify-center rounded-md bg-foreground/60 text-sm font-medium text-background">
                    {t('milestone.attachments.more', { count: hiddenImages })}
                  </span>
                )}
              </EvidenceLink>
            </li>
          ))}
        </ul>
      )}
      {files.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {files.map((file) => (
            <li key={file.id} className="min-w-0">
              <EvidenceLink
                attachment={file}
                className="flex max-w-60 items-center gap-1.5 rounded-sm border border-border px-2 py-1 text-xs hover:bg-accent"
              >
                <FileText className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate">{file.fileName}</span>
              </EvidenceLink>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Sin URL (storage caído o archivo borrado) se muestra igual, sin link. */
function EvidenceLink({
  attachment,
  className,
  children,
}: {
  attachment: MilestoneAttachment;
  className?: string;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  if (!attachment.url) return <span className={className}>{children}</span>;

  return (
    <a
      href={attachment.url}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      aria-label={t('milestone.attachments.open', { name: attachment.fileName })}
    >
      {children}
    </a>
  );
}

/**
 * Los primeros nombres y un "+N". Con cinco asistentes en una línea, en el
 * celular la card se vuelve una lista de nombres antes que un hito. La lista
 * completa queda en el `title` y para el lector de pantalla.
 */
function Attendees({ names }: { names: string[] }) {
  const { t } = useTranslation();
  const shown = names.slice(0, ATTENDEES_SHOWN).join(', ');
  const rest = names.length - ATTENDEES_SHOWN;

  return (
    <p className="flex items-start gap-1.5 text-xs text-muted-foreground" title={names.join(', ')}>
      <Users className="mt-px size-3.5 shrink-0" aria-hidden />
      <span className="sr-only">{t('milestone.fields.attendees')}:</span>
      <span>{rest > 0 ? t('milestone.attendees.more', { names: shown, count: rest }) : shown}</span>
    </p>
  );
}

/**
 * El texto del hito.
 *
 * - `preview` (crítico): se ve de entrada, recortado por **alto** y no por
 *   caracteres — cortar Markdown a la mitad rompe listas y títulos. El "Ver
 *   más" aparece sólo si de verdad quedó algo afuera.
 * - Sin `preview`: cerrado detrás de "Ver minuta" / "Ver detalle".
 */
function MilestoneBody({
  markdown,
  preview,
  isMeeting,
  expanded,
  onExpandedChange,
}: {
  markdown: string;
  preview: boolean;
  isMeeting: boolean;
  /** Vive en la card: tocar la card (sin permiso de edición) también lo abre. */
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
}) {
  const { t } = useTranslation();
  const [overflows, setOverflows] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);

  // Se mide después de pintar: si el contenido entra en el recorte, no hay
  // "Ver más" que ofrecer.
  useLayoutEffect(() => {
    const node = bodyRef.current;
    if (!preview || expanded || !node) return;
    setOverflows(node.scrollHeight > node.clientHeight + 1);
  }, [markdown, preview, expanded]);

  if (!preview && !expanded) {
    return (
      <Button
        variant="link"
        size="sm"
        className="relative z-10 h-auto self-start px-0"
        onClick={() => onExpandedChange(true)}
        aria-expanded={false}
      >
        <ChevronDown className="size-4" />
        {isMeeting ? t('milestone.showMinutes') : t('milestone.showDetail')}
      </Button>
    );
  }

  const clamped = preview && !expanded;

  return (
    <div className="flex flex-col items-start gap-1">
      {/*
        Por encima del área estirada: los links de la minuta tienen que
        abrirse, y el texto se tiene que poder seleccionar para copiarlo.
      */}
      <div
        ref={bodyRef}
        className={cn(
          'relative z-10 w-full',
          clamped &&
            'max-h-28 overflow-hidden [mask-image:linear-gradient(to_bottom,black_55%,transparent)]',
          clamped && !overflows && '[mask-image:none]',
        )}
      >
        <MarkdownView compact>{markdown}</MarkdownView>
      </div>
      {(expanded || overflows) && (
        <Button
          variant="link"
          size="sm"
          className="relative z-10 h-auto px-0"
          onClick={() => onExpandedChange(!expanded)}
          aria-expanded={expanded}
        >
          {expanded ? t('milestone.showLess') : t('milestone.showMore')}
        </Button>
      )}
    </div>
  );
}

/**
 * Editar y borrar en un menú, como en el Tablero de tareas: borrar no puede
 * estar a un click distraído del lápiz.
 */
function MilestoneActions({ projectId, milestone }: { projectId: string; milestone: Milestone }) {
  const { t } = useTranslation();
  const [confirming, setConfirming] = useState(false);
  const deleteMilestone = useDeleteMilestone(projectId);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="shrink-0 border-transparent"
            aria-label={t('milestone.actions', { title: milestone.title })}
          >
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link to={projectMilestoneEditPath(projectId, milestone.id)}>
              <Pencil />
              {t('milestone.edit.action')}
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onSelect={() => setConfirming(true)}>
            <Trash2 />
            {t('milestone.delete.action')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('milestone.delete.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('milestone.delete.description', { title: milestone.title })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                deleteMilestone.mutate(milestone.id, { onSuccess: () => setConfirming(false) })
              }
            >
              {t('milestone.delete.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
