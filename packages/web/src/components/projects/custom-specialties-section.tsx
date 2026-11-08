import { useState } from 'react';
import type { ProjectCustomSpecialty } from '@luma/shared';
import { MoreHorizontal } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  useCreateCustomSpecialty,
  useUpdateCustomSpecialty,
} from '@/hooks/projects/use-project-queries';
import { toast } from '@/lib/toast';
import { errorMessage } from '@/lib/error-message';
import { cn } from '@/lib/utils';
import { FormDrawer } from '@/components/common/form-drawer';

/**
 * Las especialidades propias de la obra: agregar, renombrar y archivar. Archivar
 * no borra: las tareas que ya la tienen siguen mostrándola, sólo deja de
 * ofrecerse al crear otras. Es reversible, por eso no pide confirmación.
 */
export function CustomSpecialtiesSection({
  projectId,
  specialties,
  bare = false,
}: {
  projectId: string;
  specialties: readonly ProjectCustomSpecialty[];
  /** Sin título ni divisor: cuando ya lo pone el panel que la contiene. */
  bare?: boolean;
}) {
  const { t } = useTranslation();
  const create = useCreateCustomSpecialty(projectId);
  const update = useUpdateCustomSpecialty(projectId);
  const [label, setLabel] = useState('');
  const [renaming, setRenaming] = useState<ProjectCustomSpecialty | null>(null);
  const [renameValue, setRenameValue] = useState('');

  return (
    <div className={cn('flex flex-col gap-3', !bare && 'border-t border-border pt-4')}>
      {!bare && (
        <div>
          <h3 className="text-sm font-medium">{t('specialty.manage.title')}</h3>
          <p className="text-sm text-muted-foreground">{t('specialty.manage.hint')}</p>
        </div>
      )}

      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          // Los eventos de React suben por los portales: sin esto, agregar una
          // especialidad desde un panel abierto sobre un formulario lo enviaría.
          event.stopPropagation();
          create.mutate(label, { onSuccess: () => setLabel('') });
        }}
      >
        <Input
          aria-label={t('specialty.manage.name')}
          aria-invalid={create.isError}
          placeholder={t('specialty.manage.placeholder')}
          maxLength={40}
          value={label}
          onChange={(event) => {
            setLabel(event.target.value);
            if (create.isError) create.reset();
          }}
        />
        <Button type="submit" disabled={label.trim().length < 2 || create.isPending}>
          {t('specialty.manage.add')}
        </Button>
      </form>
      {create.isError && (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage(create.error, t)}
        </p>
      )}

      {specialties.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('specialty.manage.empty')}</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {specialties.map((specialty) => (
            <li key={specialty.key} className="flex items-center justify-between gap-2 text-sm">
              <span className="flex min-w-0 items-center gap-2">
                <span className="truncate">{specialty.label}</span>
                {specialty.archived && <Badge>{t('specialty.manage.archived')}</Badge>}
              </span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t('specialty.manage.actions', { name: specialty.label })}
                  >
                    <MoreHorizontal className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onSelect={() => {
                      setRenaming(specialty);
                      setRenameValue(specialty.label);
                    }}
                  >
                    {t('specialty.manage.rename')}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() =>
                      update.mutate(
                        { key: specialty.key, archived: !specialty.archived },
                        { onError: (error) => toast.error(errorMessage(error, t)) },
                      )
                    }
                  >
                    {specialty.archived
                      ? t('specialty.manage.restore')
                      : t('specialty.manage.archive')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={renaming !== null} onOpenChange={(open) => {
          if (open) return;
          setRenaming(null);
          update.reset();
        }}>
        <DialogContent>
          <form
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              event.stopPropagation();
              if (!renaming) return;
              update.mutate(
                { key: renaming.key, label: renameValue },
                { onSuccess: () => setRenaming(null) },
              );
            }}
          >
            <DialogHeader>
              <DialogTitle>{t('specialty.manage.rename')}</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-2">
              <Label htmlFor="specialty-rename">{t('specialty.manage.name')}</Label>
              <Input
                id="specialty-rename"
                maxLength={40}
                value={renameValue}
                aria-invalid={update.isError}
                onChange={(event) => {
                  setRenameValue(event.target.value);
                  if (update.isError) update.reset();
                }}
              />
              {update.isError && (
                <p role="alert" className="text-sm text-destructive">
                  {errorMessage(update.error, t)}
                </p>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setRenaming(null)}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={renameValue.trim().length < 2 || update.isPending}>
                {t('common.save')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * La lista de especialidades propias en un panel que se abre sobre el que esté
 * abierto (por ejemplo "Nueva tarea"): se agrega, renombra y archiva sin salir
 * de donde se estaba.
 */
export function SpecialtiesDrawer({
  projectId,
  specialties,
  open,
  onOpenChange,
}: {
  projectId: string;
  specialties: readonly ProjectCustomSpecialty[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={t('specialty.manage.title')}
      description={t('specialty.manage.hint')}
      size="sm"
    >
      <CustomSpecialtiesSection bare projectId={projectId} specialties={specialties} />
    </FormDrawer>
  );
}
