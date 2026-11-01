import { useEffect, useMemo, useRef, useState } from 'react';
import { ImagePlus, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { CAMPAIGN_IMAGE_MAX_BYTES, CAMPAIGN_IMAGE_TYPES, campaignInputSchema } from '@luma/shared';
import { FormShell } from '@/components/common/form-shell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useCreateCampaign } from '@/hooks/platform/use-platform-campaigns-queries';

/**
 * Escribir una campaña: título, contenido e imagen. Guarda un borrador; se
 * envía desde la lista, después de mandarse una prueba.
 */
export function CampaignForm() {
  const { t } = useTranslation();
  const create = useCreateCampaign();
  const fileRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);

  const preview = useMemo(() => (image ? URL.createObjectURL(image) : null), [image]);
  useEffect(() => () => (preview ? URL.revokeObjectURL(preview) : undefined), [preview]);

  const parsed = campaignInputSchema.safeParse({ title, body });

  const pick = (file: File | undefined) => {
    setImageError(null);
    if (!file) return;
    if (!(CAMPAIGN_IMAGE_TYPES as readonly string[]).includes(file.type)) {
      setImageError(t('platform.campaigns.imageType'));
    } else if (file.size > CAMPAIGN_IMAGE_MAX_BYTES) {
      setImageError(t('platform.campaigns.imageSize'));
    } else {
      setImage(file);
    }
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('platform.campaigns.formTitle')}</CardTitle>
      </CardHeader>
      <CardContent>
        <FormShell
          variant="embedded"
          className="gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!parsed.success) return;
            create.mutate(
              { payload: parsed.data, image },
              {
                onSuccess: () => {
                  setTitle('');
                  setBody('');
                  setImage(null);
                },
              },
            );
          }}
          submitLabel={t('platform.campaigns.save')}
          isSubmitting={create.isPending}
          isDirty={parsed.success}
          error={create.error}
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="campaign-title">{t('platform.campaigns.title')}</Label>
            <Input
              id="campaign-title"
              value={title}
              maxLength={120}
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="campaign-body">{t('platform.campaigns.body')}</Label>
            <Textarea
              id="campaign-body"
              rows={6}
              value={body}
              maxLength={5000}
              onChange={(event) => setBody(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">{t('platform.campaigns.bodyHint')}</p>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="campaign-image">{t('platform.campaigns.image')}</Label>
            <input
              ref={fileRef}
              id="campaign-image"
              type="file"
              accept={CAMPAIGN_IMAGE_TYPES.join(',')}
              className="sr-only"
              onChange={(event) => pick(event.target.files?.[0])}
            />
            {preview ? (
              <div className="relative w-fit">
                <img src={preview} alt="" className="max-h-40 rounded-md border border-border" />
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  className="absolute right-2 top-2"
                  aria-label={t('platform.campaigns.removeImage')}
                  onClick={() => setImage(null)}
                >
                  <X className="size-4" />
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                variant="secondary"
                className="w-fit"
                onClick={() => fileRef.current?.click()}
              >
                <ImagePlus className="size-4" />
                {t('platform.campaigns.pickImage')}
              </Button>
            )}
            <p className="text-xs text-muted-foreground">{t('platform.campaigns.imageHint')}</p>
            {imageError && (
              <p role="alert" className="text-xs text-destructive">
                {imageError}
              </p>
            )}
          </div>
        </FormShell>
      </CardContent>
    </Card>
  );
}
