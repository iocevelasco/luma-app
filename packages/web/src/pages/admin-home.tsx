import { useState } from 'react';
import { format } from 'date-fns';
import { Building2, Check, Pencil, Plus, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { EmptyState } from '@/components/common/empty-state';
import { fromDayKey } from '@/components/common/date-range-filter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useDateLocale } from '@/hooks/use-date-locale';
import { useMyOrganization, useRenameOrganization } from '@/hooks/organizations/use-organization-queries';
import { useProjects } from '@/hooks/projects/use-project-queries';
import { ROUTES, projectDetailPath } from '@/lib/routes';

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
                    to={projectDetailPath(project.id)}
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
