import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  DOCUMENT_MAX_BYTES,
  DOCUMENT_MIME_TYPES,
  MILESTONE_ATTACHMENTS_MAX,
  type Milestone,
  type MilestoneAttachment,
} from '@luma/shared';
import { FileText, Loader2, Paperclip, RotateCcw, X } from 'lucide-react';
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
import { Label } from '@/components/ui/label';
import {
  useRemoveMilestoneAttachment,
  useUploadMilestoneAttachment,
} from '@/hooks/milestones/use-milestone-queries';
import { errorMessage } from '@/lib/error-message';
import { cn, formatFileSize } from '@/lib/utils';

const ACCEPT = DOCUMENT_MIME_TYPES.join(',');

/**
 * Lo que se puede chequear antes de subir. La API vuelve a validar todo —
 * esto es para no hacer esperar a nadie una subida de 25MB que va a rebotar.
 */
export function attachmentProblem(file: File, alreadyAttached: number): string | null {
  if (!DOCUMENT_MIME_TYPES.includes(file.type)) return 'milestone.attachments.errors.type';
  if (file.size > DOCUMENT_MAX_BYTES) return 'milestone.attachments.errors.tooLarge';
  if (alreadyAttached >= MILESTONE_ATTACHMENTS_MAX) return 'milestone.attachments.errors.tooMany';
  return null;
}

/** Un archivo que todavía no está en el hito: en espera, subiendo o rechazado. */
export interface LocalAttachment {
  id: string;
  file: File;
  status: 'pending' | 'uploading' | 'error';
  /** Texto ya resuelto: viene de la API o del chequeo local. */
  error?: string;
}

let localId = 0;
const nextLocalId = () => `local-${++localId}`;

type FieldProps =
  | {
      /** Alta: el hito no existe todavía, los archivos esperan al guardado. */
      mode: 'pending';
      files: LocalAttachment[];
      onFilesChange: (files: LocalAttachment[]) => void;
    }
  | {
      /** Edición: cada archivo se sube apenas se elige. */
      mode: 'live';
      projectId: string;
      milestone: Milestone;
      /** Los que fallaron al subirse justo después del alta. */
      initialFailures?: { name: string; message: string }[];
    };

/**
 * Adjuntos de un hito: la foto del problema, el acta, el presupuesto. Valen
 * para todos los tipos de hito.
 *
 * El selector usa `accept` con tipos de imagen: en iOS eso ofrece la cámara
 * además de la galería, que es como se va a usar en obra.
 */
export function MilestoneAttachmentsField(props: FieldProps) {
  const { t } = useTranslation();
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  // Lo que todavía no es un adjunto del hito.
  const [liveLocal, setLiveLocal] = useState<LocalAttachment[]>([]);
  const local = props.mode === 'pending' ? props.files : liveLocal;
  const saved = props.mode === 'live' ? props.milestone.attachments : [];
  const counted = saved.length + local.filter((item) => item.status !== 'error').length;
  const full = counted >= MILESTONE_ATTACHMENTS_MAX;

  const upload = useUploadMilestoneAttachment(props.mode === 'live' ? props.projectId : '');

  const setLocal = (update: (current: LocalAttachment[]) => LocalAttachment[]) => {
    if (props.mode === 'pending') props.onFilesChange(update(props.files));
    else setLiveLocal(update);
  };

  const uploadOne = async (item: LocalAttachment) => {
    if (props.mode !== 'live') return;
    setLiveLocal((current) =>
      current.map((entry) =>
        entry.id === item.id ? { ...entry, status: 'uploading', error: undefined } : entry,
      ),
    );
    try {
      await upload.mutateAsync({ milestoneId: props.milestone.id, file: item.file });
      // Ya está en el hito (la caché se actualizó): deja de ser local.
      setLiveLocal((current) => current.filter((entry) => entry.id !== item.id));
    } catch (error) {
      setLiveLocal((current) =>
        current.map((entry) =>
          entry.id === item.id
            ? {
                ...entry,
                status: 'error',
                error: errorMessage(error, t) ?? t('milestone.attachments.errors.upload'),
              }
            : entry,
        ),
      );
    }
  };

  const addFiles = async (picked: File[]) => {
    let count = counted;
    const additions = picked.map((file): LocalAttachment => {
      const problem = attachmentProblem(file, count);
      if (!problem) count += 1;
      return problem
        ? {
            id: nextLocalId(),
            file,
            status: 'error',
            error: t(problem, { max: MILESTONE_ATTACHMENTS_MAX }),
          }
        : { id: nextLocalId(), file, status: 'pending' };
    });
    setLocal((current) => [...current, ...additions]);

    // De a uno: el media-service no gana nada con subidas en paralelo, y el
    // orden en pantalla es el orden en que se eligieron.
    if (props.mode === 'live') {
      for (const item of additions.filter((entry) => entry.status === 'pending')) {
        await uploadOne(item);
      }
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={inputId}>{t('milestone.attachments.title')}</Label>
        <span className="text-xs text-muted-foreground tabular-nums">
          {t('milestone.attachments.count', { count: counted, max: MILESTONE_ATTACHMENTS_MAX })}
        </span>
      </div>

      {props.mode === 'live' && props.initialFailures && props.initialFailures.length > 0 && (
        <div
          role="alert"
          className="rounded-md border border-destructive bg-destructive px-3 py-2 text-sm text-destructive-foreground"
        >
          <p className="font-medium">{t('milestone.attachments.failedAfterCreate')}</p>
          <ul className="mt-1 list-disc pl-5">
            {props.initialFailures.map((failure) => (
              <li key={failure.name}>
                {failure.name}: {failure.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {(saved.length > 0 || local.length > 0) && (
        <ul className="flex flex-col gap-2">
          {saved.map((attachment) => (
            <SavedAttachmentRow
              key={attachment.id}
              projectId={props.mode === 'live' ? props.projectId : ''}
              milestoneId={props.mode === 'live' ? props.milestone.id : ''}
              attachment={attachment}
            />
          ))}
          {local.map((item) => (
            <LocalAttachmentRow
              key={item.id}
              item={item}
              onRetry={
                props.mode === 'live' && item.status === 'error' && !attachmentProblem(item.file, 0)
                  ? () => void uploadOne(item)
                  : undefined
              }
              onRemove={() =>
                setLocal((current) => current.filter((entry) => entry.id !== item.id))
              }
            />
          ))}
        </ul>
      )}

      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={ACCEPT}
        multiple
        className="sr-only"
        onChange={(event) => {
          const picked = Array.from(event.target.files ?? []);
          // Se vacía para que elegir el mismo archivo otra vez dispare `change`.
          event.target.value = '';
          if (picked.length > 0) void addFiles(picked);
        }}
      />
      <Button
        type="button"
        variant="outline"
        className="self-start"
        disabled={full}
        onClick={() => inputRef.current?.click()}
      >
        <Paperclip className="size-4" />
        {t('milestone.attachments.add')}
      </Button>
      <p className="text-xs text-muted-foreground">{t('milestone.attachments.hint')}</p>
    </div>
  );
}

function AttachmentRowShell({
  name,
  meta,
  thumbnail,
  isImage,
  invalid,
  children,
  href,
}: {
  name: string;
  meta: ReactNode;
  thumbnail?: string | null;
  isImage: boolean;
  invalid?: boolean;
  children?: ReactNode;
  href?: string | null;
}) {
  const preview = (
    <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-xs bg-muted text-muted-foreground">
      {isImage && thumbnail ? (
        <img src={thumbnail} alt="" className="size-full object-cover" />
      ) : (
        <FileText className="size-4" />
      )}
    </span>
  );

  return (
    <li
      className={cn(
        'flex items-center gap-3 rounded-md border border-border p-2',
        invalid && 'border-destructive/50',
      )}
    >
      {href ? (
        <a href={href} target="_blank" rel="noopener noreferrer" tabIndex={-1} aria-hidden>
          {preview}
        </a>
      ) : (
        preview
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="truncate text-sm hover:underline"
          >
            {name}
          </a>
        ) : (
          <span className="truncate text-sm">{name}</span>
        )}
        <span className={cn('text-xs', invalid ? 'text-destructive' : 'text-muted-foreground')}>
          {meta}
        </span>
      </div>
      {children}
    </li>
  );
}

function LocalAttachmentRow({
  item,
  onRetry,
  onRemove,
}: {
  item: LocalAttachment;
  onRetry?: () => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  const isImage = item.file.type.startsWith('image/');

  // La miniatura de un archivo que todavía no subió sale del propio archivo.
  // Se libera al desmontar: cada `createObjectURL` retiene el archivo en memoria.
  const thumbnail = useMemo(
    () => (isImage ? URL.createObjectURL(item.file) : null),
    [isImage, item.file],
  );
  useEffect(() => () => (thumbnail ? URL.revokeObjectURL(thumbnail) : undefined), [thumbnail]);

  const meta =
    item.status === 'error'
      ? item.error
      : item.status === 'uploading'
        ? t('milestone.attachments.uploading')
        : `${formatFileSize(item.file.size)} · ${t('milestone.attachments.pending')}`;

  return (
    <AttachmentRowShell
      name={item.file.name}
      meta={meta}
      thumbnail={thumbnail}
      isImage={isImage}
      invalid={item.status === 'error'}
    >
      {item.status === 'uploading' ? (
        <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
      ) : (
        <div className="flex shrink-0 items-center gap-1">
          {onRetry && (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={onRetry}
              aria-label={t('milestone.attachments.retry', { name: item.file.name })}
            >
              <RotateCcw className="size-4" />
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={onRemove}
            aria-label={t('milestone.attachments.remove', { name: item.file.name })}
          >
            <X className="size-4" />
          </Button>
        </div>
      )}
    </AttachmentRowShell>
  );
}

/** Uno que ya está en el hito. Quitarlo lo borra del bucket: pide confirmación. */
function SavedAttachmentRow({
  projectId,
  milestoneId,
  attachment,
}: {
  projectId: string;
  milestoneId: string;
  attachment: MilestoneAttachment;
}) {
  const { t } = useTranslation();
  const [confirming, setConfirming] = useState(false);
  const remove = useRemoveMilestoneAttachment(projectId);

  return (
    <>
      <AttachmentRowShell
        name={attachment.fileName}
        meta={formatFileSize(attachment.sizeBytes)}
        thumbnail={attachment.url}
        isImage={attachment.contentType.startsWith('image/')}
        href={attachment.url}
      >
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="shrink-0"
          disabled={remove.isPending}
          onClick={() => setConfirming(true)}
          aria-label={t('milestone.attachments.remove', { name: attachment.fileName })}
        >
          {remove.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <X className="size-4" />
          )}
        </Button>
      </AttachmentRowShell>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('milestone.attachments.removeTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('milestone.attachments.removeDescription', { name: attachment.fileName })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => remove.mutate({ milestoneId, attachmentId: attachment.id })}
            >
              {t('milestone.attachments.removeConfirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
