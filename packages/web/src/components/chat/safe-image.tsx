import { useState } from 'react';
import { ImageOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { checkUrl, type UrlPurpose } from '@/lib/chat/urls';
import { cn } from '@/lib/utils';

/**
 * La única forma de mostrar una imagen en el chat. Las miniaturas y el visor
 * ampliado pasan por acá, así que comparten las mismas reglas: la URL se valida
 * al renderizar (no se confía en que otro componente ya lo hizo) y, si no
 * pasa, se muestra un estado entendible en lugar de pedirla.
 *
 * - `local-preview`: sólo `blob:` creados por la propia app.
 * - `remote-image`: sólo HTTPS desde los orígenes autorizados.
 */
export type SafeImageKind = Extract<UrlPurpose, 'local-preview' | 'remote-image'>;

interface SafeImageProps {
  src: unknown;
  kind: SafeImageKind;
  /** Texto: React lo escapa. */
  alt: string;
  /** Con `zoomable` la miniatura abre el visor. El visor no lo usa. */
  zoomable?: boolean;
  className?: string;
}

export function BlockedImage({ alt, className }: { alt: string; className?: string }) {
  const { t } = useTranslation();
  return (
    <span
      role="img"
      aria-label={t('secureChat.blockedImage')}
      data-testid="blocked-image"
      className={cn(
        'inline-flex max-w-full items-center gap-2 rounded-md border border-dashed border-border bg-secondary px-3 py-2 text-xs text-muted-foreground',
        className,
      )}
    >
      <ImageOff className="size-4 shrink-0" aria-hidden />
      <span className="min-w-0 break-words">
        {t('secureChat.blockedImage')}
        {alt ? ` · ${alt}` : ''}
      </span>
    </span>
  );
}

export function SafeImage({ src, kind, alt, zoomable = false, className }: SafeImageProps) {
  const { t } = useTranslation();
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);

  const check = checkUrl(src, kind);
  if (!check.ok || failed) return <BlockedImage alt={alt} className={className} />;

  const image = (
    <img
      src={check.url}
      alt={alt}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      draggable={false}
      onError={() => setFailed(true)}
      className={cn('max-h-64 max-w-full rounded-md object-contain', className)}
    />
  );
  if (!zoomable) return image;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t('secureChat.openImage', { name: alt })}
        className="inline-block max-w-full rounded-md focus-visible:outline-2 focus-visible:outline-ring"
      >
        {image}
      </button>
      <ImageViewer open={open} onOpenChange={setOpen} src={check.url} kind={kind} alt={alt} />
    </>
  );
}

/** El visor vuelve a validar `src`: no hereda la confianza de la miniatura. */
export function ImageViewer({
  open,
  onOpenChange,
  src,
  kind,
  alt,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  src: unknown;
  kind: SafeImageKind;
  alt: string;
}) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogTitle className="break-words text-sm">{alt || t('secureChat.viewerTitle')}</DialogTitle>
        <DialogDescription className="sr-only">{t('secureChat.viewerTitle')}</DialogDescription>
        <div className="flex justify-center" data-testid="image-viewer">
          <SafeImage src={src} kind={kind} alt={alt} className="max-h-[70dvh]" />
        </div>
      </DialogContent>
    </Dialog>
  );
}
