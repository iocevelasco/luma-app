import { useMemo, useRef, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  createProjectDocumentSchema,
  DOCUMENT_CATEGORIES,
  DOCUMENT_MAX_BYTES,
  DOCUMENT_MIME_TYPES,
  isSpaceScoped,
  type CreateProjectDocumentInput,
  type DocumentCategory,
  type ProjectDocument,
} from '@luma/shared';
import { format } from 'date-fns';
import {
  Download,
  FileText,
  Image as ImageIcon,
  Plus,
  Trash2,
  Upload,
} from 'lucide-react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
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
import { EmptyState } from '@/components/common/empty-state';
import { FormDrawer } from '@/components/common/form-drawer';
import { RouteError } from '@/components/routes/route-error';
import { RouteLoading } from '@/components/routes/route-loading';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  useCreateProjectDocument,
  useDeleteProjectDocument,
  useProjectDocuments,
} from '@/hooks/documents/use-document-queries';
import { useProjectCapabilities } from '@/hooks/projects/use-project-capabilities';
import { useDateLocale } from '@/hooks/use-date-locale';
import { cn } from '@/lib/utils';

/**
 * El orden de las categorías en la pantalla no es el del enum: primero los
 * permisos y las condiciones, que son lo que alguien viene a buscar con
 * urgencia —el encargado del edificio pidiendo el permiso en la puerta—, y
 * después planos y renders, que se consultan con tiempo.
 */
const CATEGORY_ORDER: DocumentCategory[] = [
  'permiso_edificio',
  'permiso_municipal',
  'condiciones_sitio',
  'horario_trabajo',
  'plano',
  'render',
  'otra',
];

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Un PDF y una imagen se buscan distinto; el ícono lo dice antes que el nombre. */
function DocumentIcon({ contentType, className }: { contentType: string; className?: string }) {
  const Icon = contentType === 'application/pdf' ? FileText : ImageIcon;
  return <Icon className={className} />;
}

function NewDocumentDrawer({ projectId }: { projectId: string }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const createDocument = useCreateProjectDocument(projectId);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    control,
    formState: { errors },
  } = useForm<CreateProjectDocumentInput>({
    resolver: zodResolver(createProjectDocumentSchema),
  });

  const category = watch('category');
  const needsSpace = category ? isSpaceScoped(category) : false;

  function resetAll() {
    reset();
    setFile(null);
    setFileError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  /**
   * Se valida acá y no sólo en la API: subir 20MB para que el servidor diga
   * que no es desperdiciar la conexión de alguien que está en la obra con
   * datos móviles.
   */
  function handleFile(selected: File | null) {
    if (!selected) {
      setFile(null);
      setFileError(null);
      return;
    }
    if (!DOCUMENT_MIME_TYPES.includes(selected.type)) {
      setFile(null);
      setFileError(t('document.errors.fileType'));
      return;
    }
    if (selected.size > DOCUMENT_MAX_BYTES) {
      setFile(null);
      setFileError(t('document.errors.fileSize'));
      return;
    }
    setFile(selected);
    setFileError(null);
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="size-4" />
        {t('document.new.title')}
      </Button>

      <FormDrawer
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) resetAll();
        }}
        title={t('document.new.title')}
        fieldCount={5}
        submitLabel={t('document.new.submit')}
        isSubmitting={createDocument.isPending}
        error={createDocument.error}
        onSubmit={handleSubmit((values) => {
          if (!file) {
            setFileError(t('document.errors.fileRequired'));
            return;
          }
          createDocument.mutate(
            { ...values, file },
            {
              onSuccess: () => {
                resetAll();
                setOpen(false);
              },
            },
          );
        })}
      >
        <div className="flex flex-col gap-2">
          <Label htmlFor="document-file">{t('document.fields.file')}</Label>
          {/*
            El input nativo de archivo no se puede estilar, así que se esconde
            y el botón de al lado lo dispara. El `label` sigue apuntándole, de
            modo que el lector de pantalla anuncia el campo igual.
          */}
          <input
            ref={fileInputRef}
            id="document-file"
            type="file"
            accept={DOCUMENT_MIME_TYPES.join(',')}
            className="sr-only"
            onChange={(event) => handleFile(event.target.files?.[0] ?? null)}
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            className="justify-start font-normal"
          >
            <Upload className="size-4" />
            {file ? file.name : t('document.fields.filePlaceholder')}
          </Button>
          {file && (
            <p className="text-xs text-muted-foreground">{formatSize(file.size)}</p>
          )}
          {fileError && <p className="text-sm text-destructive">{fileError}</p>}
          <p className="text-2xs text-muted-foreground">{t('document.fields.fileHint')}</p>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="document-category">{t('document.fields.category')}</Label>
          <Controller
            control={control}
            name="category"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="document-category">
                  <SelectValue placeholder={t('document.fields.categoryPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {DOCUMENT_CATEGORIES.map((option) => (
                    <SelectItem key={option} value={option}>
                      {t(`document.category.${option}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {errors.category && (
            <p className="text-sm text-destructive">{errors.category.message}</p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="document-title">{t('document.fields.title')}</Label>
          <Input id="document-title" {...register('title')} />
          {errors.title && <p className="text-sm text-destructive">{errors.title.message}</p>}
        </div>

        {/* El espacio sólo se pide en planos y renders: un permiso municipal
            es de la obra entera, no del baño. */}
        {needsSpace && (
          <div className="flex flex-col gap-2">
            <Label htmlFor="document-space">{t('document.fields.space')}</Label>
            <Input
              id="document-space"
              placeholder={t('document.fields.spacePlaceholder')}
              {...register('space')}
            />
            {errors.space && <p className="text-sm text-destructive">{errors.space.message}</p>}
          </div>
        )}

        <div className="flex flex-col gap-2">
          <Label htmlFor="document-notes">{t('document.fields.notes')}</Label>
          <Textarea id="document-notes" rows={3} {...register('notes')} />
          {errors.notes && <p className="text-sm text-destructive">{errors.notes.message}</p>}
        </div>
      </FormDrawer>
    </>
  );
}

/**
 * La prop se llama `doc` y no `document`: dentro del componente, un parámetro
 * llamado `document` tapa el global `window.document`, y el día que alguien
 * agregue un `document.querySelector` acá adentro va a romper sin que
 * TypeScript diga nada.
 */
function DeleteDocumentButton({
  projectId,
  doc,
}: {
  projectId: string;
  doc: ProjectDocument;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const deleteDocument = useDeleteProjectDocument(projectId);

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen(true)}
        aria-label={t('document.delete.action')}
      >
        <Trash2 className="size-4" />
      </Button>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('document.delete.title')}</AlertDialogTitle>
            {/* El archivo se va del bucket: conviene decirlo antes y no después. */}
            <AlertDialogDescription>
              {t('document.delete.description', { title: doc.title })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteDocument.mutate(doc.id, { onSuccess: () => setOpen(false) })}
            >
              {t('document.delete.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/** Misma razón que arriba para `doc`: no tapar `window.document`. */
function DocumentRow({
  projectId,
  doc,
  canWrite,
}: {
  projectId: string;
  doc: ProjectDocument;
  canWrite: boolean;
}) {
  const { t } = useTranslation();
  const dateLocale = useDateLocale();

  return (
    <div className="flex items-start justify-between gap-3 rounded-md border border-border p-3">
      <div className="flex min-w-0 items-start gap-3">
        <DocumentIcon
          contentType={doc.contentType}
          className="mt-0.5 size-4 shrink-0 text-muted-foreground"
        />
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className="truncate text-sm font-medium">{doc.title}</p>
          {doc.space && (
            <Badge variant="secondary" className="w-fit">
              {doc.space}
            </Badge>
          )}
          {doc.notes && (
            <p className="text-xs text-muted-foreground">{doc.notes}</p>
          )}
          <p className="text-2xs text-muted-foreground">
            {t('document.uploadedBy', {
              name: doc.uploadedByName,
              date: format(new Date(doc.createdAt), 'PP', { locale: dateLocale }),
            })}
            {' · '}
            {formatSize(doc.sizeBytes)}
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {/*
          `doc.url` es una URL firmada que vence. Si el storage no está
          configurado viene `null`, y entonces no hay nada que abrir: el botón
          se deshabilita en vez de llevar a un enlace roto.
        */}
        <Button
          variant="ghost"
          size="icon"
          asChild={Boolean(doc.url)}
          disabled={!doc.url}
          aria-label={t('document.open')}
        >
          {doc.url ? (
            <a href={doc.url} target="_blank" rel="noopener noreferrer">
              <Download className="size-4" />
            </a>
          ) : (
            <Download className="size-4" />
          )}
        </Button>
        {canWrite && <DeleteDocumentButton projectId={projectId} doc={doc} />}
      </div>
    </div>
  );
}

export function ProjectDocumentsPage() {
  const { t } = useTranslation();
  const { projectId } = useParams<{ projectId: string }>();
  const { data, isLoading, isError } = useProjectDocuments(projectId);
  const { can } = useProjectCapabilities(projectId);

  const canWrite = can('document.write');

  /**
   * Agrupado por categoría y, dentro de planos y renders, por espacio. Una
   * lista plana de cuarenta archivos obliga a leerlos todos para encontrar el
   * plano de la cocina.
   */
  const grouped = useMemo(() => {
    const byCategory = new Map<DocumentCategory, ProjectDocument[]>();
    for (const doc of data?.documents ?? []) {
      const list = byCategory.get(doc.category) ?? [];
      list.push(doc);
      byCategory.set(doc.category, list);
    }
    return byCategory;
  }, [data]);

  if (isError) return <RouteError />;
  if (isLoading || !data) return <RouteLoading />;

  if (data.documents.length === 0) {
    return (
      <div className="p-3 md:p-4">
        <EmptyState
          title={t('document.empty.title')}
          description={
            canWrite ? t('document.empty.description') : t('document.empty.descriptionReadOnly')
          }
          action={canWrite ? <NewDocumentDrawer projectId={projectId!} /> : undefined}
          replacesPrimaryAction
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-3 md:p-4">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-medium">{t('document.list.title')}</h2>
        {canWrite && <NewDocumentDrawer projectId={projectId!} />}
      </div>

      <div className="flex flex-col gap-6">
        {CATEGORY_ORDER.map((category) => {
          const documents = grouped.get(category);
          if (!documents || documents.length === 0) return null;

          const spaceScoped = isSpaceScoped(category);
          const bySpace = new Map<string, ProjectDocument[]>();
          if (spaceScoped) {
            for (const doc of documents) {
              const key = doc.space ?? '';
              const list = bySpace.get(key) ?? [];
              list.push(doc);
              bySpace.set(key, list);
            }
          }

          return (
            <section key={category} className="flex flex-col gap-2">
              <h3 className="text-sm font-medium">
                {t(`document.category.${category}`)} ({documents.length})
              </h3>

              {spaceScoped ? (
                [...bySpace.entries()].map(([space, docs]) => (
                  <div key={space || 'sin-espacio'} className="flex flex-col gap-2">
                    <p className={cn('text-xs text-muted-foreground', !space && 'italic')}>
                      {space || t('document.list.noSpace')}
                    </p>
                    {docs.map((doc) => (
                      <DocumentRow
                        key={doc.id}
                        projectId={projectId!}
                        doc={doc}
                        canWrite={canWrite}
                      />
                    ))}
                  </div>
                ))
              ) : (
                documents.map((doc) => (
                  <DocumentRow
                    key={doc.id}
                    projectId={projectId!}
                    doc={doc}
                    canWrite={canWrite}
                  />
                ))
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

export default ProjectDocumentsPage;
