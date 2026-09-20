import { useMemo } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  createBudgetSchema,
  roundMoney,
  type BudgetLine as BudgetLineDTO,
  type CreateBudgetInput,
} from '@luma/shared';
import { Plus, Trash2 } from 'lucide-react';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { EmptyState } from '@/components/common/empty-state';
import { ResponsiveTable, type ResponsiveColumn } from '@/components/common/responsive-table';
import { RouteError } from '@/components/routes/route-error';
import { RouteLoading } from '@/components/routes/route-loading';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useBudget, useCreateBudget } from '@/hooks/budget/use-budget-queries';
import { useProject } from '@/hooks/projects/use-project-queries';
import { formatMoney } from '@/lib/format-money';
import { BudgetImportForm } from './budget-import-form';

/**
 * Sólo la parte del schema que llena la persona: `totalAmount` no es un campo
 * del form, se calcula sumando los ítems (ver `computedTotal` abajo) — pedirlo
 * a mano es la forma más rápida de que ese número deje de coincidir con la
 * suma real.
 */
const budgetFormSchema = createBudgetSchema.omit({ totalAmount: true });
type BudgetFormValues = Omit<CreateBudgetInput, 'totalAmount'>;

const EMPTY_LINE = { chapter: '', name: '', unit: '', total: 0 };

function BudgetLineRow({
  index,
  register,
  errors,
  onRemove,
  canRemove,
}: {
  index: number;
  register: ReturnType<typeof useForm<BudgetFormValues>>['register'];
  errors: ReturnType<typeof useForm<BudgetFormValues>>['formState']['errors'];
  onRemove: () => void;
  canRemove: boolean;
}) {
  const { t } = useTranslation();
  const lineErrors = errors.lines?.[index];
  const fieldId = (field: string) => `budget-line-${index}-${field}`;

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border p-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <Label htmlFor={fieldId('chapter')}>{t('budget.fields.chapter')}</Label>
          <Input id={fieldId('chapter')} {...register(`lines.${index}.chapter` as const)} />
          {lineErrors?.chapter && (
            <p className="text-sm text-destructive">{lineErrors.chapter.message}</p>
          )}
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor={fieldId('name')}>{t('budget.fields.name')}</Label>
          <Input id={fieldId('name')} {...register(`lines.${index}.name` as const)} />
          {lineErrors?.name && <p className="text-sm text-destructive">{lineErrors.name.message}</p>}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <div className="flex flex-col gap-1">
          <Label htmlFor={fieldId('unit')}>{t('budget.fields.unit')}</Label>
          <Input id={fieldId('unit')} {...register(`lines.${index}.unit` as const)} />
          {lineErrors?.unit && <p className="text-sm text-destructive">{lineErrors.unit.message}</p>}
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor={fieldId('quantity')}>{t('budget.fields.quantity')}</Label>
          <Input
            id={fieldId('quantity')}
            inputMode="decimal"
            {...register(`lines.${index}.quantity` as const, {
              setValueAs: (value) => (value === '' ? undefined : Number(value)),
            })}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor={fieldId('unitCost')}>{t('budget.fields.unitCost')}</Label>
          <Input
            id={fieldId('unitCost')}
            inputMode="decimal"
            {...register(`lines.${index}.unitCost` as const, {
              setValueAs: (value) => (value === '' ? undefined : Number(value)),
            })}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor={fieldId('total')}>{t('budget.fields.total')}</Label>
          <Input
            id={fieldId('total')}
            inputMode="decimal"
            {...register(`lines.${index}.total` as const, { valueAsNumber: true })}
          />
          {lineErrors?.total && <p className="text-sm text-destructive">{lineErrors.total.message}</p>}
        </div>
      </div>

      <div className="flex justify-end">
        <Button type="button" variant="ghost" size="sm" onClick={onRemove} disabled={!canRemove}>
          <Trash2 className="size-4" />
          {t('budget.form.removeItem')}
        </Button>
      </div>
    </div>
  );
}

function NewBudgetForm({ projectId, currency }: { projectId: string; currency: string }) {
  const { t, i18n } = useTranslation();
  const createBudget = useCreateBudget(projectId);

  const {
    register,
    handleSubmit,
    control,
    getValues,
    formState: { errors },
  } = useForm<BudgetFormValues>({
    resolver: zodResolver(budgetFormSchema),
    defaultValues: { contingencyAmount: 0, lines: [EMPTY_LINE] },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'lines' });
  const watchedLines = useWatch({ control, name: 'lines' });

  const computedTotal = useMemo(
    () =>
      roundMoney((watchedLines ?? []).reduce((sum, line) => sum + (Number(line?.total) || 0), 0)),
    [watchedLines],
  );

  function handleAddItem() {
    const lastChapter = getValues(`lines.${fields.length - 1}.chapter`);
    append({ ...EMPTY_LINE, chapter: lastChapter ?? '' });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('budget.form.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="flex flex-col gap-4"
          onSubmit={handleSubmit((values) =>
            createBudget.mutate({ ...values, totalAmount: computedTotal }),
          )}
        >
          <div className="flex flex-col gap-3">
            {fields.map((field, index) => (
              <BudgetLineRow
                key={field.id}
                index={index}
                register={register}
                errors={errors}
                onRemove={() => remove(index)}
                canRemove={fields.length > 1}
              />
            ))}
          </div>

          {errors.lines?.message && (
            <p className="text-sm text-destructive">{errors.lines.message}</p>
          )}

          <Button type="button" variant="outline" size="sm" onClick={handleAddItem}>
            <Plus className="size-4" />
            {t('budget.form.addItem')}
          </Button>

          <div className="flex flex-col gap-2 border-t border-border pt-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex flex-col gap-1 sm:max-w-xs">
              <Label htmlFor="contingencyAmount">{t('budget.fields.contingencyAmount')}</Label>
              <Input
                id="contingencyAmount"
                inputMode="decimal"
                {...register('contingencyAmount', { valueAsNumber: true })}
              />
              {errors.contingencyAmount && (
                <p className="text-sm text-destructive">{errors.contingencyAmount.message}</p>
              )}
            </div>

            <div className="text-right">
              <p className="text-xs text-muted-foreground">{t('budget.form.computedTotal')}</p>
              <p className="text-lg font-semibold">{formatMoney(computedTotal, currency, i18n.language)}</p>
            </div>
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={createBudget.isPending}>
              {createBudget.isPending ? t('common.loading') : t('budget.form.submit')}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function buildColumns(
  t: ReturnType<typeof useTranslation>['t'],
  currency: string,
  locale: string,
): ResponsiveColumn<BudgetLineDTO>[] {
  return [
    { id: 'name', header: t('budget.fields.name'), cell: (line) => line.name, mobile: 'primary' },
    { id: 'unit', header: t('budget.fields.unit'), cell: (line) => line.unit, mobile: 'field' },
    {
      id: 'quantity',
      header: t('budget.fields.quantity'),
      cell: (line) => line.quantity ?? '—',
      mobile: 'field',
    },
    {
      id: 'unitCost',
      header: t('budget.fields.unitCost'),
      cell: (line) => (line.unitCost !== undefined ? formatMoney(line.unitCost, currency, locale) : '—'),
      mobile: 'field',
    },
    {
      id: 'total',
      header: t('budget.fields.total'),
      cell: (line) => formatMoney(line.total, currency, locale),
      mobile: 'secondary',
    },
  ];
}

function groupByChapter(lines: BudgetLineDTO[]): [string, BudgetLineDTO[]][] {
  const groups = new Map<string, BudgetLineDTO[]>();
  for (const line of lines) {
    if (!groups.has(line.chapter)) groups.set(line.chapter, []);
    groups.get(line.chapter)!.push(line);
  }
  return [...groups.entries()];
}

export function ProjectBudgetPage() {
  const { t, i18n } = useTranslation();
  const { projectId } = useParams<{ projectId: string }>();
  const { data: projectData, isLoading: isProjectLoading, isError: isProjectError } =
    useProject(projectId);
  const { data, isLoading, isError } = useBudget(projectId);

  if (isError || isProjectError) return <RouteError />;
  if (isLoading || isProjectLoading || !data || !projectData) return <RouteLoading />;

  if (!data.budget) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-8 p-3 md:p-4">
        <EmptyState
          variant="money"
          title={t('budget.empty.title')}
          description={t('budget.empty.body')}
        />
        {/* Importar es la vía principal según el documento funcional — "condiciona
            la adopción" —, la carga manual queda como alternativa explícita. */}
        <Tabs defaultValue="import">
          <TabsList>
            <TabsTrigger value="import">{t('budget.import.tab')}</TabsTrigger>
            <TabsTrigger value="manual">{t('budget.form.tab')}</TabsTrigger>
          </TabsList>
          <TabsContent value="import">
            <Card>
              <CardHeader>
                <CardTitle>{t('budget.import.title')}</CardTitle>
              </CardHeader>
              <CardContent>
                <BudgetImportForm projectId={projectId!} currency={projectData.project.currency} />
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="manual">
            <NewBudgetForm projectId={projectId!} currency={projectData.project.currency} />
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  const { budget } = data;
  const columns = buildColumns(t, budget.currency, i18n.language);
  const chapters = groupByChapter(budget.lines);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-3 md:p-4">
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">
              {t('budget.summary.total')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">
              {formatMoney(budget.totalAmount, budget.currency, i18n.language)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">
              {t('budget.summary.contingency')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">
              {formatMoney(budget.contingencyAmount, budget.currency, i18n.language)}
            </p>
          </CardContent>
        </Card>
      </div>

      <p className="text-xs text-muted-foreground">
        {budget.importMode === 'import'
          ? t('budget.summary.sourceImport', { fileName: budget.sourceFileName ?? '' })
          : t('budget.summary.sourceManual')}
      </p>

      <div className="flex flex-col gap-6">
        {chapters.map(([chapter, lines]) => (
          <div key={chapter} className="flex flex-col gap-2">
            <h3 className="text-sm font-medium">
              {chapter} ({lines.length})
            </h3>
            <ResponsiveTable columns={columns} rows={lines} getRowKey={(line) => line.id} />
          </div>
        ))}
      </div>
    </div>
  );
}

export default ProjectBudgetPage;
