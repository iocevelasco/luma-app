import { useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  createPaymentSchema,
  createPaymentScheduleItemSchema,
  PAYMENT_METHOD_OPTIONS,
  PAYMENT_METHODS,
  type CreatePaymentInput,
  type CreatePaymentScheduleItemInput,
  type Payment,
  type PaymentScheduleItem,
  type PaymentScheduleStatus,
} from '@luma/shared';
import { format } from 'date-fns';
import { Check, Clock, Plus, SearchX, Trash2, Wallet, X, type LucideIcon } from 'lucide-react';
import { Controller, useForm } from 'react-hook-form';
import type { FieldErrors, FieldValues, Path, UseFormRegister } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { toast } from '@/lib/toast';
import { Can } from '@/components/permissions/can';
import { EmptyState } from '@/components/common/empty-state';
import { FormDrawer } from '@/components/common/form-drawer';
import { MovementDetail, RowOpenButton } from '@/components/finance/movement-detail';
import { MovementExport } from '@/components/finance/movement-export';
import { MovementFilterBar } from '@/components/finance/movement-filter-bar';
import { fromDayKey, toDayKey } from '@/lib/day-key';
import { PageLayout } from '@/components/layout/page-layout';
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
import { Badge, type BadgeVariant } from '@/components/ui/badge';
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
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  useCreatePayment,
  useCreateScheduleItem,
  useDeletePayment,
  useDeleteScheduleItem,
  usePaymentSchedule,
  usePayments,
} from '@/hooks/finance/use-finance-queries';
import { useProject } from '@/hooks/projects/use-project-queries';
import { useCompactToolbar } from '@/hooks/use-compact-toolbar';
import { useDateLocale } from '@/hooks/use-date-locale';
import { downloadBlob } from '@/lib/download-blob';
import { FINANCE_LIST_LIMIT } from '@/lib/finance-limits';
import { formatMoney } from '@/lib/format-money';
import {
  countActivePaymentFilters,
  filterPayments,
  groupPayments,
  NO_PAYMENT_FILTERS,
  PAYMENT_GROUP_BY,
  sumPayments,
  type PaymentFilters,
  type PaymentGroup,
  type PaymentGroupBy,
} from '@/lib/payments-view';
import { cn } from '@/lib/utils';
import { numberField } from '@/lib/form-fields';
import { sortPaymentMethods } from '@/lib/payment-methods';

/**
 * `destructive` es peligro, no marca — ver DESIGN.md. Una cuota vencida es lo
 * único acá que pide una acción urgente.
 */
const STATUS_TAG: Record<PaymentScheduleStatus, { variant: BadgeVariant; icon: LucideIcon }> = {
  pendiente: { variant: 'neutral', icon: Clock },
  parcial: { variant: 'warning', icon: Clock },
  cobrado: { variant: 'success', icon: Check },
  vencido: { variant: 'danger', icon: X },
};

/**
 * Los campos de moneda y cotización, compartidos por cobros y cuotas.
 *
 * La cotización sólo se pide cuando la moneda del movimiento no es la de la
 * obra: pedir un "1" en el caso normal es un campo que nadie entiende y que
 * todos completan mal.
 *
 * Genérico sobre el formulario que lo usa porque los dos drawers tienen shapes
 * distintos y los dos traen estos tres campos. Los `as Path<T>` son el precio
 * de eso: TypeScript no puede probar que `T` los tiene, pero el constraint de
 * `MoneyFormValues` sí lo garantiza en la práctica.
 */
interface MoneyFormValues extends FieldValues {
  amount: number;
  currency: string;
  exchangeRate: number;
}

function MoneyFields<T extends MoneyFormValues>({
  register,
  currency,
  projectCurrency,
  prefix,
  errors,
}: {
  register: UseFormRegister<T>;
  currency?: string;
  projectCurrency: string;
  prefix: string;
  errors: FieldErrors<T>;
}) {
  const { t } = useTranslation();
  const needsRate = Boolean(currency) && currency !== projectCurrency;

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${prefix}-amount`}>{t('finance.fields.amount')}</Label>
          <Input
            aria-invalid={Boolean(errors.amount)}
            id={`${prefix}-amount`}
            inputMode="decimal"
            {...register('amount' as Path<T>, numberField)}
          />
          {errors.amount && (
            <p className="text-sm text-destructive">{String(errors.amount.message)}</p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor={`${prefix}-currency`}>{t('finance.fields.currency')}</Label>
          <Input
            aria-invalid={Boolean(errors.currency)}
            id={`${prefix}-currency`}
            maxLength={3}
            placeholder={projectCurrency}
            className="uppercase"
            {...register('currency' as Path<T>)}
          />
          {errors.currency && (
            <p className="text-sm text-destructive">{String(errors.currency.message)}</p>
          )}
        </div>
      </div>

      {needsRate && (
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${prefix}-rate`}>
            {t('finance.fields.exchangeRate', { from: currency, to: projectCurrency })}
          </Label>
          <Input
            aria-invalid={Boolean(errors.exchangeRate)}
            id={`${prefix}-rate`}
            inputMode="decimal"
            {...register('exchangeRate' as Path<T>, numberField)}
          />
          <p className="text-2xs text-muted-foreground">{t('finance.fields.exchangeRateHint')}</p>
          {errors.exchangeRate && (
            <p className="text-sm text-destructive">{String(errors.exchangeRate.message)}</p>
          )}
        </div>
      )}
    </>
  );
}

/**
 * El alta de una cuota. El estado de abierto vive en la pantalla y no acá: el
 * botón que lo abre puede estar dentro del panel de filtros del celular, que se
 * desmonta al cerrarse y se llevaría el formulario con él.
 */
function NewScheduleItemDrawer({
  projectId,
  projectCurrency,
  open,
  onOpenChange,
}: {
  projectId: string;
  projectCurrency: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const setOpen = onOpenChange;
  const createItem = useCreateScheduleItem(projectId);

  const form = useForm<CreatePaymentScheduleItemInput>({
    resolver: zodResolver(createPaymentScheduleItemSchema),
    defaultValues: { currency: projectCurrency, exchangeRate: 1, dueOn: toDayKey(new Date()) },
  });

  return (
    <>
      <FormDrawer
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) form.reset();
        }}
        title={t('finance.schedule.newTitle')}
        fieldCount={4}
        submitLabel={t('finance.schedule.newSubmit')}
        isSubmitting={createItem.isPending}
        error={createItem.error}
        onSubmit={form.handleSubmit((values) =>
          createItem.mutate(values, {
            onSuccess: () => {
              form.reset();
              setOpen(false);
            },
          }),
        )}
      >
        <div className="flex flex-col gap-2">
          <Label htmlFor="schedule-concept">{t('finance.fields.concept')}</Label>
          <Input
            aria-invalid={Boolean(form.formState.errors.concept)}
            id="schedule-concept"
            placeholder={t('finance.fields.conceptPlaceholder')}
            {...form.register('concept')}
          />
          {form.formState.errors.concept && (
            <p className="text-sm text-destructive">{form.formState.errors.concept.message}</p>
          )}
        </div>

        <MoneyFields
          register={form.register}
          currency={form.watch('currency')}
          projectCurrency={projectCurrency}
          prefix="schedule"
          errors={form.formState.errors}
        />

        <div className="flex flex-col gap-2">
          <Label htmlFor="schedule-due">{t('finance.fields.dueOn')}</Label>
          <Input aria-invalid={Boolean(form.formState.errors.dueOn)} id="schedule-due" type="date" {...form.register('dueOn')} />
          {form.formState.errors.dueOn && (
            <p className="text-sm text-destructive">{form.formState.errors.dueOn.message}</p>
          )}
        </div>
      </FormDrawer>
    </>
  );
}

function NewPaymentDrawer({
  projectId,
  projectCurrency,
  items,
}: {
  projectId: string;
  projectCurrency: string;
  items: PaymentScheduleItem[];
}) {
  const { t, i18n } = useTranslation();
  const sortedMethodOptions = useMemo(
    () => sortPaymentMethods(PAYMENT_METHOD_OPTIONS, (method) => t(`finance.method.${method}`), i18n.language),
    [t, i18n.language],
  );
  const [open, setOpen] = useState(false);
  const createPayment = useCreatePayment(projectId);

  const form = useForm<CreatePaymentInput>({
    resolver: zodResolver(createPaymentSchema),
    defaultValues: {
      currency: projectCurrency,
      exchangeRate: 1,
      paidOn: toDayKey(new Date()),
    },
  });

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="size-4" />
        {t('finance.payments.new')}
      </Button>

      <FormDrawer
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) form.reset();
        }}
        title={t('finance.payments.newTitle')}
        fieldCount={5}
        submitLabel={t('finance.payments.newSubmit')}
        isSubmitting={createPayment.isPending}
        error={createPayment.error}
        onSubmit={form.handleSubmit((values) =>
          createPayment.mutate(values, {
            onSuccess: () => {
              form.reset();
              setOpen(false);
            },
          }),
        )}
      >
        <MoneyFields
          register={form.register}
          currency={form.watch('currency')}
          projectCurrency={projectCurrency}
          prefix="payment"
          errors={form.formState.errors}
        />

        <div className="flex flex-col gap-2">
          <Label htmlFor="payment-date">{t('finance.fields.paidOn')}</Label>
          <Input id="payment-date" type="date" {...form.register('paidOn')} />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="payment-method">{t('finance.fields.method')}</Label>
          <Controller
            control={form.control}
            name="method"
            render={({ field }) => (
              <Select value={field.value ?? ''} onValueChange={field.onChange}>
                <SelectTrigger id="payment-method" aria-invalid={Boolean(form.formState.errors.method)}>
                  <SelectValue placeholder={t('finance.fields.methodChoose')} />
                </SelectTrigger>
                <SelectContent>
                  {sortedMethodOptions.map((option) => (
                    <SelectItem key={option} value={option}>
                      {t(`finance.method.${option}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {form.formState.errors.method && (
            <p className="text-sm text-destructive">{form.formState.errors.method.message}</p>
          )}
        </div>

        {/* Imputar a una cuota es opcional: un cobro a cuenta es normal al
            principio de una obra, antes de acordar el cronograma. */}
        <div className="flex flex-col gap-2">
          <Label htmlFor="payment-item">{t('finance.fields.scheduleItem')}</Label>
          <Controller
            control={form.control}
            name="scheduleItemId"
            render={({ field }) => (
              <Select value={field.value ?? ''} onValueChange={field.onChange}>
                <SelectTrigger id="payment-item">
                  <SelectValue placeholder={t('finance.fields.scheduleItemPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {items.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.concept}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="payment-reference">{t('finance.fields.reference')}</Label>
          <Input id="payment-reference" {...form.register('reference')} />
        </div>
      </FormDrawer>
    </>
  );
}

/** Sobre qué cuota o cobro actúa un diálogo o el panel de detalle. */
type PaymentsTarget =
  | { kind: 'item'; item: PaymentScheduleItem }
  | { kind: 'payment'; payment: Payment };

export function ProjectPaymentsPage() {
  const { t, i18n } = useTranslation();
  const { projectId } = useParams<{ projectId: string }>();
  const dateLocale = useDateLocale();
  const { data: projectData } = useProject(projectId);
  const { data, isLoading, isError } = usePaymentSchedule(projectId);
  const { data: paymentsData } = usePayments(projectId);
  const deleteItem = useDeleteScheduleItem(projectId!);
  const deletePayment = useDeletePayment(projectId!);
  // Un solo diálogo para las dos bajas de la pantalla. El cobro pesa más: no
  // se edita, así que borrarlo es la única forma de corregirlo.
  const [deleting, setDeleting] = useState<PaymentsTarget | null>(null);

  // `detail` se conserva al cerrar: el panel sale con su animación y devuelve el foco.
  const [detail, setDetail] = useState<PaymentsTarget | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [filters, setFilters] = useState<PaymentFilters>(NO_PAYMENT_FILTERS);
  const [groupBy, setGroupBy] = useState<PaymentGroupBy>('month');
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const compact = useCompactToolbar();
  const activeFilters = countActivePaymentFilters(filters);
  const allPayments = useMemo(() => paymentsData?.payments ?? [], [paymentsData]);
  const hasPayments = allPayments.length > 0;

  // Lo visible: filtrado y agrupado en el cliente, sobre la lista que ya llegó.
  const visible = useMemo(() => filterPayments(allPayments, filters), [allPayments, filters]);
  const groups = useMemo(
    () => groupPayments(visible, groupBy, (method) => t(`finance.method.${method}`)),
    [visible, groupBy, t],
  );


  if (isError) return <PageLayout isError />;
  if (isLoading || !data || !projectData) return <PageLayout isLoading />;

  const currency = projectData.project.currency;
  const { summary, items } = data;
  const payments = allPayments;
  const truncated = allPayments.length >= FINANCE_LIST_LIMIT.payments;

  const groupLabel = (group: PaymentGroup) => {
    if (groupBy === 'method') return t(`finance.method.${group.key}`);
    if (groupBy === 'day') return format(fromDayKey(group.key), 'PPPP', { locale: dateLocale });
    return format(fromDayKey(`${group.key}-01`), 'LLLL yyyy', { locale: dateLocale });
  };

  // `jspdf` pesa: se empieza a bajar cuando la persona se acerca al botón, no en cada visita.
  function warmPdf() {
    void import('@/lib/payments-pdf');
    void import('jspdf');
    void import('jspdf-autotable');
  }

  async function handleDownloadCsv() {
    if (visible.length === 0) return;
    try {
      const [{ buildPaymentsCsv }, { paymentsFileName }] = await Promise.all([
        import('@/lib/movements-csv'),
        import('@/lib/payments-pdf'),
      ]);
      const now = new Date();
      // Lo que la pantalla muestra, en su mismo orden.
      const rows = groups.flatMap((group) => group.payments);
      const numberFormat = new Intl.NumberFormat(i18n.language, { useGrouping: false, maximumFractionDigits: 6 });
      const csv = buildPaymentsCsv(rows, currency, {
        number: (value) => numberFormat.format(value),
        header: {
          date: t('finance.export.columnDate'),
          concept: t('finance.export.columnConcept'),
          method: t('finance.fields.method'),
          reference: t('finance.fields.reference'),
          amount: t('finance.export.columnAmount'),
          currency: t('finance.export.columnCurrency'),
          originalAmount: t('finance.export.columnOriginalAmount'),
          originalCurrency: t('finance.export.columnOriginalCurrency'),
          rate: t('finance.export.columnRate'),
          notes: t('finance.export.columnNotes'),
        },
        onAccount: t('finance.payments.onAccount'),
        method: (method) => t(`finance.method.${method}`),
      });
      downloadBlob(
        new Blob([csv], { type: 'text/csv;charset=utf-8' }),
        paymentsFileName(projectData?.project.name ?? '', now, 'csv'),
      );
      toast.success(t('finance.export.csvDownloaded'));
    } catch {
      toast.error(t('finance.export.csvError'));
    }
  }

  async function handleDownloadPdf() {
    if (generatingPdf || visible.length === 0) return;
    setGeneratingPdf(true);
    try {
      const { buildPaymentsPdf, paymentsFileName } = await import('@/lib/payments-pdf');
      const now = new Date();
      // Lo que la pantalla muestra, en su mismo orden.
      const rows = groups.flatMap((group) => group.payments);
      const blob = await buildPaymentsPdf({
        projectName: projectData?.project.name ?? '',
        payments: rows,
        total: sumPayments(rows),
        labels: {
          title: t('finance.payments.pdf.title'),
          summary: `${t('finance.payments.pdf.summary', { count: rows.length })} · ${format(now, 'PPPP', { locale: dateLocale })}`,
          filtered: activeFilters > 0 ? t('finance.payments.pdf.filtered') : null,
          columns: {
            date: t('finance.payments.pdf.columnDate'),
            concept: t('finance.payments.pdf.columnConcept'),
            method: t('finance.fields.method'),
            reference: t('finance.fields.reference'),
            amount: t('finance.payments.pdf.columnAmount'),
          },
          onAccount: t('finance.payments.onAccount'),
          total: t('finance.payments.pdf.total'),
          generated: t('finance.payments.pdf.generated', { date: format(now, 'Pp', { locale: dateLocale }) }),
          page: (page, total) => t('finance.payments.pdf.page', { page, total }),
          method: (method) => t(`finance.method.${method}`),
          day: (dayKey) => format(fromDayKey(dayKey), 'P', { locale: dateLocale }),
          money: (amount) => formatMoney(amount, currency, i18n.language),
        },
      });
      downloadBlob(blob, paymentsFileName(projectData?.project.name ?? '', now));
      toast.success(t('finance.payments.pdf.downloaded'));
    } catch {
      toast.error(t('finance.payments.pdf.error'));
    } finally {
      setGeneratingPdf(false);
    }
  }

  const paidPercent =
    summary.scheduledTotal > 0
      ? Math.round((summary.paidTotal / summary.scheduledTotal) * 100)
      : 0;

  // Las dos altas de la pantalla flotan juntas abajo al centro: registrar un cobro es la
  // principal; la cuota del cronograma acordado, la de segundo orden (`dockActions`).
  const scheduleButton = (
    <Can I="payment.write">
      <Button variant="outline" onClick={() => setScheduleOpen(true)}>
        <Plus className="size-4" />
        {t('finance.schedule.new')}
      </Button>
    </Can>
  );
  const scheduleDrawer = (
    <Can I="payment.write">
      <NewScheduleItemDrawer
        projectId={projectId!}
        projectCurrency={currency}
        open={scheduleOpen}
        onOpenChange={setScheduleOpen}
      />
    </Can>
  );
  const exportControl = (
    <MovementExport
      compact={compact}
      generatingPdf={generatingPdf}
      disabled={visible.length === 0}
      onPdf={() => void handleDownloadPdf()}
      onCsv={() => void handleDownloadCsv()}
      onWarm={warmPdf}
      labels={{
        download: t('finance.export.download'),
        generating: t('finance.payments.pdf.generating'),
        pdf: t('finance.export.pdf'),
        csv: t('finance.export.csv'),
        pdfButton: t('finance.payments.pdf.button'),
        csvButton: t('finance.export.csvButton'),
      }}
    />
  );

  const actions = {
    action: (
      <Can I="payment.write">
        <NewPaymentDrawer projectId={projectId!} projectCurrency={currency} items={items} />
      </Can>
    ),
  };

  if (items.length === 0 && payments.length === 0) {
    return (
      <>
        <PageLayout
          {...actions}
          dockActions={scheduleButton}
          empty={{
            icon: Wallet,
            title: t('finance.empty.title'),
            description: t('finance.empty.description'),
          }}
        />
        {scheduleDrawer}
      </>
    );
  }

  return (
    <PageLayout
      {...actions}
      toolbar={
        hasPayments ? (
          <MovementFilterBar
            search={filters.search}
            onSearchChange={(search) => setFilters((prev) => ({ ...prev, search }))}
            kind={{
              value: filters.method,
              onChange: (method) => setFilters((prev) => ({ ...prev, method })),
              options: sortPaymentMethods(PAYMENT_METHODS, (method) => t(`finance.method.${method}`), i18n.language).map(
                (value) => ({ value, label: t(`finance.method.${value}`) }),
              ),
              allLabel: t('finance.payments.filters.allMethods'),
              ariaLabel: t('finance.payments.filters.method'),
            }}
            from={filters.from}
            to={filters.to}
            onFromChange={(from) => setFilters((prev) => ({ ...prev, from }))}
            onToChange={(to) => setFilters((prev) => ({ ...prev, to }))}
            groupBy={{
              value: groupBy,
              onChange: setGroupBy,
              options: PAYMENT_GROUP_BY.map((value) => ({ value, label: t(`finance.payments.groupBy.${value}`) })),
              ariaLabel: t('finance.payments.groupBy.label'),
            }}
            activeCount={activeFilters}
            onClear={() => setFilters(NO_PAYMENT_FILTERS)}
            compact={compact}
            actions={
              <>
                {exportControl}
                {scheduleButton}
              </>
            }
            labels={{
              search: t('finance.payments.filters.search'),
              from: t('finance.payments.filters.from'),
              to: t('finance.payments.filters.to'),
              clear: t('finance.payments.filters.clear'),
              button: t('finance.filters.button'),
              done: t('finance.filters.done'),
              actions: t('finance.filters.actions'),
            }}
          />
        ) : undefined
      }
      // En el modo compacto las acciones viven en el panel de filtros.
      secondaryActions={hasPayments && !compact ? exportControl : undefined}
      dockActions={hasPayments && compact ? undefined : scheduleButton}
    >
      {scheduleDrawer}
      <Card>
        <CardHeader className="flex flex-row items-center gap-3">
          <Wallet className="size-4 text-muted-foreground" />
          <CardTitle className="text-base">{t('finance.summary.title')}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <dl className="grid gap-4 text-sm [grid-template-columns:repeat(auto-fit,minmax(11rem,1fr))]">
            <div>
              <dt className="text-muted-foreground">{t('finance.summary.scheduled')}</dt>
              <dd className="break-words text-lg font-semibold tabular-nums">
                {formatMoney(summary.scheduledTotal, currency, i18n.language)}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t('finance.summary.paid')}</dt>
              <dd className="break-words text-lg font-semibold tabular-nums">
                {formatMoney(summary.paidTotal, currency, i18n.language)}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t('finance.summary.pending')}</dt>
              {/* Negativo = el cliente pagó de más. Se muestra tal cual: es el
                  caso que hay que devolver o imputar. */}
              <dd
                className={cn(
                  'break-words text-lg font-semibold tabular-nums',
                  summary.pendingTotal < 0 && 'text-success',
                )}
              >
                {formatMoney(summary.pendingTotal, currency, i18n.language)}
              </dd>
            </div>
          </dl>

          <Progress value={Math.min(paidPercent, 100)} />

          {summary.nextDue && (
            <p className="text-sm text-muted-foreground">
              {t('finance.summary.nextDue', {
                concept: summary.nextDue.concept,
                date: format(fromDayKey(summary.nextDue.dueOn), 'PP', { locale: dateLocale }),
                amount: formatMoney(summary.nextDue.amount, currency, i18n.language),
              })}
            </p>
          )}
        </CardContent>
      </Card>

      <ListSections>
      <ListSection label={t('finance.schedule.title')} meta={items.length > 0 ? items.length : undefined}>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('finance.schedule.empty')}</p>
        ) : (
          <RowCardList>
            {items.map((item) => (
              <RowCard key={item.id} className="relative">
                <RowCardDate
                  date={fromDayKey(item.dueOn)}
                  locale={dateLocale}
                  label={t('finance.schedule.dueOn', {
                    date: format(fromDayKey(item.dueOn), 'PP', { locale: dateLocale }),
                  })}
                />
                <RowCardBody
                  title={<RowOpenButton
                      onClick={() => {
                        setDetail({ kind: 'item', item });
                        setDetailOpen(true);
                      }}
                    >
                      {item.concept}
                    </RowOpenButton>}
                  meta={
                    item.paidAmount > 0 && (
                      // El texto venía después de un " · "; ahora abre la línea.
                      <p className="first-letter:uppercase">
                        {t('finance.schedule.paidSoFar', {
                          amount: formatMoney(item.paidAmount, currency, i18n.language),
                        })}
                      </p>
                    )
                  }
                />

                <RowCardEnd>
                  {/* El estado abre el bloque derecho, en la misma columna en todas las cuotas. */}
                  <Badge variant={STATUS_TAG[item.status].variant} icon={STATUS_TAG[item.status].icon}>
                    {t(`finance.status.${item.status}`)}
                  </Badge>
                  <span className="text-sm tabular-nums">
                    {formatMoney(item.scheduledAmount, currency, i18n.language)}
                  </span>
                  <Can I="payment.write">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="relative z-10"
                      onClick={() => setDeleting({ kind: 'item', item })}
                      aria-label={t('finance.schedule.delete')}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </Can>
                </RowCardEnd>
              </RowCard>
            ))}
          </RowCardList>
        )}
      </ListSection>

      {payments.length === 0 ? (
        <ListSection label={t('finance.payments.title')}>
          <p className="text-sm text-muted-foreground">{t('finance.payments.empty')}</p>
        </ListSection>
      ) : visible.length === 0 ? (
        <ListSection label={t('finance.payments.title')}>
          <EmptyState
            icon={SearchX}
            title={t('finance.payments.filters.emptyTitle')}
            description={t('finance.payments.filters.emptyDescription')}
            action={
              <Button type="button" variant="outline" onClick={() => setFilters(NO_PAYMENT_FILTERS)}>
                <X className="size-4" />
                {t('finance.payments.filters.clear')}
              </Button>
            }
          />
        </ListSection>
      ) : (
        <>
          {truncated && (
            <p role="status" className="-mb-4 text-xs text-muted-foreground">
              {t('finance.listTruncated', { count: FINANCE_LIST_LIMIT.payments })}
            </p>
          )}
          {groups.map((group) => (
            <ListSection
              key={group.key}
              label={`${t('finance.payments.title')} · ${groupLabel(group)}`}
              className="gap-3"
              meta={
                <>
                  <span>{t('finance.payments.groupCount', { count: group.payments.length })}</span>
                  <span className="tabular-nums">{formatMoney(group.total, currency, i18n.language)}</span>
                </>
              }
            >
              <RowCardList>
                {group.payments.map((payment) => (
                  <RowCard key={payment.id} className="relative">
                    <RowCardDate date={fromDayKey(payment.paidOn)} locale={dateLocale} tone="success" />
                    <RowCardBody
                      title={
                        <RowOpenButton
                          onClick={() => {
                            setDetail({ kind: 'payment', payment });
                            setDetailOpen(true);
                          }}
                        >
                          {payment.scheduleItemConcept ?? t('finance.payments.onAccount')}
                        </RowOpenButton>
                      }
                      meta={
                        // La fila no repite lo que ya dice el rótulo del grupo.
                        <>
                          {groupBy !== 'method' && t(`finance.method.${payment.method}`)}
                          {payment.reference && `${groupBy !== 'method' ? ' · ' : ''}${payment.reference}`}
                        </>
                      }
                    />

                    <RowCardEnd>
                      <span className="text-sm tabular-nums">
                        {formatMoney(payment.amountInProjectCurrency, currency, i18n.language)}
                      </span>
                      <Can I="payment.write">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="relative z-10"
                          onClick={() => setDeleting({ kind: 'payment', payment })}
                          aria-label={t('finance.payments.delete')}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </Can>
                    </RowCardEnd>
                  </RowCard>
                ))}
              </RowCardList>
            </ListSection>
          ))}
        </>
      )}
      </ListSections>

      {detail?.kind === 'payment' && (
        <MovementDetail
          open={detailOpen}
          onOpenChange={setDetailOpen}
          title={detail.payment.scheduleItemConcept ?? t('finance.payments.onAccount')}
          caption={format(fromDayKey(detail.payment.paidOn), 'PPPP', { locale: dateLocale })}
          amount={formatMoney(detail.payment.amountInProjectCurrency, currency, i18n.language)}
          fields={[
            {
              label: t('finance.detail.originalAmount'),
              value:
                detail.payment.currency !== currency
                  ? `${formatMoney(detail.payment.amount, detail.payment.currency, i18n.language)} · ${t('finance.detail.rate', { rate: detail.payment.exchangeRate })}`
                  : undefined,
            },
            { label: t('finance.fields.method'), value: t(`finance.method.${detail.payment.method}`) },
            { label: t('finance.fields.reference'), value: detail.payment.reference },
            { label: t('finance.detail.scheduleItem'), value: detail.payment.scheduleItemConcept ?? t('finance.payments.onAccount') },
            { label: t('finance.detail.notes'), value: detail.payment.notes },
            { label: t('finance.detail.registeredBy'), value: detail.payment.registeredByName },
            {
              label: t('finance.detail.registeredAt'),
              value: format(new Date(detail.payment.createdAt), 'Pp', { locale: dateLocale }),
            },
          ]}
        />
      )}

      {detail?.kind === 'item' && (
        <MovementDetail
          open={detailOpen}
          onOpenChange={setDetailOpen}
          title={detail.item.concept}
          caption={t('finance.schedule.dueOn', { date: format(fromDayKey(detail.item.dueOn), 'PPPP', { locale: dateLocale }) })}
          amount={formatMoney(detail.item.scheduledAmount, currency, i18n.language)}
          fields={[
            {
              label: t('finance.detail.originalAmount'),
              value:
                detail.item.currency !== currency
                  ? `${formatMoney(detail.item.amount, detail.item.currency, i18n.language)} · ${t('finance.detail.rate', { rate: detail.item.exchangeRate })}`
                  : undefined,
            },
            { label: t('finance.detail.status'), value: t(`finance.status.${detail.item.status}`) },
            {
              label: t('finance.detail.paidSoFar'),
              value: detail.item.paidAmount > 0 ? formatMoney(detail.item.paidAmount, currency, i18n.language) : undefined,
            },
            { label: t('finance.detail.notes'), value: detail.item.notes },
            {
              label: t('finance.detail.registeredAt'),
              value: format(new Date(detail.item.createdAt), 'Pp', { locale: dateLocale }),
            },
          ]}
        />
      )}

      <AlertDialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleting?.kind === 'payment'
                ? t('finance.payments.deleteTitle')
                : t('finance.schedule.deleteTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleting?.kind === 'item' &&
                t('finance.schedule.deleteBody', {
                  concept: deleting.item.concept,
                  amount: formatMoney(deleting.item.scheduledAmount, currency, i18n.language),
                })}
              {deleting?.kind === 'payment' &&
                t('finance.payments.deleteBody', {
                  amount: formatMoney(
                    deleting.payment.amountInProjectCurrency,
                    currency,
                    i18n.language,
                  ),
                  date: format(fromDayKey(deleting.payment.paidOn), 'PP', { locale: dateLocale }),
                })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className={buttonVariants({ variant: 'destructive' })}
              onClick={() => {
                if (deleting?.kind === 'item') deleteItem.mutate(deleting.item.id);
                if (deleting?.kind === 'payment') deletePayment.mutate(deleting.payment.id);
                setDeleting(null);
              }}
            >
              {deleting?.kind === 'payment'
                ? t('finance.payments.delete')
                : t('finance.schedule.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageLayout>
  );
}

export default ProjectPaymentsPage;
