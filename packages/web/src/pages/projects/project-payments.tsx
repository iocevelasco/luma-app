import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  createPaymentSchema,
  createPaymentScheduleItemSchema,
  PAYMENT_METHODS,
  type CreatePaymentInput,
  type CreatePaymentScheduleItemInput,
  type PaymentScheduleItem,
  type PaymentScheduleStatus,
} from '@luma/shared';
import { format } from 'date-fns';
import { Plus, Trash2, Wallet } from 'lucide-react';
import { Controller, useForm } from 'react-hook-form';
import type { FieldErrors, FieldValues, Path, UseFormRegister } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { Can } from '@/components/permissions/can';
import { FormDrawer } from '@/components/common/form-drawer';
import { fromDayKey, toDayKey } from '@/components/common/date-range-filter';
import { PageLayout } from '@/components/layout/page-layout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { useDateLocale } from '@/hooks/use-date-locale';
import { formatMoney } from '@/lib/format-money';
import { cn } from '@/lib/utils';

/**
 * `destructive` es peligro, no marca — ver DESIGN.md. Una cuota vencida es lo
 * único acá que pide una acción urgente.
 */
const STATUS_VARIANT: Record<PaymentScheduleStatus, 'secondary' | 'default' | 'destructive'> = {
  pendiente: 'secondary',
  parcial: 'default',
  cobrado: 'default',
  vencido: 'destructive',
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
            {...register('amount' as Path<T>, { valueAsNumber: true })}
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
            {...register('exchangeRate' as Path<T>, { valueAsNumber: true })}
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

function NewScheduleItemDrawer({
  projectId,
  projectCurrency,
}: {
  projectId: string;
  projectCurrency: string;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const createItem = useCreateScheduleItem(projectId);

  const form = useForm<CreatePaymentScheduleItemInput>({
    resolver: zodResolver(createPaymentScheduleItemSchema),
    defaultValues: { currency: projectCurrency, exchangeRate: 1, dueOn: toDayKey(new Date()) },
  });

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Plus className="size-4" />
        {t('finance.schedule.new')}
      </Button>

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
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const createPayment = useCreatePayment(projectId);

  const form = useForm<CreatePaymentInput>({
    resolver: zodResolver(createPaymentSchema),
    defaultValues: {
      currency: projectCurrency,
      exchangeRate: 1,
      paidOn: toDayKey(new Date()),
      method: 'transferencia',
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
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="payment-method">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {t(`finance.method.${option}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
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

export function ProjectPaymentsPage() {
  const { t, i18n } = useTranslation();
  const { projectId } = useParams<{ projectId: string }>();
  const dateLocale = useDateLocale();
  const { data: projectData } = useProject(projectId);
  const { data, isLoading, isError } = usePaymentSchedule(projectId);
  const { data: paymentsData } = usePayments(projectId);
  const deleteItem = useDeleteScheduleItem(projectId!);
  const deletePayment = useDeletePayment(projectId!);

  if (isError) return <PageLayout isError />;
  if (isLoading || !data || !projectData) return <PageLayout isLoading />;

  const currency = projectData.project.currency;
  const { summary, items } = data;
  const payments = paymentsData?.payments ?? [];

  const paidPercent =
    summary.scheduledTotal > 0
      ? Math.round((summary.paidTotal / summary.scheduledTotal) * 100)
      : 0;

  // Las dos altas de la pantalla van arriba, siempre: registrar un cobro es la
  // principal; la cuota del cronograma acordado, la de segundo orden.
  const actions = {
    action: (
      <Can I="payment.write">
        <NewPaymentDrawer projectId={projectId!} projectCurrency={currency} items={items} />
      </Can>
    ),
    secondaryActions: (
      <Can I="payment.write">
        <NewScheduleItemDrawer projectId={projectId!} projectCurrency={currency} />
      </Can>
    ),
  };

  if (items.length === 0 && payments.length === 0) {
    return (
      <PageLayout
        {...actions}
        empty={{
          icon: Wallet,
          title: t('finance.empty.title'),
          description: t('finance.empty.description'),
        }}
      />
    );
  }

  return (
    <PageLayout {...actions}>
      <Card>
        <CardHeader className="flex flex-row items-center gap-3">
          <Wallet className="size-4 text-muted-foreground" />
          <CardTitle className="text-base">{t('finance.summary.title')}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-muted-foreground">{t('finance.summary.scheduled')}</dt>
              <dd className="text-lg font-semibold">
                {formatMoney(summary.scheduledTotal, currency, i18n.language)}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t('finance.summary.paid')}</dt>
              <dd className="text-lg font-semibold">
                {formatMoney(summary.paidTotal, currency, i18n.language)}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t('finance.summary.pending')}</dt>
              {/* Negativo = el cliente pagó de más. Se muestra tal cual: es el
                  caso que hay que devolver o imputar. */}
              <dd
                className={cn(
                  'text-lg font-semibold',
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

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-4">
          <h3 className="text-sm font-medium">{t('finance.schedule.title')}</h3>
        </div>

        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('finance.schedule.empty')}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between gap-3 rounded-md border border-border p-3"
              >
                <div className="flex min-w-0 flex-col gap-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium">{item.concept}</p>
                    <Badge variant={STATUS_VARIANT[item.status]}>
                      {t(`finance.status.${item.status}`)}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t('finance.schedule.dueOn', {
                      date: format(fromDayKey(item.dueOn), 'PP', { locale: dateLocale }),
                    })}
                    {item.paidAmount > 0 &&
                      ` · ${t('finance.schedule.paidSoFar', {
                        amount: formatMoney(item.paidAmount, currency, i18n.language),
                      })}`}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-sm tabular-nums">
                    {formatMoney(item.scheduledAmount, currency, i18n.language)}
                  </span>
                  <Can I="payment.write">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteItem.mutate(item.id)}
                      aria-label={t('finance.schedule.delete')}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </Can>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-4">
          <h3 className="text-sm font-medium">{t('finance.payments.title')}</h3>
        </div>

        {payments.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('finance.payments.empty')}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {payments.map((payment) => (
              <li
                key={payment.id}
                className="flex items-center justify-between gap-3 rounded-md border border-border p-3"
              >
                <div className="flex min-w-0 flex-col gap-0.5">
                  <p className="text-sm font-medium">
                    {payment.scheduleItemConcept ?? t('finance.payments.onAccount')}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {format(fromDayKey(payment.paidOn), 'PP', { locale: dateLocale })}
                    {' · '}
                    {t(`finance.method.${payment.method}`)}
                    {payment.reference && ` · ${payment.reference}`}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-sm tabular-nums">
                    {formatMoney(payment.amountInProjectCurrency, currency, i18n.language)}
                  </span>
                  <Can I="payment.write">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deletePayment.mutate(payment.id)}
                      aria-label={t('finance.payments.delete')}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </Can>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </PageLayout>
  );
}

export default ProjectPaymentsPage;
