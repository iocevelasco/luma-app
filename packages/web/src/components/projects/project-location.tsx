import { ExternalLink, Map as MapIcon, Pencil } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Project } from '@luma/shared';
import { FormShell } from '@/components/common/form-shell';
import { LocationField } from '@/components/projects/location-field';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { ResponsiveDialog } from '@/components/ui/responsive-dialog';
import { useUpdateProjectLocation } from '@/hooks/projects/use-project-queries';
import { useIntegrationsConfig } from '@/hooks/integrations-config/use-integrations-config';
import { directionsUrl, mapEmbedUrl, mapsLanguage } from '@/lib/google-places';

interface ProjectLocationProps {
  project: Pick<Project, 'id' | 'location' | 'placeId'>;
  canEdit: boolean;
}

/**
 * La ubicación en la ficha de la obra (ADR-005 §2).
 *
 * - "Ver en el mapa": el iframe de Maps Embed se carga recién al tocarlo, así
 *   nada sale hacia Google sin una acción de la persona. Sólo con `placeId`.
 * - "Cómo llegar": un enlace a Google Maps, con o sin `placeId`. No usa API.
 * - "Editar ubicación": lo único de la ficha que se edita después del alta. Es
 *   lo que les da mapa a las obras anteriores (no se completan en lote).
 */
export function ProjectLocation({ project, canEdit }: ProjectLocationProps) {
  const { t, i18n } = useTranslation();
  const { data: config } = useIntegrationsConfig();
  const apiKey = config?.maps?.apiKey;
  const [showMap, setShowMap] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<{ location: string; placeId?: string }>({
    location: project.location,
    placeId: project.placeId,
  });
  const update = useUpdateProjectLocation(project.id);

  const language = mapsLanguage(i18n.resolvedLanguage ?? i18n.language);
  const canShowMap = Boolean(apiKey && project.placeId);

  const openEditor = () => {
    setDraft({ location: project.location, placeId: project.placeId });
    update.reset();
    setEditing(true);
  };

  const unchanged =
    draft.location.trim() === project.location && draft.placeId === project.placeId;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {canShowMap && (
          <Button type="button" variant="outline" size="sm" onClick={() => setShowMap((v) => !v)}>
            <MapIcon aria-hidden="true" />
            {showMap ? t('project.location.hideMap') : t('project.location.showMap')}
          </Button>
        )}
        <Button asChild variant="outline" size="sm">
          <a href={directionsUrl(project.location, project.placeId)} target="_blank" rel="noopener noreferrer">
            <ExternalLink aria-hidden="true" />
            {t('project.location.directions')}
          </a>
        </Button>
        {canEdit && (
          <Button type="button" variant="ghost" size="sm" onClick={openEditor}>
            <Pencil aria-hidden="true" />
            {t('project.location.edit')}
          </Button>
        )}
      </div>

      {showMap && canShowMap && (
        <iframe
          title={t('project.location.mapTitle', { location: project.location })}
          src={mapEmbedUrl(apiKey!, project.placeId!, language)}
          className="h-64 min-h-[200px] w-full rounded-2xl border-0"
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
        />
      )}

      {canEdit && (
        <ResponsiveDialog
          open={editing}
          onOpenChange={(open) => !open && !update.isPending && setEditing(false)}
          title={t('project.location.editTitle')}
          description={t('project.location.editHint')}
        >
          <FormShell
            variant="embedded"
            className="gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              update.mutate(
                { location: draft.location.trim(), placeId: draft.placeId },
                { onSuccess: () => setEditing(false) },
              );
            }}
            onCancel={() => setEditing(false)}
            isSubmitting={update.isPending}
            isDirty={Boolean(draft.location.trim()) && !unchanged}
            error={update.error}
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor="project-location">{t('project.fields.location')}</Label>
              <LocationField
                id="project-location"
                value={draft.location}
                placeId={draft.placeId}
                autoFocus
                onChange={(location, placeId) => setDraft({ location, placeId })}
              />
            </div>
          </FormShell>
        </ResponsiveDialog>
      )}
    </div>
  );
}
