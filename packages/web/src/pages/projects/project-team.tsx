import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  capabilitiesInProject,
  countsTowardManagerLimit,
  INVITABLE_PROJECT_ROLES,
  inviteProjectMemberSchema,
  projectManagerSlots,
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
import {
  ListSection,
  ListSections,
  RowCard,
  RowCardBody,
  RowCardEnd,
  RowCardLead,
  RowCardList,
} from '@/components/common/row-card-list';
import { cn } from '@/lib/utils';

type ManagerSlots = ReturnType<typeof projectManagerSlots>;

/**
 * "3 de 5" con cinco puntos: cuántos gerentes hay y cuántos caben. El tope
 * (`MAX_PROJECT_MANAGERS`) se ve antes de chocar con él, y al llegar se dice
 * "máximo" con todas las palabras: un punto lleno no es el único aviso.
 */
function ManagerSlotsMeter({ slots }: { slots: ManagerSlots }) {
  const { t } = useTranslation();

  return (
    <span className="flex items-center gap-2" data-testid="manager-slots">
      <span aria-hidden className="flex gap-1">
        {Array.from({ length: slots.max }, (_, index) => (
          <span
            key={index}
            className={cn('size-1.5 rounded-full', index < slots.count ? 'bg-primary' : 'bg-border')}
          />
        ))}
      </span>
      <span className={cn(slots.isFull && 'font-medium text-foreground')}>
        {t(slots.isFull ? 'project.team.managersAtMax' : 'project.team.managersCount', {
          count: slots.count,
          max: slots.max,
        })}
      </span>
    </span>
  );
}

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
  // Los flags en `true` para contar el techo de lo que ese rol puede llegar a
  // hacer, no lo que puede en esta obra puntual.
  const count = capabilitiesInProject(role, {
    providersVisibleToClient: true,
    purchasesVisibleToClient: true,
  }).length;

  return <span className="text-2xs text-muted-foreground">{t('project.team.capabilityCount', { count })}</span>;
}

function InviteMemberDrawer({ projectId, slots }: { projectId: string; slots: ManagerSlots }) {
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
                  // Un gerente más cuenta para el tope: sin lugar, la tarjeta se
                  // apaga y dice por qué. El servidor lo vuelve a chequear.
                  const counts = countsTowardManagerLimit(option);
                  const locked = counts && slots.isFull;
                  return (
                    <button
                      key={option}
                      type="button"
                      disabled={locked}
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
                        locked && 'cursor-not-allowed opacity-60',
                        field.value === option
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:bg-accent',
                        locked && 'hover:bg-transparent',
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
                        {counts && (
                          <span
                            className={cn(
                              'text-2xs',
                              locked ? 'font-medium text-foreground' : 'text-muted-foreground',
                            )}
                            data-testid="manager-slots-hint"
                          >
                            {locked
                              ? t('project.team.managersFull', { max: slots.max })
                              : t('project.team.managerSlotsLeft', {
                                  count: slots.remaining,
                                  max: slots.max,
                                })}
                          </span>
                        )}
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

function MemberRow({
  projectId,
  member,
  createdBy,
  slots,
}: {
  projectId: string;
  member: ProjectMemberSummary;
  /** Quién creó la obra: el único gerente sin fila de membresía. */
  createdBy: string;
  slots: ManagerSlots;
}) {
  const { t } = useTranslation();
  const updateRole = useUpdateProjectMemberRole(projectId);
  const Icon = ROLE_ICON[member.role];
  const isManager = countsTowardManagerLimit(member.role);

  // Línea 2: los datos en orden fijo. Quien ocupa un lugar sin poder usarlo
  // (invitación sin activar, cuenta dada de baja) lo dice acá: si no, "5 de 5"
  // con tres personas activas es un ticket de soporte.
  const meta = [
    member.email,
    member.userId === createdBy ? t('project.team.creatorNote') : null,
    member.pending ? t('project.team.pendingNote') : null,
    member.inactive ? t('project.team.inactiveNote') : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <RowCard>
      <RowCardLead tone={isManager ? 'brand' : 'neutral'}>
        <Icon aria-hidden className="size-5" />
      </RowCardLead>
      <RowCardBody
        title={<p className="truncate">{member.name}</p>}
        meta={<p className="truncate">{meta}</p>}
      />

      <RowCardEnd>
        {/* `manageable` lo resuelve el servidor: a quien creó la obra nadie lo toca,
            y a otro gerente sólo lo toca quien la creó. */}
        {member.manageable ? (
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
                  <SelectItem
                    key={option}
                    value={option}
                    // Subir a alguien a gerente sin lugar no es una opción.
                    disabled={countsTowardManagerLimit(option) && !isManager && slots.isFull}
                  >
                    {t(`project.role.${option}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <RemoveMemberButton projectId={projectId} member={member} />
          </>
        ) : (
          <Badge variant={isManager ? 'solid' : 'neutral'}>{t(`project.role.${member.role}`)}</Badge>
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

  const slots = projectManagerSlots(
    data.members.filter((member) => countsTowardManagerLimit(member.role)).length,
  );

  return (
    <PageLayout
      /*
        `hide` y no `disable`: para un supervisor o un contador, invitar
        gente no es parte de su flujo — un botón apagado ahí sugiere que le
        falta un permiso que debería tener.
      */
      action={
        <Can I="project.invite">
          <InviteMemberDrawer projectId={projectId!} slots={slots} />
        </Can>
      }
    >

      {/* Nunca está vacía: quien creó la obra siempre viene en la lista. Un
          grupo por rol; el de gerentes lleva el tope a la derecha. */}
      <ListSections>
        {INVITABLE_PROJECT_ROLES.map((role) => {
          const group = data.members.filter((member) => member.role === role);
          if (group.length === 0) return null;
          return (
            <ListSection
              key={role}
              label={t(`project.team.groups.${role}`)}
              meta={countsTowardManagerLimit(role) ? <ManagerSlotsMeter slots={slots} /> : group.length}
            >
              <RowCardList>
                {group.map((member) => (
                  <MemberRow
                    key={member.id}
                    projectId={projectId!}
                    member={member}
                    createdBy={data.project.createdBy}
                    slots={slots}
                  />
                ))}
              </RowCardList>
            </ListSection>
          );
        })}
      </ListSections>

      <p className="text-xs text-muted-foreground">{t('project.team.activationHint')}</p>
    </PageLayout>
  );
}

export default ProjectTeamPage;
