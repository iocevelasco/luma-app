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
  FilterX,
  FileText,
  Image as ImageIcon,
  Plus,
  Trash2,
  Upload,
} from 'lucide-react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useParams, useSearchParams } from 'react-router-dom';
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
import { PageLayout } from '@/components/layout/page-layout';
import { FormDrawer } from '@/components/common/form-drawer';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
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
import { ListSection, ListSections } from '@/components/common/row-card-list';
import { cn, formatFileSize } from '@/lib/utils';

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
        <div className="flex min-w-0 flex-col gap-2">
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
            className="w-full min-w-0 justify-start font-normal"
          >
            <Upload className="size-4" />
            <span className="min-w-0 truncate">{file ? file.name : t('document.fields.filePlaceholder')}</span>
          </Button>
          {file && (
            <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
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
                <SelectTrigger aria-invalid={Boolean(errors.category)} id="document-category">
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
          <Input aria-invalid={Boolean(errors.title)} id="document-title" {...register('title')} />
          {errors.title && <p className="text-sm text-destructive">{errors.title.message}</p>}
        </div>

        {/* El espacio sólo se pide en planos y renders: un permiso municipal
            es de la obra entera, no del baño. */}
        {needsSpace && (
          <div className="flex flex-col gap-2">
            <Label htmlFor="document-space">{t('document.fields.space')}</Label>
            <Input
              aria-invalid={Boolean(errors.space)}
              id="document-space"
              placeholder={t('document.fields.spacePlaceholder')}
              {...register('space')}
            />
            {errors.space && <p className="text-sm text-destructive">{errors.space.message}</p>}
          </div>
        )}

        <div className="flex flex-col gap-2">
          <Label htmlFor="document-notes">{t('document.fields.notes')}</Label>
          <Textarea aria-invalid={Boolean(errors.notes)} id="document-notes" rows={3} {...register('notes')} />
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

type GroupBy = 'category' | 'uploader' | 'none';

const ALL = 'all';

function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || '?'
  );
}

/**
 * Miniatura. Las imágenes se muestran tal cual con la URL firmada; un PDF no
 * se puede rasterizar sin cargar un renderer en el navegador, así que lleva un
 * mosaico con el ícono y la etiqueta PDF.
 */
function DocumentThumbnail({ doc }: { doc: ProjectDocument }) {
  const { t } = useTranslation();
  const isImage = doc.contentType.startsWith('image/');
  const [failed, setFailed] = useState(false);

  if (isImage && doc.url && !failed) {
    return (
      <img
        src={doc.url}
        alt={doc.title}
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
        className="size-full object-cover"
      />
    );
  }

  return (
    <div className="flex size-full flex-col items-center justify-center gap-1 text-muted-foreground">
      <DocumentIcon contentType={doc.contentType} className="size-8" />
      <span className="text-2xs font-medium uppercase">
        {isImage ? t('document.previewUnavailable') : t('document.pdf')}
      </span>
    </div>
  );
}

/** Misma razón que arriba para `doc`: no tapar `window.document`. */
function DocumentCard({
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
  const date = format(new Date(doc.createdAt), 'PP', { locale: dateLocale });

  const thumbnail = (
    <div className="aspect-[4/3] w-full overflow-hidden rounded-xl bg-muted">
      <DocumentThumbnail doc={doc} />
    </div>
  );

  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-card p-3 shadow-surface transition-shadow duration-200 focus-within:shadow-lift hover:shadow-lift">
      {/* `doc.url` vence y viene `null` sin storage: sin URL la miniatura no es un enlace. */}
      {doc.url ? (
        <a
          href={doc.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={t('document.open')}
          className="focus-visible:ring-ring rounded-xl outline-none focus-visible:ring-2"
        >
          {thumbnail}
        </a>
      ) : (
        thumbnail
      )}

      <div className="flex min-w-0 flex-col gap-1">
        <p className="truncate text-sm font-medium" title={doc.title}>
          {doc.title}
        </p>
        <div className="flex flex-wrap items-center gap-1">
          <Badge>{t(`document.category.${doc.category}`)}</Badge>
          {doc.space && <Badge variant="info">{doc.space}</Badge>}
        </div>
        {doc.notes && <p className="line-clamp-2 text-xs text-muted-foreground">{doc.notes}</p>}
      </div>

      <div className="mt-auto flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Avatar className="size-6">
            <AvatarFallback className="text-2xs">{initials(doc.uploadedByName)}</AvatarFallback>
          </Avatar>
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-xs font-medium">{doc.uploadedByName || '—'}</span>
            <span className="truncate text-2xs text-muted-foreground">
              {t('document.uploadedOn', { date })} · {formatFileSize(doc.sizeBytes)}
            </span>
          </div>
        </div>

        <div className="flex shrink-0 items-center">
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
    </div>
  );
}

function DocumentGrid({
  projectId,
  docs,
  canWrite,
}: {
  projectId: string;
  docs: ProjectDocument[];
  canWrite: boolean;
}) {
  return (
    // Tarjetas de ancho acotado: con el ancho entero, columnas fluidas
    // estirarían cada preview hasta ocupar media pantalla.
    <div className="grid grid-cols-[repeat(auto-fill,minmax(10rem,12rem))] gap-3 max-sm:grid-cols-2">
      {docs.map((doc) => (
        <DocumentCard key={doc.id} projectId={projectId} doc={doc} canWrite={canWrite} />
      ))}
    </div>
  );
}

function groupBySpace(docs: ProjectDocument[]): [string, ProjectDocument[]][] {
  const map = new Map<string, ProjectDocument[]>();
  for (const doc of docs) {
    const key = doc.space ?? '';
    map.set(key, [...(map.get(key) ?? []), doc]);
  }
  return [...map.entries()];
}

interface DocumentGroup {
  key: string;
  label: string;
  docs: ProjectDocument[];
}

export function ProjectDocumentsPage() {
  const { t } = useTranslation();
  const { projectId } = useParams<{ projectId: string }>();
  const { data, isLoading, isError } = useProjectDocuments(projectId);
  const { can } = useProjectCapabilities(projectId);

  // El resumen de la obra enlaza acá con `?category=render|plano`: llegar y
  // ver todo mezclado obligaba a filtrar a mano lo que recién se tocó.
  const [searchParams] = useSearchParams();
  const requestedCategory = searchParams.get('category');
  const [categoryFilter, setCategoryFilter] = useState<string>(
    CATEGORY_ORDER.some((category) => category === requestedCategory) && requestedCategory
      ? requestedCategory
      : ALL,
  );
  const [uploaderFilter, setUploaderFilter] = useState<string>(ALL);
  const [groupBy, setGroupBy] = useState<GroupBy>('category');

  const canWrite = can('document.write');
  const documents = useMemo(() => data?.documents ?? [], [data]);

  /** Las personas salen de lo que ya se subió: no hay una lista aparte que mantener. */
  const uploaders = useMemo(() => {
    const map = new Map<string, string>();
    for (const doc of documents) map.set(doc.uploadedBy, doc.uploadedByName);
    return [...map.entries()].map(([id, name]) => ({ id, name: name || '—' }));
  }, [documents]);

  const categoriesInUse = useMemo(
    () => CATEGORY_ORDER.filter((category) => documents.some((doc) => doc.category === category)),
    [documents],
  );

  const filtered = useMemo(
    () =>
      documents.filter(
        (doc) =>
          (categoryFilter === ALL || doc.category === categoryFilter) &&
          (uploaderFilter === ALL || doc.uploadedBy === uploaderFilter),
      ),
    [documents, categoryFilter, uploaderFilter],
  );

  const groups = useMemo<DocumentGroup[]>(() => {
    if (groupBy === 'none') return [{ key: 'all', label: '', docs: filtered }];

    if (groupBy === 'uploader') {
      const map = new Map<string, DocumentGroup>();
      for (const doc of filtered) {
        const group = map.get(doc.uploadedBy) ?? {
          key: doc.uploadedBy,
          label: doc.uploadedByName || '—',
          docs: [],
        };
        group.docs.push(doc);
        map.set(doc.uploadedBy, group);
      }
      return [...map.values()];
    }

    return CATEGORY_ORDER.flatMap((category) => {
      const docs = filtered.filter((doc) => doc.category === category);
      return docs.length > 0
        ? [{ key: category, label: t(`document.category.${category}`), docs }]
        : [];
    });
  }, [filtered, groupBy, t]);

  if (isError) return <PageLayout isError />;
  if (isLoading || !data) return <PageLayout isLoading />;

  const hasFilters = categoryFilter !== ALL || uploaderFilter !== ALL;

  // Filtros arriba a la izquierda, en la misma fila que la acción principal.
  const filters = (
  <div className="flex flex-wrap items-end gap-3">
    <div className="flex flex-col gap-1">
      <Label htmlFor="filter-category" className="text-xs">
        {t('document.filters.category')}
      </Label>
      <Select value={categoryFilter} onValueChange={setCategoryFilter}>
        <SelectTrigger id="filter-category" className="w-48">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{t('document.filters.allCategories')}</SelectItem>
          {categoriesInUse.map((category) => (
            <SelectItem key={category} value={category}>
              {t(`document.category.${category}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>

    <div className="flex flex-col gap-1">
      <Label htmlFor="filter-uploader" className="text-xs">
        {t('document.filters.uploader')}
      </Label>
      <Select value={uploaderFilter} onValueChange={setUploaderFilter}>
        <SelectTrigger id="filter-uploader" className="w-48">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{t('document.filters.allUploaders')}</SelectItem>
          {uploaders.map((person) => (
            <SelectItem key={person.id} value={person.id}>
              {person.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>

    <div className="flex flex-col gap-1">
      <Label htmlFor="group-by" className="text-xs">
        {t('document.filters.groupBy')}
      </Label>
      <Select value={groupBy} onValueChange={(value) => setGroupBy(value as GroupBy)}>
        <SelectTrigger id="group-by" className="w-48">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="category">{t('document.filters.groupCategory')}</SelectItem>
          <SelectItem value="uploader">{t('document.filters.groupUploader')}</SelectItem>
          <SelectItem value="none">{t('document.filters.groupNone')}</SelectItem>
        </SelectContent>
      </Select>
    </div>

    {hasFilters && (
      <Button
        variant="ghost"
        onClick={() => {
          setCategoryFilter(ALL);
          setUploaderFilter(ALL);
        }}
      >
        <FilterX className="size-4" />
        {t('document.filters.clear')}
      </Button>
    )}
  </div>
  );

  return (
    <PageLayout
      // Ancho entero: la lista arranca en el mismo borde que los filtros.
      width="full"
      toolbar={documents.length > 0 ? filters : undefined}
      action={canWrite ? <NewDocumentDrawer projectId={projectId!} /> : undefined}
      empty={
        documents.length === 0
          ? {
              icon: FileText,
              title: t('document.empty.title'),
              description: canWrite
                ? t('document.empty.description')
                : t('document.empty.descriptionReadOnly'),
            }
          : undefined
      }
    >
      {filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          {t('document.filters.noResults')}
        </p>
      ) : (
        <ListSections>
          {groups.map((group) => {
            // Planos y renders se subdividen por espacio: "el plano de la cocina".
            const bySpace =
              groupBy === 'category' && isSpaceScoped(group.key as DocumentCategory)
                ? groupBySpace(group.docs)
                : null;

            const content = bySpace ? (
                  bySpace.map(([space, docs]) => (
                    <div key={space || 'sin-espacio'} className="flex flex-col gap-2">
                      <p className={cn('text-xs text-muted-foreground', !space && 'italic')}>
                        {space || t('document.list.noSpace')}
                      </p>
                      <DocumentGrid projectId={projectId!} docs={docs} canWrite={canWrite} />
                    </div>
                  ))
                ) : (
                  <DocumentGrid projectId={projectId!} docs={group.docs} canWrite={canWrite} />
                );

            // Sin agrupar no hay rótulo: la grilla va sola, sin un divisor que no separa nada.
            return group.label ? (
              <ListSection key={group.key} label={group.label} meta={group.docs.length}>
                {content}
              </ListSection>
            ) : (
              <div key={group.key}>{content}</div>
            );
          })}
        </ListSections>
      )}
    </PageLayout>
  );
}

export default ProjectDocumentsPage;
