import { useEffect, useState } from 'react';
import type { ProjectDocument } from '@luma/shared';
import { ExternalLink } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useProjectDocumentFile } from '@/hooks/documents/use-document-queries';
import { LazyImage } from '@/components/common/lazy-image';
import { Skeleton } from '@/components/ui/skeleton';

function message(text: string) {
  return (
    <p className="flex size-full items-center justify-center p-6 text-center text-sm text-muted-foreground">
      {text}
    </p>
  );
}

interface DocumentPreviewProps {
  projectId: string;
  doc: ProjectDocument | null;
  onClose: () => void;
}

/**
 * El PDF como `blob:` URL, que sí se puede abrir en un `<iframe>`. Se revoca al
 * cambiar de documento o cerrar: cada URL mantiene el archivo en memoria.
 */
function usePdfUrl(projectId: string, doc: ProjectDocument | null) {
  const isPdf = doc?.contentType === 'application/pdf';
  const { data: blob, isLoading } = useProjectDocumentFile(
    projectId,
    isPdf ? doc.id : undefined,
  );
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!blob) {
      setUrl(null);
      return;
    }
    const next = URL.createObjectURL(blob);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [blob]);

  return { url, isLoading: isLoading && isPdf };
}

/**
 * Vista previa de un documento al hacerle doble clic en el explorador. Una
 * imagen sale de la URL firmada (que vence: nunca se guarda, ver
 * `ProjectDocument.url`). Un PDF no: el servicio de archivos manda esa URL con
 * `Content-Security-Policy: sandbox` y el navegador no la abre en un `<iframe>`,
 * así que se pide a la API y se muestra como `blob:`.
 */
export function DocumentPreview({ projectId, doc, onClose }: DocumentPreviewProps) {
  const { t } = useTranslation();
  const isImage = doc?.contentType.startsWith('image/') ?? false;
  const pdf = usePdfUrl(projectId, doc);

  return (
    <Dialog open={doc !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex h-[85dvh] max-w-4xl flex-col gap-3 sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle className="truncate pr-8">{doc?.title}</DialogTitle>
          <DialogDescription className="sr-only">{doc?.fileName}</DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-hidden rounded-md bg-muted">
          {isImage && doc?.url ? (
            <LazyImage
              src={doc.url}
              alt={doc.title}
              className="size-full"
              fallback={message(t('document.fm.preview.loadFailed'))}
            />
          ) : !isImage && pdf.url ? (
            <iframe src={pdf.url} title={doc?.title} className="size-full border-0" />
          ) : !isImage && pdf.isLoading ? (
            <Skeleton className="size-full rounded-none" />
          ) : (
            message(t('document.fm.preview.unavailable'))
          )}
        </div>

        {doc?.url && (
          <div className="flex justify-end">
            <Button variant="outline" asChild>
              <a href={doc.url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="size-4" />
                {t('document.fm.preview.openInTab')}
              </a>
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
