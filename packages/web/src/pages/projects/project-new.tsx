import { zodResolver } from '@hookform/resolvers/zod';
import { createProjectSchema, type CreateProjectInput } from '@luma/shared';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useCreateProject } from '@/hooks/projects/use-project-queries';
import { ROUTES } from '@/lib/routes';

/**
 * Monedas comunes de arranque, no un catálogo exhaustivo — fácil de sumar más
 * cuando haga falta. La validación de `currency` en el schema compartido es
 * un string libre a propósito: la UI cura la lista, el contrato no la fija.
 */
const CURRENCY_OPTIONS = ['ARS', 'USD', 'MXN', 'COP', 'CLP', 'PEN'];

const BUDGET_TYPES = ['cerrado', 'abierto', 'con_margen'] as const;

export function ProjectNewPage() {
  const { t } = useTranslation();
  const createProject = useCreateProject();

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<CreateProjectInput>({ resolver: zodResolver(createProjectSchema) });

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4 p-4 md:p-6">
      <Card>
        <CardHeader>
          <CardTitle>{t('project.new.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="flex flex-col gap-4"
            onSubmit={handleSubmit((values) => createProject.mutate(values))}
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor="name">{t('project.fields.name')}</Label>
              <Input id="name" {...register('name')} />
              {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="description">{t('project.fields.description')}</Label>
              <Textarea id="description" rows={3} {...register('description')} />
              {errors.description && (
                <p className="text-sm text-destructive">{errors.description.message}</p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="location">{t('project.fields.location')}</Label>
              <Input id="location" {...register('location')} />
              {errors.location && (
                <p className="text-sm text-destructive">{errors.location.message}</p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="size">{t('project.fields.size')}</Label>
              <Input id="size" {...register('size')} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="estimatedStartDate">{t('project.fields.startDate')}</Label>
                <Input id="estimatedStartDate" type="date" {...register('estimatedStartDate')} />
                {errors.estimatedStartDate && (
                  <p className="text-sm text-destructive">{errors.estimatedStartDate.message}</p>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="estimatedEndDate">{t('project.fields.endDate')}</Label>
                <Input id="estimatedEndDate" type="date" {...register('estimatedEndDate')} />
                {errors.estimatedEndDate && (
                  <p className="text-sm text-destructive">{errors.estimatedEndDate.message}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="currency">{t('project.fields.currency')}</Label>
                <Controller
                  control={control}
                  name="currency"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="currency">
                        <SelectValue placeholder={t('project.fields.currencyPlaceholder')} />
                      </SelectTrigger>
                      <SelectContent>
                        {CURRENCY_OPTIONS.map((currency) => (
                          <SelectItem key={currency} value={currency}>
                            {currency}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.currency && (
                  <p className="text-sm text-destructive">{errors.currency.message}</p>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="budgetType">{t('project.fields.budgetType')}</Label>
                <Controller
                  control={control}
                  name="budgetType"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="budgetType">
                        <SelectValue placeholder={t('project.fields.budgetTypePlaceholder')} />
                      </SelectTrigger>
                      <SelectContent>
                        {BUDGET_TYPES.map((type) => (
                          <SelectItem key={type} value={type}>
                            {t(`project.budgetType.${type}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.budgetType && (
                  <p className="text-sm text-destructive">{errors.budgetType.message}</p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2">
              <Button type="button" variant="ghost" asChild>
                <Link to={ROUTES.ADMIN}>{t('common.cancel')}</Link>
              </Button>
              <Button type="submit" disabled={createProject.isPending}>
                {createProject.isPending ? t('common.loading') : t('project.new.submit')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default ProjectNewPage;
