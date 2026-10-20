import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  COMPANY_STAFF_ROLES,
  inviteMemberSchema,
  updateOrganizationMemberSchema,
  updateOrganizationSchema,
  type InviteMemberInput,
  type OrganizationMemberSummary,
  type UpdateOrganizationInput,
  type UpdateOrganizationMemberInput,
} from '@luma/shared';
import { Building2, Check, KeyRound, MailPlus, Pencil, UserMinus, X } from 'lucide-react';
import { Controller, useForm, type Control, type FieldValues, type Path } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FormShell } from '@/components/common/form-shell';
import {
  ActivationLinkDialog,
  type ActivationLink,
} from '@/components/organization/activation-link-dialog';
import { GrantAccessDialog } from '@/components/organization/grant-access-dialog';
import { PersonRow } from '@/components/organization/person-row';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
  useInviteMember,
  useMyOrganization,
  useOrganizationMembers,
  useRemoveOrganizationMember,
  useRenameOrganization,
  useResendMemberInvitation,
  useUpdateOrganization,
  useUpdateOrganizationMember,
} from '@/hooks/organizations/use-organization-queries';

/**
 * Las dos superficies de Empresa: su nombre y su roster. Viven acá y no en la
 * home porque tienen pantalla propia (`pages/company.tsx`) — ver el comentario
 * de ahí sobre por qué se mudaron.
 */

/** Nombre de la empresa, editable inline. Única superficie de UI de Empresa en v1. */
export function OrganizationName() {
  const { data } = useMyOrganization();
  const rename = useRenameOrganization();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');

  if (!data) return <div className="h-8" />;

  if (editing) {
    return (
      <form
        className="flex items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          const trimmed = name.trim();
          if (!trimmed) return;
          rename.mutate(trimmed, { onSuccess: () => setEditing(false) });
        }}
      >
        <Input
          autoFocus
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="h-8 max-w-56"
        />
        <Button type="submit" size="icon-sm" variant="ghost" disabled={rename.isPending}>
          <Check className="size-4" />
        </Button>
        <Button type="button" size="icon-sm" variant="ghost" onClick={() => setEditing(false)}>
          <X className="size-4" />
        </Button>
      </form>
    );
  }

  return (
    <button
      type="button"
      className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      onClick={() => {
        setName(data.organization.name);
        setEditing(true);
      }}
    >
      <Building2 className="size-4" />
      {data.organization.name}
      <Pencil className="size-3" />
    </button>
  );
}

/**
 * Selector de la función de una persona en la Empresa. Es una etiqueta, no un
 * permiso — el hint lo dice en el lugar donde se elige, porque "supervisor"
 * suena a que ya puede entrar a las obras.
 */
function StaffRoleField<T extends FieldValues>({
  control,
  name,
  id,
  error,
}: {
  control: Control<T>;
  name: Path<T>;
  id: string;
  error?: string;
}) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{t('team.staffRole')}</Label>
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <Select value={field.value ?? ''} onValueChange={field.onChange}>
            <SelectTrigger id={id} aria-invalid={Boolean(error)} className="w-full">
              <SelectValue placeholder={t('team.staffRolePlaceholder')} />
            </SelectTrigger>
            <SelectContent>
              {COMPANY_STAFF_ROLES.map((option) => (
                <SelectItem key={option} value={option}>
                  {t(`project.role.${option}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      />
      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : (
        <p className="text-2xs text-muted-foreground">{t('team.staffRoleHint')}</p>
      )}
    </div>
  );
}

/**
 * Sumar a alguien del personal administrativo. Controlado desde afuera porque
 * el botón de "sumar" es uno solo para todo el equipo (administración y obra) y
 * vive en `TeamDirectory`.
 */
export function InviteMemberDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const setOpen = onOpenChange;
  const inviteMember = useInviteMember();
  // El mail de activación no salió: el enlace queda a la vista para pasarlo a mano.
  const [activationLink, setActivationLink] = useState<ActivationLink | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<InviteMemberInput>({
    resolver: zodResolver(inviteMemberSchema),
    defaultValues: { name: '', email: '', phone: '' },
  });

  return (
    <>
      <ActivationLinkDialog link={activationLink} onClose={() => setActivationLink(null)} />
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) reset();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('team.inviteTitle')}</DialogTitle>
          </DialogHeader>
          <FormShell
            variant="embedded"
            className="gap-4"
            onSubmit={handleSubmit((values) =>
              inviteMember.mutate(values, {
                onSuccess: (data) => {
                  setOpen(false);
                  reset();
                  if (data.activationUrl) {
                    setActivationLink({ name: values.name, url: data.activationUrl });
                  }
                },
              }),
            )}
            submitLabel={t('team.inviteSubmit')}
            onCancel={() => setOpen(false)}
            isSubmitting={inviteMember.isPending}
            error={inviteMember.error}
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor="member-new-name">{t('team.name')}</Label>
              <Input aria-invalid={Boolean(errors.name)} id="member-new-name" autoComplete="off" {...register('name')} />
              {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="member-email">{t('team.inviteEmail')}</Label>
              <Input aria-invalid={Boolean(errors.email)} id="member-email" type="email" autoComplete="email" {...register('email')} />
              {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="member-new-phone">{t('team.phone')}</Label>
              <Input aria-invalid={Boolean(errors.phone)} id="member-new-phone" type="tel" autoComplete="off" {...register('phone')} />
              {errors.phone && <p className="text-sm text-destructive">{errors.phone.message}</p>}
            </div>
            <StaffRoleField
              control={control}
              name="staffRole"
              id="member-new-role"
              error={errors.staffRole ? t('team.staffRoleRequired') : undefined}
            />
          </FormShell>
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * Datos de la Empresa: cómo se llama y cómo contactarla. Todo editable acá —
 * antes sólo el nombre, inline.
 */
export function OrganizationProfile() {
  const { t } = useTranslation();
  const { data } = useMyOrganization();
  const update = useUpdateOrganization();

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<UpdateOrganizationInput>({
    resolver: zodResolver(updateOrganizationSchema),
    values: data
      ? {
          name: data.organization.name,
          contactEmail: data.organization.contactEmail ?? '',
          contactPhone: data.organization.contactPhone ?? '',
        }
      : undefined,
  });

  if (!data) return <div className="h-32" />;

  return (
    <div className="flex flex-col overflow-hidden rounded-lg border border-border bg-card shadow-surface">
      <div className="p-4 pb-0">
        <h3 className="text-sm font-medium">{t('company.profileTitle')}</h3>
        <p className="text-2xs text-muted-foreground">{t('company.profileHint')}</p>
      </div>
      <FormShell
        variant="embedded"
        className="gap-0"
        onSubmit={handleSubmit((values) => update.mutate(values))}
        submitLabel={t('common.save')}
        isSubmitting={update.isPending}
        isDirty={isDirty}
        error={update.error}
      >
        <div className="flex flex-col gap-4 p-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="org-name">{t('company.name')}</Label>
            <Input aria-invalid={Boolean(errors.name)} id="org-name" {...register('name')} />
            {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="org-email">{t('company.contactEmail')}</Label>
              <Input aria-invalid={Boolean(errors.contactEmail)} id="org-email" type="email" {...register('contactEmail')} />
              {errors.contactEmail && (
                <p className="text-sm text-destructive">{errors.contactEmail.message}</p>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="org-phone">{t('company.contactPhone')}</Label>
              <Input id="org-phone" type="tel" {...register('contactPhone')} />
            </div>
          </div>
        </div>
      </FormShell>
    </div>
  );
}

function EditMemberDialog({
  member,
  onClose,
}: {
  member: OrganizationMemberSummary;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const update = useUpdateOrganizationMember();

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<UpdateOrganizationMemberInput>({
    resolver: zodResolver(updateOrganizationMemberSchema),
    defaultValues: { name: member.name, staffRole: member.staffRole, phone: member.phone ?? '' },
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('team.editTitle')}</DialogTitle>
        </DialogHeader>
        <FormShell
          variant="embedded"
          className="gap-4"
          onSubmit={handleSubmit((values) =>
            update.mutate({ memberId: member.id, payload: values }, { onSuccess: onClose }),
          )}
          submitLabel={t('common.save')}
          onCancel={onClose}
          isSubmitting={update.isPending}
          error={update.error}
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="member-name">{t('team.name')}</Label>
            <Input aria-invalid={Boolean(errors.name)} id="member-name" {...register('name')} />
            {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
          </div>
          <StaffRoleField control={control} name="staffRole" id="member-role" />
          <div className="flex flex-col gap-2">
            <Label htmlFor="member-phone">{t('team.phone')}</Label>
            <Input aria-invalid={Boolean(errors.phone)} id="member-phone" type="tel" autoComplete="off" {...register('phone')} />
            {errors.phone && <p className="text-sm text-destructive">{errors.phone.message}</p>}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="member-email-ro">{t('team.inviteEmail')}</Label>
            <Input id="member-email-ro" value={member.email} readOnly disabled />
            <p className="text-2xs text-muted-foreground">{t('team.emailReadOnly')}</p>
          </div>
        </FormShell>
      </DialogContent>
    </Dialog>
  );
}

/**
 * El personal administrativo de la Empresa (gerente, supervisor, contador).
 * **Pertenecer no da acceso a ninguna obra** — el acceso se da obra por obra con su rol (ver
 * `ProjectMembership`), y desde acá se hace con "Dar acceso a obras", que
 * invita a la persona a las obras que se tilden. Antes pertenecer sí lo daba,
 * cuando el Asistente de Obra era un rol de Empresa y entraba a todas; la
 * matriz de roles pidió lo contrario.
 *
 * Es el camino de alta (crea la cuenta y manda el mail de activación de alguien
 * que todavía no está en Luma) y también donde se corrige o se da de baja.
 */
export function StaffList() {
  const { t } = useTranslation();
  const { data } = useOrganizationMembers();
  const members = data?.members ?? [];
  const remove = useRemoveOrganizationMember();
  const resend = useResendMemberInvitation();
  const [editing, setEditing] = useState<OrganizationMemberSummary | null>(null);
  const [granting, setGranting] = useState<OrganizationMemberSummary | null>(null);
  const [removing, setRemoving] = useState<OrganizationMemberSummary | null>(null);
  const [activationLink, setActivationLink] = useState<ActivationLink | null>(null);

  return (
    <>
      <ActivationLinkDialog link={activationLink} onClose={() => setActivationLink(null)} />
      {members.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('team.empty')}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {members.map((member) => (
            <PersonRow
              key={member.id}
              name={member.name}
              badges={
                <>
                  {member.staffRole && (
                    <Badge>{t(`project.role.${member.staffRole}`)}</Badge>
                  )}
                  {member.pending && <Badge variant="warning" icon>
                      {t('team.pending')}
                    </Badge>}
                </>
              }
              details={[
                member.email,
                member.phone ? (
                  <a href={`tel:${member.phone}`} className="hover:text-foreground">
                    {member.phone}
                  </a>
                ) : null,
              ]}
              actions={
                <>
                  {member.pending && (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      disabled={resend.isPending}
                      onClick={() =>
                        resend.mutate(member.id, {
                          onSuccess: (data) => {
                            if (data.activationUrl) {
                              setActivationLink({ name: member.name, url: data.activationUrl });
                            }
                          },
                        })
                      }
                      aria-label={t('team.resend')}
                    >
                      <MailPlus className="size-4" />
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    onClick={() => setGranting(member)}
                    aria-label={t('team.grantAccess')}
                  >
                    <KeyRound className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    onClick={() => setEditing(member)}
                    aria-label={t('team.editTitle')}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    onClick={() => setRemoving(member)}
                    aria-label={t('team.removeFromCompany')}
                  >
                    <UserMinus className="size-4" />
                  </Button>
                </>
              }
            />
          ))}
        </ul>
      )}

      {editing && <EditMemberDialog member={editing} onClose={() => setEditing(null)} />}
      {granting && <GrantAccessDialog member={granting} onClose={() => setGranting(null)} />}

      <AlertDialog open={Boolean(removing)} onOpenChange={(open) => !open && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('team.removeCompanyTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('team.removeCompanyBody', { name: removing?.name ?? '' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (removing) remove.mutate(removing.id);
                setRemoving(null);
              }}
            >
              {t('team.removeFromCompany')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
