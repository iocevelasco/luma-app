import { useMemo, useState } from 'react';
import type { InvitableProjectRole, OrganizationMemberSummary } from '@luma/shared';
import { useTranslation } from 'react-i18next';
import { FormShell } from '@/components/common/form-shell';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useGrantProjectAccess, useProjects } from '@/hooks/projects/use-project-queries';

/**
 * Los roles que se dan acá. `cliente` queda afuera: quien paga no integra la
 * Empresa y se invita desde la obra. `gerente` tampoco existe como rol de
 * obra — se deriva de quién la creó.
 */
const GRANTABLE_ROLES: InvitableProjectRole[] = ['supervisor', 'contador'];

/**
 * Dar acceso a una persona del equipo a una o varias obras.
 *
 * La función que tiene en la Empresa es una etiqueta (ver `CompanyStaffRole`):
 * sólo precarga el rol, no lo decide. Si es "gerente" no se precarga nada,
 * porque en una obra no se puede ser gerente por invitación.
 */
export function GrantAccessDialog({
  member,
  onClose,
}: {
  member: OrganizationMemberSummary;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { data } = useProjects();
  const grant = useGrantProjectAccess();

  // Sólo las obras donde quien mira puede invitar: la API ya lo resolvió.
  const projects = useMemo(
    () => (data?.projects ?? []).filter((project) => project.capabilities.includes('project.invite')),
    [data],
  );

  const initialRole = GRANTABLE_ROLES.find((role) => role === member.staffRole);
  const [role, setRole] = useState<InvitableProjectRole | ''>(initialRole ?? '');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [submitted, setSubmitted] = useState(false);

  const toggle = (projectId: string, checked: boolean) =>
    setSelected((current) => {
      const next = new Set(current);
      if (checked) next.add(projectId);
      else next.delete(projectId);
      return next;
    });

  const failures = (grant.data ?? []).filter((result) => result.status === 'failed');
  const failureNames = failures
    .map((result) => projects.find((project) => project.id === result.projectId)?.name)
    .filter(Boolean)
    .join(', ');
  const failureError =
    failures.length > 0
      ? new Error(
          [t('team.grantFailed', { projects: failureNames }), failures[0]?.message]
            .filter(Boolean)
            .join(' '),
        )
      : undefined;

  const roleMissing = submitted && role === '';
  const noneSelected = submitted && selected.size === 0;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('team.grantTitle', { name: member.name })}</DialogTitle>
        </DialogHeader>
        <FormShell
          variant="embedded"
          className="gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            setSubmitted(true);
            if (role === '' || selected.size === 0) return;
            grant.mutate(
              { email: member.email, role, projectIds: [...selected] },
              {
                onSuccess: (results) => {
                  if (results.every((result) => result.status !== 'failed')) onClose();
                },
              },
            );
          }}
          submitLabel={t('team.grantSubmit')}
          onCancel={onClose}
          isSubmitting={grant.isPending}
          error={failureError}
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="grant-role">{t('team.grantRole')}</Label>
            <Select value={role} onValueChange={(next) => setRole(next as InvitableProjectRole)}>
              <SelectTrigger id="grant-role" aria-invalid={roleMissing} className="w-full">
                <SelectValue placeholder={t('team.staffRolePlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {GRANTABLE_ROLES.map((option) => (
                  <SelectItem key={option} value={option}>
                    {t(`project.role.${option}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {roleMissing && (
              <p className="text-sm text-destructive">{t('team.staffRoleRequired')}</p>
            )}
          </div>

          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium">{t('team.grantProjects')}</legend>
            {projects.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('team.grantNoProjects')}</p>
            ) : (
              <ul className="flex max-h-56 flex-col gap-2 overflow-y-auto">
                {projects.map((project) => (
                  <li key={project.id} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      id={`grant-project-${project.id}`}
                      checked={selected.has(project.id)}
                      onCheckedChange={(checked) => toggle(project.id, checked === true)}
                    />
                    <Label htmlFor={`grant-project-${project.id}`} className="font-normal">
                      {project.name}
                    </Label>
                  </li>
                ))}
              </ul>
            )}
            {noneSelected && (
              <p className="text-sm text-destructive">{t('team.grantNoneSelected')}</p>
            )}
          </fieldset>
        </FormShell>
      </DialogContent>
    </Dialog>
  );
}
