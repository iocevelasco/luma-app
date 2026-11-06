import { useEffect, useMemo, useRef, useState } from 'react';
import { format } from 'date-fns';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  createExpenseSchema,
  EXPENSE_CATEGORIES,
  PAYMENT_METHOD_OPTIONS,
  DOCUMENT_MAX_BYTES,
  DOCUMENT_MIME_TYPES,
  type CreateExpenseInput,
  type Expense,
} from '@luma/shared';
import { Download, FileDown, Plus, Receipt, SearchX, Trash2, TrendingUp, Upload, Users, X } from 'lucide-react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Can } from '@/components/permissions/can';
import { EmptyState } from '@/components/common/empty-state';
import { ExpenseMaterials } from '@/components/finance/expense-materials';
import { FormDrawer } from '@/components/common/form-drawer';
import { fromDayKey, toDayKey } from '@/lib/day-key';
import { PageLayout } from '@/components/layout/page-layout';
import { MovementDetail, RowOpenButton } from '@/components/finance/movement-detail';
import { MovementFilterBar } from '@/components/finance/movement-filter-bar';
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
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ListSection,
  ListSections,
  RowCard,
  RowCardBody,
  RowCardDate,
  RowCardEnd,
  RowCardList,
} from '@/components/common/row-card-list';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAllActivities } from '@/hooks/activities/use-activity-queries';
import {
  useCreateExpense,
  useDeleteExpense,
  useExpenses,
  useFinanceSummary,
  usePayroll,
} from '@/hooks/finance/use-finance-queries';
import { useProject } from '@/hooks/projects/use-project-queries';
import { useProviders } from '@/hooks/providers/use-provider-queries';
import { useCompactToolbar } from '@/hooks/use-compact-toolbar';
import { useDateLocale } from '@/hooks/use-date-locale';
import { currencyChoices } from '@/lib/currencies';
import { downloadBlob } from '@/lib/download-blob';
import {
  countActiveExpenseFilters,
  EXPENSE_GROUP_BY,
  filterExpenses,
  groupExpenses,
  NO_EXPENSE_FILTERS,
  sumExpenses,
  type ExpenseFilters,
  type ExpenseGroup,
  type ExpenseGroupBy,
} from '@/lib/expenses-view';
import { formatMoney } from '@/lib/format-money';
import { cn, formatFileSize } from '@/lib/utils';

/** Primer y último día del mes en curso, para el rango por default de la nómina. */
function currentMonthRange() {
  const now = new Date();
  return {
    from: toDayKey(new Date(now.getFullYear(), now.getMonth(), 1)),
    to: toDayKey(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
  };
}

function NewExpenseDrawer({
  projectId,
  projectCurrency,
}: {
  projectId: string;
  projectCurrency: string;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [receipt, setReceipt] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const createExpense = useCreateExpense(projectId);
  const { data: activitiesData } = useAllActivities(projectId);
  const { data: providersData } = useProviders(projectId);

  const form = useForm<CreateExpenseInput>({
    resolver: zodResolver(createExpenseSchema),
    defaultValues: {
      currency: projectCurrency,
      exchangeRate: 1,
      spentOn: toDayKey(new Date()),
      category: 'material',
    },
  });

  const currency = form.watch('currency');
  const needsRate = Boolean(currency) && currency !== projectCurrency;

  function resetAll() {
    form.reset();
    setReceipt(null);
    setFileError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function handleFile(selected: File | null) {
    if (!selected) {
      setReceipt(null);
      setFileError(null);
      return;
    }
    // Se valida acá además de en la API: subir 20MB para que el servidor diga
    // que no es desperdiciar la conexión de alguien que está en la obra.
    if (!DOCUMENT_MIME_TYPES.includes(selected.type)) {
      setReceipt(null);
      setFileError(t('finance.errors.receiptType'));
      return;
    }
    if (selected.size > DOCUMENT_MAX_BYTES) {
      setReceipt(null);
      setFileError(t('finance.errors.receiptSize'));
      return;
    }
    setReceipt(selected);
    setFileError(null);
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="size-4" />
        {t('finance.expenses.new')}
      </Button>

      <FormDrawer
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) resetAll();
        }}
        title={t('finance.expenses.newTitle')}
        fieldCount={6}
        submitLabel={t('finance.expenses.newSubmit')}
        isSubmitting={createExpense.isPending}
        error={createExpense.error}
        onSubmit={form.handleSubmit((values) =>
          createExpense.mutate(
            { ...values, receipt },
            {
              onSuccess: () => {
                resetAll();
                setOpen(false);
              },
            },
          ),
        )}
      >
        <div className="flex flex-col gap-2">
          <Label htmlFor="expense-category">{t('finance.fields.category')}</Label>
          <Controller
            control={form.control}
            name="category"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="expense-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXPENSE_CATEGORIES.map((option) => (
                    <SelectItem key={option} value={option}>
                      {t(`finance.category.${option}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="expense-description">{t('finance.fields.description')}</Label>
          <Input aria-invalid={Boolean(form.formState.errors.description)} id="expense-description" {...form.register('description')} />
          {form.formState.errors.description && (
            <p className="text-sm text-destructive">
              {form.formState.errors.description.message}
            </p>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="expense-amount">{t('finance.fields.amount')}</Label>
            <Input
              aria-invalid={Boolean(form.formState.errors.amount)}
              id="expense-amount"
              inputMode="decimal"
              {...form.register('amount', { valueAsNumber: true })}
            />
            {form.formState.errors.amount && (
              <p className="text-sm text-destructive">{form.formState.errors.amount.message}</p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="expense-currency">{t('finance.fields.currency')}</Label>
            <Controller
              control={form.control}
              name="currency"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="expense-currency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {currencyChoices(projectCurrency, field.value).map((code) => (
                      <SelectItem key={code} value={code}>
                        {code}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
        </div>

        {/* La cotización sólo cuando hace falta: pedir un "1" en el caso normal
            es un campo que nadie entiende y que todos completan mal. */}
        {needsRate && (
          <div className="flex flex-col gap-2">
            <Label htmlFor="expense-rate">
              {t('finance.fields.exchangeRate', { from: currency, to: projectCurrency })}
            </Label>
            <Input
              id="expense-rate"
              inputMode="decimal"
              {...form.register('exchangeRate', { valueAsNumber: true })}
            />
            <p className="text-2xs text-muted-foreground">
              {t('finance.fields.exchangeRateHint')}
            </p>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <Label htmlFor="expense-date">{t('finance.fields.spentOn')}</Label>
          <Input id="expense-date" type="date" {...form.register('spentOn')} />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="expense-method">{t('finance.fields.methodOptional')}</Label>
          <Controller
            control={form.control}
            name="method"
            render={({ field }) => (
              <Select value={field.value ?? ''} onValueChange={field.onChange}>
                <SelectTrigger id="expense-method">
                  <SelectValue placeholder={t('finance.fields.methodPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHOD_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {t(`finance.method.${option}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="expense-provider">{t('finance.fields.provider')}</Label>
            <Controller
              control={form.control}
              name="providerId"
              render={({ field }) => (
                <Select value={field.value ?? ''} onValueChange={field.onChange}>
                  <SelectTrigger id="expense-provider">
                    <SelectValue placeholder={t('finance.fields.none')} />
                  </SelectTrigger>
                  <SelectContent>
                    {(providersData?.providers ?? []).map((provider) => (
                      <SelectItem key={provider.id} value={provider.id}>
                        {provider.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="expense-activity">{t('finance.fields.activity')}</Label>
            <Controller
              control={form.control}
              name="activityId"
              render={({ field }) => (
                <Select value={field.value ?? ''} onValueChange={field.onChange}>
                  <SelectTrigger id="expense-activity">
                    <SelectValue placeholder={t('finance.fields.none')} />
                  </SelectTrigger>
                  <SelectContent>
                    {(activitiesData?.activities ?? []).map((activity) => (
                      <SelectItem key={activity.id} value={activity.id}>
                        {activity.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-2">
          <Label htmlFor="expense-receipt">{t('finance.fields.receipt')}</Label>
          <input
            ref={fileInputRef}
            id="expense-receipt"
            type="file"
            accept={DOCUMENT_MIME_TYPES.join(',')}
            className="sr-only"
            onChange={(event) => handleFile(event.target.files?.[0] ?? null)}
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            className="w-full min-w-0 justify-start font-normal"
          >
            <Upload className="size-4" />
            <span className="min-w-0 truncate">{receipt ? receipt.name : t('finance.fields.receiptPlaceholder')}</span>
          </Button>
          {receipt && <p className="text-xs text-muted-foreground">{formatFileSize(receipt.size)}</p>}
          {fileError && <p className="text-sm text-destructive">{fileError}</p>}
        </div>
      </FormDrawer>
    </>
  );
}

/**
 * Nómina calculada desde la asistencia ya cargada. No se guarda: el gerente
 * la mira y, si está de acuerdo, carga el gasto. Guardar el cálculo haría que
 * cambie solo cuando alguien corrige una asistencia vieja.
 */
function PayrollCard({ projectId, currency }: { projectId: string; currency: string }) {
  const { t, i18n } = useTranslation();
  const [range, setRange] = useState(currentMonthRange);
  const { data } = usePayroll(projectId, range.from, range.to);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-3">
        <Users className="size-4 text-muted-foreground" />
        <CardTitle className="text-base">{t('finance.payroll.title')}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <Label htmlFor="payroll-from" className="text-xs">
              {t('finance.payroll.from')}
            </Label>
            <Input
              id="payroll-from"
              type="date"
              value={range.from}
              onChange={(event) => setRange((prev) => ({ ...prev, from: event.target.value }))}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="payroll-to" className="text-xs">
              {t('finance.payroll.to')}
            </Label>
            <Input
              id="payroll-to"
              type="date"
              value={range.to}
              onChange={(event) => setRange((prev) => ({ ...prev, to: event.target.value }))}
            />
          </div>
        </div>

        {!data || data.payroll.lines.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('finance.payroll.empty')}</p>
        ) : (
          <>
            <ul className="flex flex-col gap-2">
              {data.payroll.lines.map((line) => (
                <li key={line.crewMemberId} className="flex items-center justify-between text-sm">
                  <span className="min-w-0 truncate">
                    {line.name}
                    <span className="text-muted-foreground">
                      {' · '}
                      {t('finance.payroll.days', { count: line.daysPresent })}
                    </span>
                  </span>
                  <span className="shrink-0 tabular-nums">
                    {formatMoney(line.total, currency, i18n.language)}
                  </span>
                </li>
              ))}
            </ul>

            <div className="flex items-center justify-between border-t border-border pt-2 text-sm font-medium">
              <span>{t('finance.payroll.total')}</span>
              <span className="tabular-nums">
                {formatMoney(data.payroll.total, currency, i18n.language)}
              </span>
            </div>

            {/* Sin jornal no se inventa un cero: decirlo es la diferencia
                entre un total incompleto y un total que parece completo. */}
            {data.payroll.missingRateCount > 0 && (
              <p className="text-xs text-warning">
                {t('finance.payroll.missingRate', { count: data.payroll.missingRateCount })}
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export function ProjectExpensesPage() {
  const { t, i18n } = useTranslation();
  const { projectId } = useParams<{ projectId: string }>();
  const dateLocale = useDateLocale();
  const { data: projectData } = useProject(projectId);
  const { data, isLoading, isError } = useExpenses(projectId);
  const { data: summaryData } = useFinanceSummary(projectId);
  const deleteExpense = useDeleteExpense(projectId!);
  const [deleting, setDeleting] = useState<Expense | null>(null);
  const [detail, setDetail] = useState<Expense | null>(null);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const compact = useCompactToolbar();
  const hasExpenses = (data?.expenses.length ?? 0) > 0;

  // `jspdf` pesa: se baja apenas hay algo que descargar y no al apretar el botón.
  useEffect(() => {
    if (!hasExpenses) return;
    void import('@/lib/expenses-pdf');
    void import('jspdf');
    void import('jspdf-autotable');
  }, [hasExpenses]);

  const [filters, setFilters] = useState<ExpenseFilters>(NO_EXPENSE_FILTERS);
  const [groupBy, setGroupBy] = useState<ExpenseGroupBy>('category');
  const activeFilters = countActiveExpenseFilters(filters);

  // Lo visible: filtrado y agrupado en el cliente, sobre la lista que ya llegó.
  const visible = useMemo(() => filterExpenses(data?.expenses ?? [], filters), [data, filters]);
  const groups = useMemo(() => groupExpenses(visible, groupBy), [visible, groupBy]);

  if (isError) return <PageLayout isError />;
  if (isLoading || !data || !projectData) return <PageLayout isLoading />;

  const currency = projectData.project.currency;
  const summary = summaryData?.summary;

  async function handleDownloadPdf() {
    if (generatingPdf || visible.length === 0) return;
    setGeneratingPdf(true);
    try {
      const { buildExpensesPdf, expensesFileName } = await import('@/lib/expenses-pdf');
      const now = new Date();
      // Lo que la pantalla muestra, en su mismo orden.
      const expenses = groups.flatMap((group) => group.expenses);
      const blob = await buildExpensesPdf({
        projectName: projectData?.project.name ?? '',
        expenses,
        total: sumExpenses(expenses),
        labels: {
          title: t('finance.expenses.pdf.title'),
          filtered: activeFilters > 0 ? t('finance.expenses.pdf.filtered') : null,
          summary: `${t('finance.expenses.pdf.summary', { count: expenses.length })} · ${format(now, 'PPPP', { locale: dateLocale })}`,
          columns: {
            date: t('finance.expenses.pdf.columnDate'),
            description: t('finance.fields.description'),
            category: t('finance.fields.category'),
            detail: t('finance.expenses.pdf.columnDetail'),
            amount: t('finance.expenses.pdf.columnAmount'),
          },
          total: t('finance.expenses.pdf.total'),
          generated: t('finance.expenses.pdf.generated', { date: format(now, 'Pp', { locale: dateLocale }) }),
          page: (page, total) => t('finance.expenses.pdf.page', { page, total }),
          category: (category) => t(`finance.category.${category}`),
          method: (method) => t(`finance.method.${method}`),
          day: (dayKey) => format(fromDayKey(dayKey), 'P', { locale: dateLocale }),
          money: (amount) => formatMoney(amount, currency, i18n.language),
        },
      });
      downloadBlob(blob, expensesFileName(projectData?.project.name ?? '', now));
      toast.success(t('finance.expenses.pdf.downloaded'));
    } catch {
      toast.error(t('finance.expenses.pdf.error'));
    } finally {
      setGeneratingPdf(false);
    }
  }

  const pdfButton = (
    <Button
      type="button"
      variant="outline"
      className="max-sm:min-h-11"
      disabled={generatingPdf || visible.length === 0}
      aria-busy={generatingPdf}
      onClick={() => void handleDownloadPdf()}
    >
      {generatingPdf ? <Spinner className="size-4" /> : <FileDown className="size-4" />}
      {generatingPdf ? t('finance.expenses.pdf.generating') : t('finance.expenses.pdf.button')}
    </Button>
  );

  const groupLabel = (group: ExpenseGroup) => {
    if (group.name === null) return t(`finance.expenses.group.none.${groupBy}`);
    if (groupBy === 'category') return t(`finance.category.${group.name}`);
    if (groupBy === 'month') return format(fromDayKey(`${group.key}-01`), 'LLLL yyyy', { locale: dateLocale });
    if (groupBy === 'day') return format(fromDayKey(group.key), 'PPPP', { locale: dateLocale });
    return group.name;
  };

  return (
    <PageLayout
      toolbar={
        hasExpenses ? (
          <MovementFilterBar
            search={filters.search}
            onSearchChange={(search) => setFilters((prev) => ({ ...prev, search }))}
            kind={{
              value: filters.category,
              onChange: (category) => setFilters((prev) => ({ ...prev, category })),
              options: EXPENSE_CATEGORIES.map((value) => ({ value, label: t(`finance.category.${value}`) })),
              allLabel: t('finance.expenses.filters.allCategories'),
              ariaLabel: t('finance.expenses.filters.category'),
            }}
            from={filters.from}
            to={filters.to}
            onFromChange={(from) => setFilters((prev) => ({ ...prev, from }))}
            onToChange={(to) => setFilters((prev) => ({ ...prev, to }))}
            groupBy={{
              value: groupBy,
              onChange: setGroupBy,
              options: EXPENSE_GROUP_BY.map((value) => ({ value, label: t(`finance.expenses.groupBy.${value}`) })),
              ariaLabel: t('finance.expenses.groupBy.label'),
            }}
            activeCount={activeFilters}
            onClear={() => setFilters(NO_EXPENSE_FILTERS)}
            compact={compact}
            actions={pdfButton}
            labels={{
              search: t('finance.expenses.filters.search'),
              from: t('finance.expenses.filters.from'),
              to: t('finance.expenses.filters.to'),
              clear: t('finance.expenses.filters.clear'),
              button: t('finance.filters.button'),
              done: t('finance.filters.done'),
              actions: t('finance.filters.actions'),
            }}
          />
        ) : undefined
      }
      // En el modo compacto la descarga vive en el panel de filtros.
      secondaryActions={hasExpenses && !compact ? pdfButton : undefined}
      action={
        <Can I="expense.write">
          <NewExpenseDrawer projectId={projectId!} projectCurrency={currency} />
        </Can>
      }
    >
      {summary && (
        <Card>
          <CardHeader className="flex flex-row items-center gap-3">
            <TrendingUp className="size-4 text-muted-foreground" />
            <CardTitle className="text-base">{t('finance.result.title')}</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-4 text-sm [grid-template-columns:repeat(auto-fit,minmax(11rem,1fr))]">
              <div>
                <dt className="text-muted-foreground">{t('finance.result.paid')}</dt>
                <dd className="break-words text-lg font-semibold tabular-nums">
                  {formatMoney(summary.paidTotal, currency, i18n.language)}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t('finance.result.spent')}</dt>
                <dd className="break-words text-lg font-semibold tabular-nums">
                  {formatMoney(summary.expenseTotal, currency, i18n.language)}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t('finance.result.committed')}</dt>
                <dd className="break-words text-lg font-semibold tabular-nums">
                  {formatMoney(summary.committedTotal, currency, i18n.language)}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t('finance.result.margin')}</dt>
                {/* La utilidad. El cliente nunca llega a esta pantalla: la ruta
                    va con `expense.read`, que su rol no tiene. */}
                <dd
                  className={cn(
                    'break-words text-lg font-semibold tabular-nums',
                    summary.marginTotal < 0 && 'text-destructive',
                  )}
                >
                  {formatMoney(summary.marginTotal, currency, i18n.language)}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      )}

      <PayrollCard projectId={projectId!} currency={currency} />

      {data.expenses.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title={t('finance.expenses.emptyTitle')}
          description={t('finance.expenses.emptyDescription')}
        />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title={t('finance.expenses.filters.emptyTitle')}
          description={t('finance.expenses.filters.emptyDescription')}
          action={
            <Button type="button" variant="outline" onClick={() => setFilters(NO_EXPENSE_FILTERS)}>
              <X className="size-4" />
              {t('finance.expenses.filters.clear')}
            </Button>
          }
        />
      ) : (
        <ListSections>
          {groups.map((group) => (
            <ListSection
              key={group.key}
              label={groupLabel(group)}
              meta={
                <>
                  {activeFilters > 0 || groupBy !== 'category' ? (
                    <span>{t('finance.expenses.pdf.summary', { count: group.expenses.length })}</span>
                  ) : null}
                  <span className="tabular-nums">{formatMoney(group.total, currency, i18n.language)}</span>
                </>
              }
            >
              <RowCardList>
                {group.expenses.map((expense) => {
                  // La fila no repite lo que ya dice el rótulo del grupo.
                  const detail = [
                    groupBy !== 'category' && t(`finance.category.${expense.category}`),
                    expense.method && t(`finance.method.${expense.method}`),
                    groupBy !== 'provider' && expense.providerName,
                    groupBy !== 'activity' && expense.activityName,
                  ].filter(Boolean);
                  return (
                    <RowCard key={expense.id} className="relative">
                      {/* La fecha es el bloque de la izquierda: la línea 2 ya no la repite. */}
                      <RowCardDate date={fromDayKey(expense.spentOn)} locale={dateLocale} />
                      <RowCardBody
                        title={
                          <RowOpenButton onClick={() => setDetail(expense)}>{expense.description}</RowOpenButton>
                        }
                        meta={
                          (detail.length > 0 || expense.materials) && (
                            <p>
                              {detail.join(' · ')}
                              {expense.materials && (
                                <>
                                  {detail.length > 0 && ' · '}
                                  <span className="relative z-10">
                                    <ExpenseMaterials projectId={projectId!} materials={expense.materials} />
                                  </span>
                                </>
                              )}
                            </p>
                          )
                        }
                      >
                        {expense.currency !== currency && (
                          <Badge className="mt-1 w-fit">
                            {expense.amount} {expense.currency}
                          </Badge>
                        )}
                      </RowCardBody>

                      <RowCardEnd>
                        <span className="text-sm tabular-nums">
                          {formatMoney(expense.amountInProjectCurrency, currency, i18n.language)}
                        </span>
                        {expense.receipt?.url && (
                          <Button
                            variant="ghost"
                            size="icon"
                            asChild
                            className="relative z-10"
                            aria-label={t('finance.expenses.openReceipt')}
                          >
                            <a href={expense.receipt.url} target="_blank" rel="noopener noreferrer">
                              <Download className="size-4" />
                            </a>
                          </Button>
                        )}
                        <Can I="expense.write">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="relative z-10"
                            onClick={() => setDeleting(expense)}
                            aria-label={t('finance.expenses.delete')}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </Can>
                      </RowCardEnd>
                    </RowCard>
                  );
                })}
              </RowCardList>
            </ListSection>
          ))}
        </ListSections>
      )}

      {detail && (
        <MovementDetail
          open
          onOpenChange={(open) => !open && setDetail(null)}
          title={detail.description}
          caption={format(fromDayKey(detail.spentOn), 'PPPP', { locale: dateLocale })}
          amount={formatMoney(detail.amountInProjectCurrency, currency, i18n.language)}
          fields={[
            {
              label: t('finance.detail.originalAmount'),
              value:
                detail.currency !== currency
                  ? `${formatMoney(detail.amount, detail.currency, i18n.language)} · ${t('finance.detail.rate', { rate: detail.exchangeRate })}`
                  : undefined,
            },
            { label: t('finance.fields.category'), value: t(`finance.category.${detail.category}`) },
            { label: t('finance.fields.methodOptional'), value: detail.method && t(`finance.method.${detail.method}`) },
            { label: t('finance.fields.provider'), value: detail.providerName },
            { label: t('finance.fields.activity'), value: detail.activityName },
            {
              label: t('finance.expenses.materialsTitle'),
              value: detail.materials && (
                <ul className="list-disc pl-4">
                  {detail.materials.map((material) => (
                    <li key={material.id}>{material.name}</li>
                  ))}
                </ul>
              ),
            },
            { label: t('finance.detail.notes'), value: detail.notes },
            {
              label: t('finance.fields.receipt'),
              value: detail.receipt?.url ? (
                <a
                  href={detail.receipt.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 underline underline-offset-2 max-sm:min-h-11"
                >
                  <Download aria-hidden className="size-4" />
                  <span className="min-w-0 truncate">{detail.receipt.fileName}</span>
                  <span className="text-xs text-muted-foreground">{formatFileSize(detail.receipt.sizeBytes)}</span>
                </a>
              ) : (
                detail.receipt?.fileName
              ),
            },
            { label: t('finance.detail.registeredBy'), value: detail.registeredByName },
            {
              label: t('finance.detail.registeredAt'),
              value: format(new Date(detail.createdAt), 'Pp', { locale: dateLocale }),
            },
          ]}
        />
      )}

      <AlertDialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('finance.expenses.deleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting &&
                t('finance.expenses.deleteBody', {
                  description: deleting.description,
                  amount: formatMoney(deleting.amountInProjectCurrency, currency, i18n.language),
                })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className={buttonVariants({ variant: 'destructive' })}
              onClick={() => {
                if (deleting) deleteExpense.mutate(deleting.id);
                setDeleting(null);
              }}
            >
              {t('finance.expenses.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageLayout>
  );
}

export default ProjectExpensesPage;
