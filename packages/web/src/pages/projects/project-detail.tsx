import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { format } from 'date-fns';
import { inviteClientSchema, type InviteClientInput } from '@luma/shared';
import { UserPlus } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { fromDayKey } from '@/components/common/date-range-filter';
import { Badge } from '@/components/ui/badge';
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
import { RouteError } from '@/components/routes/route-error';
import { RouteLoading } from '@/components/routes/route-loading';
import { useDateLocale } from '@/hooks/use-date-locale';
import { useInviteClient, useProject } from '@/hooks/projects/use-project-queries';

function InviteClientDialog({ projectId }: { projectId: string }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const inviteClient = useInviteClient(projectId);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<InviteClientInput>({ resolver: zodResolver(inviteClientSchema) });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <UserPlus className="size-4" />
          {t('project.detail.invite')}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('project.detail.inviteTitle')}</DialogTitle>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={handleSubmit((values) =>
            inviteClient.mutate(values, {
              onSuccess: () => {
                setOpen(false);
                reset();
              },
            }),
          )}
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="client-email">{t('project.detail.inviteEmail')}</Label>
            <Input id="client-email" type="email" autoComplete="email" {...register('email')} />
            {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={inviteClient.isPending}>
              {inviteClient.isPending ? t('common.loading') : t('project.detail.inviteSubmit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ProjectDetailPage() {
  const { t } = useTranslation();
  const { projectId } = useParams<{ projectId: string }>();
  const { data, isLoading, isError } = useProject(projectId);
  const dateLocale = useDateLocale();

  if (isError) return <RouteError />;
  if (isLoading || !data) return <RouteLoading />;

  const { project, clients } = data;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8 p-3 md:p-4">
      <div className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl">{project.name}</h2>
            <p className="text-sm text-muted-foreground">{project.location}</p>
          </div>
          <Badge variant="secondary">{t(`project.budgetType.${project.budgetType}`)}</Badge>
        </div>

        <p className="text-sm">{project.description}</p>

        <dl className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-muted-foreground">{t('project.fields.startDate')}</dt>
            <dd>{format(fromDayKey(project.estimatedStartDate), 'PP', { locale: dateLocale })}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t('project.fields.endDate')}</dt>
            <dd>{format(fromDayKey(project.estimatedEndDate), 'PP', { locale: dateLocale })}</dd>
          </div>
          {project.size && (
            <div>
              <dt className="text-muted-foreground">{t('project.fields.size')}</dt>
              <dd>{project.size}</dd>
            </div>
          )}
          <div>
            <dt className="text-muted-foreground">{t('project.fields.currency')}</dt>
            <dd>{project.currency}</dd>
          </div>
        </dl>
      </div>

      <div className="flex flex-col gap-3 border-t border-border pt-6">
        <div className="flex items-center justify-between gap-4">
          <h3 className="text-sm font-medium">{t('project.detail.clients')}</h3>
          {project.isOwner && <InviteClientDialog projectId={project.id} />}
        </div>
        {clients.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('project.detail.noClients')}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {clients.map((client) => (
              <li key={client.id} className="flex items-center justify-between text-sm">
                <span>{client.name}</span>
                <span className="text-muted-foreground">{client.email}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default ProjectDetailPage;
