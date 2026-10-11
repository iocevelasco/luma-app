import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { format } from 'date-fns';
import { inviteMemberSchema, type InviteMemberInput } from '@luma/shared';
import { Building2, Check, Pencil, Plus, UserPlus, X } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { EmptyState } from '@/components/common/empty-state';
import { fromDayKey } from '@/components/common/date-range-filter';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useDateLocale } from '@/hooks/use-date-locale';
import {
  useInviteMember,
  useMyOrganization,
  useOrganizationMembers,
  useRenameOrganization,
} from '@/hooks/organizations/use-organization-queries';
import { useProjects } from '@/hooks/projects/use-project-queries';
import { ROUTES, projectActivitiesPath } from '@/lib/routes';

/** Nombre de la empresa, editable inline. Única superficie de UI de Empresa en v1. */
function OrganizationName() {
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
        <form
          className="flex flex-col gap-4"
          onSubmit={handleSubmit((values) =>
            inviteMember.mutate(values, {
              onSuccess: () => {
                setOpen(false);
                reset();
              },
            }),
          )}
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="member-email">{t('team.inviteEmail')}</Label>
            <Input id="member-email" type="email" autoComplete="email" {...register('email')} />
            {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={inviteMember.isPending}>
              {inviteMember.isPending ? t('common.loading') : t('team.inviteSubmit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Asistentes de Obra de mi Empresa: acceso operativo a todas mis obras, sin
 * presupuesto ni invitaciones. Vive acá (no en cada obra) porque es un rol de
 * Empresa, no de una obra puntual — ver `OrganizationMember`.
 */
function TeamSection() {
  const { t } = useTranslation();
  const { data } = useOrganizationMembers();
  const members = data?.members ?? [];

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-sm font-medium">{t('team.title')}</h3>
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

/**
 * Home del panel: listado de obras. Deja de ser el vacío fijo — es el lugar
 * donde iba "la primera pantalla real" del producto.
 */
export function AdminHomePage() {
  const { t } = useTranslation();
  const { data, isLoading } = useProjects();
  const dateLocale = useDateLocale();

  const projects = data?.projects ?? [];

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <OrganizationName />
        <Button asChild>
          <Link to={ROUTES.PROJECT_NEW}>
            <Plus className="size-4" />
            {t('project.list.new')}
          </Link>
        </Button>
      </div>

      <TeamSection />

      {!isLoading && projects.length === 0 && (
        <EmptyState
          variant="list"
          title={t('project.list.emptyTitle')}
          description={t('project.list.emptyBody')}
          action={
            <Button asChild>
              <Link to={ROUTES.PROJECT_NEW}>{t('project.list.emptyCta')}</Link>
            </Button>
          }
          replacesPrimaryAction
        />
      )}

      {projects.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('project.list.columns.name')}</TableHead>
              <TableHead>{t('project.list.columns.location')}</TableHead>
              <TableHead>{t('project.list.columns.dates')}</TableHead>
              <TableHead>{t('project.list.columns.budgetType')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {projects.map((project) => (
              <TableRow key={project.id}>
                <TableCell>
                  <Link
                    className="font-medium hover:underline"
                    to={projectActivitiesPath(project.id)}
                  >
                    {project.name}
                  </Link>
                </TableCell>
                <TableCell>{project.location}</TableCell>
                <TableCell>
                  {format(fromDayKey(project.estimatedStartDate), 'PP', { locale: dateLocale })}
                  {' – '}
                  {format(fromDayKey(project.estimatedEndDate), 'PP', { locale: dateLocale })}
                </TableCell>
                <TableCell>{t(`project.budgetType.${project.budgetType}`)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

export default AdminHomePage;
