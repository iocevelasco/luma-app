import { useState } from 'react';
import { Building2, UserMinus, UserX } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { FormDrawer } from '@/components/common/form-drawer';
import { DirectoryPickerDialog } from '@/components/directory/directory-picker-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  useAddCrewMemberToProject,
  useCrewDirectory,
  useCrewMembers,
  useDeactivateCrewMember,
  useRemoveCrewMemberFromProject,
} from '@/hooks/crew/use-crew-queries';
import { errorMessage } from '@/lib/error-message';

/**
 * Personal fijo de obra: el que está toda la ejecución, a diferencia del
 * proveedor que entra y sale. Es la lista de quién está en ESTA obra y lo que
 * se hace con cada uno: sumar de la Empresa, sacar de la obra, dar de baja.
 *
 * El alta ya no vive acá: va por `AddCrewDrawer`, que busca en la Empresa
 * antes de crear para no duplicar a nadie. El formulario inline que había
 * creaba sin mirar.
 */
export function CrewRosterDialog({
  projectId,
  canManage,
  open,
  onOpenChange,
}: {
  projectId: string;
  /**
   * Administrar el roster: sacar y dar de baja son `crew.manage`. Traer de la
   * Empresa también queda del gerente acá; el supervisor suma gente por el
   * alta (`AddCrewDrawer`), que ya busca en la Empresa antes de crear.
   */
  canManage: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const { data } = useCrewMembers(open ? projectId : undefined);
  const deactivateMember = useDeactivateCrewMember(projectId);
  const removeMember = useRemoveCrewMemberFromProject(projectId);
  const addMember = useAddCrewMemberToProject(projectId);
  const [pickerOpen, setPickerOpen] = useState(false);
  const { data: directoryData, isLoading: directoryLoading } = useCrewDirectory(
    projectId,
    open && pickerOpen,
  );

  const crewMembers = data?.crewMembers ?? [];

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={t('crew.list.title')}
      size="md"
    >
        <div className="flex flex-col gap-4">
          {crewMembers.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('crew.list.empty')}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {crewMembers.map((member) => (
                <li
                  key={member.id}
                  className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{member.name}</span>
                      {member.kind === 'equipo' && (
                        <Badge variant="secondary">{t('crew.kind.equipo')}</Badge>
                      )}
                      {member.isLead && <Badge>{t('crew.list.lead')}</Badge>}
                    </div>
                    {member.specialty && (
                      <p className="text-xs text-muted-foreground">
                        {t(`provider.specialty.${member.specialty}`)}
                      </p>
                    )}
                  </div>
                  {canManage && (
                    // De la libreta de la Empresa: se saca DE ESTA OBRA. La baja
                    // es de la Empresa y alcanza a todas las obras.
                    member.scope === 'project' ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="icon-sm"
                        onClick={() => deactivateMember.mutate(member.id)}
                        aria-label={t('crew.list.deactivate')}
                      >
                        <UserX className="size-4" />
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        size="icon-sm"
                        onClick={() => removeMember.mutate(member.id)}
                        aria-label={t('directory.removeFromProject')}
                      >
                        <UserMinus className="size-4" />
                      </Button>
                    )
                  )}
                </li>
              ))}
            </ul>
          )}

          {canManage && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="self-start"
              onClick={() => setPickerOpen(true)}
            >
              <Building2 className="size-4" />
              {t('directory.addFromCompany')}
            </Button>
          )}

        </div>
      <DirectoryPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        title={t('directory.pickCrewTitle')}
        items={(directoryData?.crewMembers ?? []).map((member) => ({
          id: member.id,
          name: member.name,
          detail: member.specialty ? t(`provider.specialty.${member.specialty}`) : undefined,
        }))}
        isLoading={directoryLoading}
        pendingId={addMember.isPending ? (addMember.variables?.crewMemberId ?? null) : null}
        emptyLabel={t('directory.pickEmptyCrew')}
        // Una lista sin formulario: la falla va por toast, no hay banner.
        onAdd={(id) =>
          addMember.mutate(
            { crewMemberId: id },
            { onError: (error) => toast.error(errorMessage(error, t)) },
          )
        }
      />
    </FormDrawer>
  );
}

export default CrewRosterDialog;
