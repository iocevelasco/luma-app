import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  capabilitiesInProject,
  INVITABLE_PROJECT_ROLES,
  inviteProjectMemberSchema,
  type InvitableProjectRole,
  type InviteProjectMemberInput,
  type ProjectMemberSummary,
  type ProjectRole,
} from '@luma/shared';
import { Briefcase, Calculator, HardHat, Trash2, User, UserPlus } from 'lucide-react';
import type { ComponentType } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
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
import { Can } from '@/components/permissions/can';
import { FormDrawer } from '@/components/common/form-drawer';
import {
  ActivationLinkDialog,
  type ActivationLink,
} from '@/components/organization/activation-link-dialog';
import { PageLayout } from '@/components/layout/page-layout';
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
import {
  useInviteProjectMember,
  useProject,
  useRemoveProjectMember,
  useUpdateProjectMemberRole,
} from '@/hooks/projects/use-project-queries';
import { RowCard, RowCardBody, RowCardEnd, RowCardLead, RowCardList } from '@/components/common/row-card-list';
import { cn } from '@/lib/utils';

/** Un ícono por rol: la fila se escanea por forma antes que por texto. */
const ROLE_ICON: Record<ProjectRole, ComponentType<{ className?: string }>> = {
  gerente: Briefcase,
  supervisor: HardHat,
  contador: Calculator,
  cliente: User,
};

/**
 * Qué puede hacer cada rol, en una línea y en la pantalla donde se elige.
 *
 * La lista sale de la grilla de `@luma/shared`, no de un texto escrito acá:
 * si mañana el supervisor gana o pierde un permiso, esta pantalla lo refleja
 * sola. Un resumen en prosa se desactualiza en la primera semana y termina
 * prometiendo accesos que ya no existen.
 */
function RoleCapabilityCount({ role }: { role: ProjectRole }) {
  const { t } = useTranslation();
  // `providersVisibleToClient: true` para contar el techo de lo que ese rol
  // puede llegar a hacer, no lo que puede en esta obra puntual.
  const count = capabilitiesInProject(role, { providersVisibleToClient: true }).length;

  return <span className="text-2xs text-muted-foreground">{t('project.team.capabilityCount', { count })}</span>;
}

function InviteMemberDrawer({ projectId }: { projectId: string }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const inviteMember = useInviteProjectMember(projectId);
  // Si invitar creó la cuenta y el mail no salió, el enlace se pasa a mano.
  const [activationLink, setActivationLink] = useState<ActivationLink | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<InviteProjectMemberInput>({ resolver: zodResolver(inviteProjectMemberSchema) });

  return (
    <>
      <ActivationLinkDialog link={activationLink} onClose={() => setActivationLink(null)} />
      <Button onClick={() => setOpen(true)}>
        <UserPlus className="size-4" />
        {t('project.team.invite')}
      </Button>

      <FormDrawer
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) reset();
        }}
        title={t('project.team.inviteTitle')}
        description={t('project.team.inviteHint')}
        fieldCount={2}
        submitLabel={t('project.team.inviteSubmit')}
        isSubmitting={inviteMember.isPending}
        error={inviteMember.error}
        onSubmit={handleSubmit((values) =>
          inviteMember.mutate(values, {
            onSuccess: (data) => {
              reset();
              setOpen(false);
              if (data.activationUrl) {
                setActivationLink({ name: data.member.name, url: data.activationUrl });
              }
            },
          }),
        )}
      >
        <div className="flex flex-col gap-2">
          <Label htmlFor="member-email">{t('project.team.inviteEmail')}</Label>
          <Input aria-invalid={Boolean(errors.email)} id="member-email" type="email" autoComplete="email" {...register('email')} />
          {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium">{t('project.team.role')}</legend>
          {/*
            Tarjetas con la explicación al lado, no un desplegable: el rol
            decide qué ve y qué toca una persona, y un select con cuatro
            palabras sueltas esconde justo la diferencia que importa.
          */}
          <Controller
            control={control}
            name="role"
            render={({ field }) => (
              <div className="flex flex-col gap-2">
                {INVITABLE_PROJECT_ROLES.map((option) => {
                  const Icon = ROLE_ICON[option];
                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() => field.onChange(option)}
                      aria-pressed={field.value === option}
                      /*
                        El nombre accesible es sólo el rol, y la explicación va
                        como descripción. Sin esto, el lector de pantalla —y
                        cualquier selector por rol— anuncia el botón como
                        "Supervisor de obra Reporta avance... 14 permisos":
                        toda la tarjeta concatenada en una sola frase.
                      */
                      aria-labelledby={`role-${option}-name`}
                      aria-describedby={`role-${option}-hint`}
                      className={cn(
                        'flex items-start gap-3 rounded-md border p-3 text-left transition-colors',
                        field.value === option
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:bg-accent',
                      )}
                    >
                      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                      <span className="flex flex-col gap-0.5">
                        <span id={`role-${option}-name`} className="text-sm font-medium">
                          {t(`project.role.${option}`)}
                        </span>
                        <span
                          id={`role-${option}-hint`}
                          className="text-xs text-muted-foreground"
                        >
                          {t(`project.roleHint.${option}`)}
                        </span>
                        <RoleCapabilityCount role={option} />
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          />
          {errors.role && <p className="text-sm text-destructive">{errors.role.message}</p>}
        </fieldset>
      </FormDrawer>
    </>
  );
}

function RemoveMemberButton({
  projectId,
  member,
}: {
  projectId: string;
  member: ProjectMemberSummary;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const removeMember = useRemoveProjectMember(projectId);

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen(true)}
        aria-label={t('project.team.remove')}
      >
        <Trash2 className="size-4" />
      </Button>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('project.team.removeTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('project.team.removeDescription', { name: member.name })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => removeMember.mutate(member.id, { onSuccess: () => setOpen(false) })}
            >
              {t('project.team.removeConfirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function MemberRow({ projectId, member }: { projectId: string; member: ProjectMemberSummary }) {
  const { t } = useTranslation();
  const updateRole = useUpdateProjectMemberRole(projectId);
  const Icon = ROLE_ICON[member.role];

  // El gerente sale de `Project.createdBy` y no tiene fila de membresía: no
  // hay rol que cambiarle ni acceso que revocarle. Una obra sin dueño no
  // existe.
  const isManager = member.role === 'gerente';

  return (
    <RowCard>
      <RowCardLead tone={isManager ? 'brand' : 'neutral'}>
        <Icon aria-hidden className="size-5" />
      </RowCardLead>
      <RowCardBody
        title={<p className="truncate">{member.name}</p>}
        meta={<p className="truncate">{member.email}</p>}
      />

      <RowCardEnd>
        {isManager ? (
          <Badge variant="solid">{t('project.role.gerente')}</Badge>
        ) : (
          <>
            <Select
              value={member.role}
              onValueChange={(role) =>
                updateRole.mutate({ membershipId: member.id, role: role as InvitableProjectRole })
              }
              disabled={updateRole.isPending}
            >
              <SelectTrigger className="w-40" aria-label={t('project.team.role')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INVITABLE_PROJECT_ROLES.map((option) => (
                  <SelectItem key={option} value={option}>
                    {t(`project.role.${option}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <RemoveMemberButton projectId={projectId} member={member} />
          </>
        )}
      </RowCardEnd>
    </RowCard>
  );
}

/**
 * Equipo y accesos de la obra.
 *
 * Vive en su propia pantalla y no en una tarjeta del dashboard porque dar y
 * sacar accesos es una tarea con su propio momento: se entra a hacerla, no se
 * tropieza con ella mientras se mira cómo viene la obra.
 */
export function ProjectTeamPage() {
  const { t } = useTranslation();
  const { projectId } = useParams<{ projectId: string }>();
  const { data, isLoading, isError } = useProject(projectId);

  if (isError) return <PageLayout isError />;
  if (isLoading || !data) return <PageLayout isLoading />;

  return (
    <PageLayout
      /*
        `hide` y no `disable`: para un supervisor o un contador, invitar
        gente no es parte de su flujo — un botón apagado ahí sugiere que le
        falta un permiso que debería tener.
      */
      action={
        <Can I="project.invite">
          <InviteMemberDrawer projectId={projectId!} />
        </Can>
      }
    >

      {/* Nunca está vacía: el gerente siempre viene en la lista. */}
      <RowCardList>
        {data.members.map((member) => (
          <MemberRow key={member.id} projectId={projectId!} member={member} />
        ))}
      </RowCardList>

      <p className="text-xs text-muted-foreground">{t('project.team.activationHint')}</p>
    </PageLayout>
  );
}

export default ProjectTeamPage;
