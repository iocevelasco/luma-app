import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  inviteMemberSchema,
  updateOrganizationMemberSchema,
  updateOrganizationSchema,
  type InviteMemberInput,
  type OrganizationMemberSummary,
  type UpdateOrganizationInput,
  type UpdateOrganizationMemberInput,
} from '@luma/shared';
import { Building2, Check, MailPlus, Pencil, UserMinus, UserPlus, X } from 'lucide-react';
import { useForm } from 'react-hook-form';
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

function InviteMemberDialog() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const inviteMember = useInviteMember();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<InviteMemberInput>({ resolver: zodResolver(inviteMemberSchema) });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <UserPlus className="size-4" />
          {t('team.invite')}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('team.inviteTitle')}</DialogTitle>
        </DialogHeader>
        <FormShell
          variant="embedded"
          className="gap-4"
          onSubmit={handleSubmit((values) =>
            inviteMember.mutate(values, {
              onSuccess: () => {
                setOpen(false);
                reset();
              },
            }),
          )}
          submitLabel={t('team.inviteSubmit')}
          onCancel={() => setOpen(false)}
          isSubmitting={inviteMember.isPending}
          error={inviteMember.error}
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="member-email">{t('team.inviteEmail')}</Label>
            <Input id="member-email" type="email" autoComplete="email" {...register('email')} />
            {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
          </div>
        </FormShell>
      </DialogContent>
    </Dialog>
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
            <Input id="org-name" {...register('name')} />
            {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="org-email">{t('company.contactEmail')}</Label>
              <Input id="org-email" type="email" {...register('contactEmail')} />
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
    formState: { errors },
  } = useForm<UpdateOrganizationMemberInput>({
    resolver: zodResolver(updateOrganizationMemberSchema),
    defaultValues: { name: member.name },
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
            <Input id="member-name" {...register('name')} />
            {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
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
 * Roster de la Empresa: quién trabaja conmigo. **No da acceso a ninguna obra**
 * — eso se invita obra por obra con su rol, desde la ficha de cada una (ver
 * `ProjectMembership`). Antes sí lo daba, cuando el Asistente de Obra era un
 * rol de Empresa y entraba a todas; la matriz de roles pidió lo contrario.
 *
 * Es el camino de alta (crea la cuenta y manda el mail de activación de alguien
 * que todavía no está en Luma) y también donde se corrige o se da de baja.
 */
export function TeamSection() {
  const { t } = useTranslation();
  const { data } = useOrganizationMembers();
  const members = data?.members ?? [];
  const remove = useRemoveOrganizationMember();
  const resend = useResendMemberInvitation();
  const [editing, setEditing] = useState<OrganizationMemberSummary | null>(null);
  const [removing, setRemoving] = useState<OrganizationMemberSummary | null>(null);

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 shadow-surface">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-medium">{t('team.title')}</h3>
          <p className="text-2xs text-muted-foreground">{t('team.hint')}</p>
        </div>
        <InviteMemberDialog />
      </div>
      {members.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('team.empty')}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {members.map((member) => (
            <li
              key={member.id}
              className="flex flex-wrap items-center justify-between gap-2 text-sm"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{member.name}</span>
                  {member.pending && <Badge variant="secondary">{t('team.pending')}</Badge>}
                </div>
                <span className="text-muted-foreground">{member.email}</span>
              </div>
              <div className="flex gap-2">
                {member.pending && (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    disabled={resend.isPending}
                    onClick={() => resend.mutate(member.id)}
                    aria-label={t('team.resend')}
                  >
                    <MailPlus className="size-4" />
                  </Button>
                )}
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
              </div>
            </li>
          ))}
        </ul>
      )}

      {editing && <EditMemberDialog member={editing} onClose={() => setEditing(null)} />}

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
    </div>
  );
}
