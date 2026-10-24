import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { Camera, ImageOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ResponsiveDialog } from '@/components/ui/responsive-dialog';
import { checkMaterialPhoto, MATERIAL_PHOTO_ACCEPT } from '@/lib/material-photo';

/**
 * Avisa por qué una foto no sirve y devuelve la que sí. Un solo lugar para el
 * drawer y la fila: los dos eligen archivos con las mismas reglas.
 */
export function useValidMaterialPhoto() {
  const { t } = useTranslation();

  return (file: File | undefined): File | null => {
    if (!file) return null;
    const check = checkMaterialPhoto(file);
    if (check === 'ok') return file;
    toast.error(t(check === 'size' ? 'material.photo.tooLarge' : 'material.photo.unsupported'));
    return null;
  };
}

/**
 * La foto de la fila: chica, y al tocarla se abre grande. Es lo que se le
 * muestra al vendedor, así que el tamaño real importa más que la miniatura.
 */
export function MaterialPhotoThumb({ url, name }: { url: string; name: string }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="size-11 shrink-0 overflow-hidden rounded-md border border-border bg-muted sm:size-10"
        aria-label={t('material.photo.open', { name })}
        onClick={() => setOpen(true)}
      >
        <img src={url} alt="" loading="lazy" className="size-full object-cover" />
      </button>
      <ResponsiveDialog open={open} onOpenChange={setOpen} title={name} hideHeader>
        <img src={url} alt={name} className="max-h-[70dvh] w-full rounded-md object-contain" />
      </ResponsiveDialog>
    </>
  );
}

interface MaterialPhotoFieldProps {
  /** La foto que el material ya tiene (al editar). */
  currentUrl?: string | null;
  /** La foto elegida y todavía sin subir. */
  file: File | null;
  /** Marcada para sacarse al guardar. */
  removed: boolean;
  onPick: (file: File) => void;
  onRemove: () => void;
}

/**
 * El campo "Foto" del drawer. No sube nada: deja elegida la foto y el drawer
 * la sube después de guardar el material, que es lo que tiene id donde colgarla.
 */
export function MaterialPhotoField({
  currentUrl,
  file,
  removed,
  onPick,
  onRemove,
}: MaterialPhotoFieldProps) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const validate = useValidMaterialPhoto();

  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => {
    if (!previewUrl) return;
    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const shown = previewUrl ?? (removed ? null : (currentUrl ?? null));

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const picked = validate(event.target.files?.[0]);
    // Permite volver a elegir el mismo archivo después de un rechazo.
    event.target.value = '';
    if (picked) onPick(picked);
  }

  return (
    <div className="flex flex-col gap-2 sm:col-span-2">
      <p className="text-sm font-medium leading-none">{t('material.photo.label')}</p>
      <div className="flex items-center gap-3">
        <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-md border border-dashed border-border bg-muted text-muted-foreground">
          {shown ? (
            <img src={shown} alt={t('material.photo.previewAlt')} className="size-full object-cover" />
          ) : (
            <ImageOff aria-hidden className="size-5" />
          )}
        </div>
        <div className="flex flex-col items-start gap-2">
          <input
            ref={inputRef}
            type="file"
            accept={MATERIAL_PHOTO_ACCEPT}
            className="hidden"
            onChange={handleChange}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="max-sm:min-h-11"
            onClick={() => inputRef.current?.click()}
          >
            <Camera aria-hidden className="size-4" />
            {t(shown ? 'material.photo.change' : 'material.photo.add')}
          </Button>
          {shown && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="max-sm:min-h-11"
              onClick={onRemove}
            >
              {t('material.photo.remove')}
            </Button>
          )}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">{t('material.photo.hint')}</p>
    </div>
  );
}
