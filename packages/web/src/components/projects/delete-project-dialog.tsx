import { useState } from 'react';
import type { ProjectDeletionSummary } from '@luma/shared';
import { AlertCircle, Copy, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useDeleteProject, useProjectDeletionSummary } from '@/hooks/projects/use-project-queries';
import { errorMessage } from '@/lib/error-message';

/** El orden en que se cuenta lo que se va: de lo que se hace a lo que se mueve. */
const COUNT_ORDER: ReadonlyArray<keyof ProjectDeletionSummary['counts']> = [
  'activities',
  'materials',
  'laborRecords',
  'crewMembers',
  'providers',
  'documents',
  'milestones',
  'payments',
  'expenses',
];

/**
 * Confirmación de eliminar una obra. Dice qué se va ANTES de pedir el click, y
 * pide escribir el nombre: el botón de "Eliminar" no se habilita hasta que
 * coincide, igual que el servidor lo vuelve a comprobar.
 *
 * Es un borrado lógico: el texto lo dice, porque "se elimina" a secas asusta
 * más de lo que corresponde y "se archiva" no dice que desaparece.
 */
export function DeleteProjectDialog({
  projectId,
  projectName,
  open,
  onOpenChange,
}: {
  projectId: string;
  projectName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const [typed, setTyped] = useState('');
  const { data, isLoading } = useProjectDeletionSummary(projectId, open);
  const remove = useDeleteProject(projectId);

  const summary = data?.summary;
  const matches = typed.trim() === projectName.trim();
  const message = errorMessage(remove.error, t);

  const handleOpenChange = (next: boolean) => {
    if (remove.isPending) return;
    if (!next) {
      setTyped('');
      remove.reset();
    }
    onOpenChange(next);
  };

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('project.delete.dialogTitle', { name: projectName })}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="flex flex-col gap-3 text-left">
              {isLoading || !summary ? (
                <p>{t('common.loading')}</p>
              ) : (
                <DeletionSummary summary={summary} />
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="flex flex-col gap-2">
          <Label htmlFor="delete-project-confirm">{t('project.delete.confirmLabel')}</Label>
          <div className="flex items-center gap-2">
            {/* `select-all`: un toque o un triple click lo marca entero para copiarlo a mano. */}
            <code className="min-w-0 flex-1 select-all break-words rounded-md bg-muted px-3 py-1.5 font-mono text-sm">
              {projectName}
            </code>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label={t('project.delete.copyName')}
              title={t('project.delete.copyName')}
              onClick={() => void copyName(projectName, t('project.delete.nameCopied'))}
            >
              <Copy className="size-4" />
            </Button>
          </div>
          <Input
            id="delete-project-confirm"
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
          />
        </div>

        {message && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-md border border-destructive bg-destructive px-3 py-2 text-destructive-foreground"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <div className="flex min-w-0 flex-col">
              <span className="text-sm font-medium">{t('errors.title')}</span>
              <span className="text-sm">{message}</span>
            </div>
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={remove.isPending}>{t('common.cancel')}</AlertDialogCancel>
          <Button
            variant="destructive"
            disabled={!matches || !summary || remove.isPending}
            onClick={() => remove.mutate({ confirmName: typed })}
          >
            {remove.isPending ? t('project.delete.deleting') : t('project.delete.submit')}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/**
 * Copia al portapapeles. `navigator.clipboard` no existe en páginas sin HTTPS ni
 * en algunos webviews: se pregunta por la propiedad en `window`, y si falta el
 * nombre igual queda seleccionable en pantalla.
 */
async function copyName(name: string, doneMessage: string) {
  if (typeof window.navigator?.clipboard?.writeText !== 'function') return;
  try {
    await window.navigator.clipboard.writeText(name);
    toast.success(doneMessage);
  } catch {
    // Permiso denegado: el texto sigue siendo seleccionable.
  }
}

function DeletionSummary({ summary }: { summary: ProjectDeletionSummary }) {
  const { t } = useTranslation();
  const items = COUNT_ORDER.filter((key) => summary.counts[key] > 0);

  return (
    <>
      {items.length === 0 ? (
        <p>{t('project.delete.nothingLoaded')}</p>
      ) : (
        <div>
          <p>{t('project.delete.summaryIntro')}</p>
          <ul className="mt-1 list-disc pl-5">
            {items.map((key) => (
              <li key={key}>{t(`project.delete.counts.${key}`, { count: summary.counts[key] })}</li>
            ))}
          </ul>
        </div>
      )}
      {summary.shared.providers > 0 && (
        <p>{t('project.delete.sharedProviders', { count: summary.shared.providers })}</p>
      )}
      {summary.shared.crewMembers > 0 && (
        <p>{t('project.delete.sharedCrew', { count: summary.shared.crewMembers })}</p>
      )}
      {summary.affectedPeople > 0 && (
        <p>{t('project.delete.affectedPeople', { count: summary.affectedPeople })}</p>
      )}
      {summary.freesSubscriptionSlot && <p>{t('project.delete.freesSlot')}</p>}
      <p>{t('project.delete.retention', { days: summary.retentionDays })}</p>
    </>
  );
}

/**
 * La zona de abajo de la ficha: lo único irreversible a medias de la obra, lejos
 * de los ajustes del día a día para que no se toque de paso.
 */
export function DeleteProjectSection({
  projectId,
  projectName,
}: {
  projectId: string;
  projectName: string;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <Card className="border-destructive/40">
      <CardHeader>
        <CardTitle className="text-base">{t('project.delete.sectionTitle')}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center justify-between gap-4">
        <p className="min-w-0 flex-1 basis-64 text-sm text-muted-foreground">
          {t('project.delete.sectionHint')}
        </p>
        <Button variant="outline" onClick={() => setOpen(true)}>
          <Trash2 className="size-4" />
          {t('project.delete.action')}
        </Button>
      </CardContent>
      <DeleteProjectDialog
        projectId={projectId}
        projectName={projectName}
        open={open}
        onOpenChange={setOpen}
      />
    </Card>
  );
}
