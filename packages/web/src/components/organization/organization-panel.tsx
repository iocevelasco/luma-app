import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { inviteMemberSchema, type InviteMemberInput } from '@luma/shared';
import { Building2, Check, Pencil, UserPlus, X } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
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
  useRenameOrganization,
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
 * Roster de la Empresa: quién trabaja conmigo. **No da acceso a ninguna obra**
 * — eso se invita obra por obra con su rol, desde la ficha de cada una (ver
 * `ProjectMembership`). Antes sí lo daba, cuando el Asistente de Obra era un
 * rol de Empresa y entraba a todas; la matriz de roles pidió lo contrario.
 *
 * Sigue existiendo porque es el camino de alta: crea la cuenta y manda el mail
 * de activación de alguien que todavía no está en Luma.
 */
export function TeamSection() {
  const { t } = useTranslation();
  const { data } = useOrganizationMembers();
  const members = data?.members ?? [];

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
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
            <li key={member.id} className="flex items-center justify-between text-sm">
              <span>{member.name}</span>
              <span className="text-muted-foreground">{member.email}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

