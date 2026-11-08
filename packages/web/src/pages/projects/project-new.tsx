import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { createProjectSchema, type CreateProjectInput } from '@luma/shared';
import {
  Calculator,
  CalendarRange,
  Check,
  Package,
  UserPlus,
  type LucideIcon,
} from 'lucide-react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { isApiError } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { useMySubscription } from '@/hooks/subscription/use-subscription-queries';
import { nextProjectState } from '@/lib/subscription';
import { FormShell } from '@/components/common/form-shell';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCreateProject, useProject } from '@/hooks/projects/use-project-queries';
import { CURRENCY_OPTIONS } from '@/lib/currencies';
import { toDayKey } from '@/lib/day-key';
import {
  projectActivitiesPath,
  projectBudgetPath,
  projectDetailPath,
  projectMaterialsPath,
  projectTeamPath,
  ROUTES,
} from '@/lib/routes';
import { cn } from '@/lib/utils';

type Field = keyof CreateProjectInput;

/**
 * El alta es un recorrido de tres pasos: la obra, plazos y moneda, y la pantalla de
 * "¿por dónde seguimos?" como tercero. Antes era una sola pantalla con todo: la decisión
 * cambió porque quien llega a crear su primera obra necesita sentirse guiado, y ver una
 * pared de campos no ayuda. Los campos y las reglas son los mismos
 * (`createProjectSchema`); sólo cambia cuándo se piden.
 */
const STEPS: { key: 'basics' | 'dates'; fields: Field[] }[] = [
  { key: 'basics', fields: ['name', 'location', 'size'] },
  { key: 'dates', fields: ['estimatedStartDate', 'estimatedEndDate', 'currency'] },
];

/** Los pasos que ve la persona: los del formulario y, de tercero, la pantalla de "¿por dónde seguimos?". */
const TOTAL_STEPS = STEPS.length + 1;

/** Lo que se ofrece al terminar: la primera actividad es la principal; el resto, otras formas de empezar. */
const NEXT_STEPS: {
  key: 'activities' | 'materials' | 'budget' | 'team';
  icon: LucideIcon;
  path: (projectId: string) => string;
}[] = [
  { key: 'activities', icon: CalendarRange, path: projectActivitiesPath },
  { key: 'materials', icon: Package, path: projectMaterialsPath },
  { key: 'budget', icon: Calculator, path: projectBudgetPath },
  { key: 'team', icon: UserPlus, path: projectTeamPath },
];

/** Un campo con su etiqueta y su error: la unidad que se repite en cada paso. */
function FieldRow({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

export function ProjectNewPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const createProject = useCreateProject();
  const { data: subscription } = useMySubscription();
  const isExtra = nextProjectState(subscription) === 'extra';
  const [step, setStep] = useState(0);
  // La pantalla final vive en la URL (`?creada=<id>`) y no en el estado: así un "atrás" del
  // navegador o una recarga la vuelven a mostrar en vez de dejar un formulario vacío desde el
  // que es fácil crear la misma obra dos veces.
  const [searchParams] = useSearchParams();
  const createdId = searchParams.get('creada');
  const { data: createdData } = useProject(createdId ?? undefined);
  // Si el alta choca con la suscripción (se llegó por URL a la cuarta obra en
  // la prueba, o venció), la salida es la pantalla de Suscripción.
  const blockedBySubscription =
    isApiError(createProject.error) &&
    ['PAID_PLAN_REQUIRED', 'SUBSCRIPTION_REQUIRED'].includes(createProject.error.code ?? '');

  const {
    register,
    handleSubmit,
    control,
    trigger,
    formState: { errors },
  } = useForm<CreateProjectInput>({
    resolver: zodResolver(createProjectSchema),
    // Hoy, en hora local: es lo más probable y un campo menos que pensar. La entrega no
    // tiene valor por defecto: inventarla haría decir a la tarjeta de la obra algo que nadie dijo.
    defaultValues: { estimatedStartDate: toDayKey(new Date()) },
  });

  if (createdId) {
    return (
      <div className="mx-auto flex w-full max-w-xl flex-col gap-6 py-6" data-testid="project-created">
        {/* Tercero de tres: la barra llena y el mismo "Paso X de Y" de los pasos anteriores. */}
        <div className="flex flex-col gap-3">
          <ol aria-label={t('project.new.step', { current: TOTAL_STEPS, total: TOTAL_STEPS })} className="flex gap-1.5">
            {Array.from({ length: TOTAL_STEPS }, (_, i) => (
              <li key={i} aria-hidden="true" className="h-1.5 flex-1 rounded-full bg-primary" />
            ))}
          </ol>
          <p className="text-center text-xs uppercase tracking-wide text-muted-foreground">
            {t('project.new.step', { current: TOTAL_STEPS, total: TOTAL_STEPS })}
          </p>
        </div>
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Check aria-hidden className="size-6" />
          </span>
          <h2 className="text-2xl leading-tight">{t('project.new.done.title')}</h2>
          <p className="text-muted-foreground">{t('project.new.done.subtitle', { name: createdData?.project.name ?? '' })}</p>
        </div>

        <div className="flex flex-col gap-3">
          {NEXT_STEPS.map(({ key, icon: Icon, path }, index) => (
            <Button
              key={key}
              asChild
              size="lg"
              variant={index === 0 ? 'default' : 'outline'}
              className="h-auto w-full justify-start py-3"
            >
              <Link to={path(createdId)} data-testid={`next-step-${key}`}>
                <Icon aria-hidden />
                <span className="flex flex-1 flex-col items-start text-left">
                  <span>{t(`project.new.done.${key}.title`)}</span>
                  <span className="text-xs font-normal opacity-80">
                    {t(`project.new.done.${key}.hint`)}
                  </span>
                </span>
              </Link>
            </Button>
          ))}
          <Button asChild variant="ghost">
            <Link to={projectDetailPath(createdId)} data-testid="next-step-detail">
              {t('project.new.done.detail')}
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  // Si el servidor o el schema rechazan al enviar y el campo con error está en un paso anterior,
  // se vuelve a ese paso: un error en un campo que no se ve parece un botón que no hace nada.
  const stepWithError = (fields: Field[]) => STEPS.findIndex((s) => s.fields.some((f) => fields.includes(f)));
  const submit = handleSubmit(
    (values) =>
      createProject.mutate(values, {
        // `replace`: la pantalla final reemplaza al formulario en el historial.
        onSuccess: ({ project }) => navigate(`${ROUTES.PROJECT_NEW}?creada=${project.id}`, { replace: true }),
      }),
    (invalid) => {
      const at = stepWithError(Object.keys(invalid) as Field[]);
      if (at >= 0) setStep(at);
    },
  );

  // El primer paso valida sus campos antes de dejar avanzar; el último crea la obra, y el schema
  // vuelve a validar todo, incluida la entrega contra el inicio (está en el mismo paso).
  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isLast) {
      if (await trigger(current.fields)) setStep(step + 1);
      return;
    }
    await submit(event);
  };

  return (
    /*
      Alto acotado y no `min-h`: el pie pegajoso necesita un contenedor con
      altura definida contra la cual pegarse. Si la caja crece con el
      contenido, "sticky bottom-0" no tiene fondo al que agarrarse y el botón
      vuelve a irse con el scroll.

      El alto sale de las medidas del layout (`DashboardLayout`): header de
      3.5rem y 1rem de padding arriba. En desktop el pie queda a ras del borde
      de abajo —se cancela el `pb-28` del `main`, que ahí no tiene barra
      inferior que esquivar—; en mobile se deja el lugar de la barra inferior.
      Con `-mx-4` el pie va de borde a borde del área de trabajo.
    */
    <div className="-mx-4 flex h-[calc(100dvh-13.5rem)] flex-col bg-background md:-mb-28 md:h-[calc(100dvh-4.5rem)]">
      <FormShell
        variant="bare"
        onSubmit={onSubmit}
        submitLabel={isLast ? t('project.new.submit') : t('project.new.next')}
        // Atrás vuelve un paso; en el primero, Cancelar sale al listado.
        onCancel={() => {
          if (step === 0) navigate(ROUTES.ADMIN);
          else {
            // El banner de una falla del alta no sigue a la persona a los pasos anteriores.
            createProject.reset();
            setStep(step - 1);
          }
        }}
        cancelLabel={step === 0 ? undefined : t('project.new.back')}
        isSubmitting={createProject.isPending}
        error={createProject.error}
        errorActions={
          blockedBySubscription ? (
            <Button asChild size="sm" variant="outline">
              <Link to={ROUTES.SUBSCRIPTION}>{t('project.new.seeSubscription')}</Link>
            </Button>
          ) : undefined
        }
      >
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 pt-2">
          {isExtra && (
            <p className="rounded-2xl border border-info/40 bg-info/10 px-4 py-3 text-sm">
              {t('project.new.extraNotice')}
            </p>
          )}

          {/* Dónde está la persona: el nombre del paso, cuántos faltan y una barra. */}
          <div className="flex flex-col gap-3" data-testid="project-new-progress">
            <ol
              aria-label={t('project.new.step', { current: step + 1, total: TOTAL_STEPS })}
              className="flex gap-1.5"
            >
              {[...STEPS.map((s) => s.key), 'done'].map((key, i) => (
                <li
                  key={key}
                  aria-hidden="true"
                  className={cn('h-1.5 flex-1 rounded-full transition-colors', i <= step ? 'bg-primary' : 'bg-border')}
                />
              ))}
            </ol>
            <div className="flex flex-col gap-1">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                {t('project.new.step', { current: step + 1, total: TOTAL_STEPS })}
              </p>
              <h2 className="text-2xl leading-tight">{t(`project.new.steps.${current.key}.title`)}</h2>
              <p className="text-muted-foreground">{t(`project.new.steps.${current.key}.hint`)}</p>
            </div>
          </div>

          {current.key === 'basics' && (
            <>
              <FieldRow id="name" label={t('project.fields.name')} error={errors.name?.message}>
                <Input aria-invalid={Boolean(errors.name)} id="name" autoFocus {...register('name')} />
              </FieldRow>
              <FieldRow id="location" label={t('project.fields.location')} error={errors.location?.message}>
                <Input aria-invalid={Boolean(errors.location)} id="location" {...register('location')} />
              </FieldRow>
              <FieldRow id="size" label={t('project.fields.size')} error={errors.size?.message}>
                <Input id="size" {...register('size')} />
              </FieldRow>
            </>
          )}

          {current.key === 'dates' && (
            <>
            <div className="grid gap-4 sm:grid-cols-2">
              <FieldRow
                id="estimatedStartDate"
                label={t('project.fields.startDate')}
                error={errors.estimatedStartDate?.message}
              >
                <Input
                  aria-invalid={Boolean(errors.estimatedStartDate)}
                  id="estimatedStartDate"
                  type="date"
                  {...register('estimatedStartDate')}
                />
              </FieldRow>
              <FieldRow
                id="estimatedEndDate"
                label={t('project.fields.endDate')}
                error={errors.estimatedEndDate?.message}
              >
                <Input
                  aria-invalid={Boolean(errors.estimatedEndDate)}
                  id="estimatedEndDate"
                  type="date"
                  {...register('estimatedEndDate')}
                />
              </FieldRow>
            </div>
            <FieldRow id="currency" label={t('project.fields.currency')} error={errors.currency?.message}>
              <Controller
                control={control}
                name="currency"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger aria-invalid={Boolean(errors.currency)} id="currency">
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
            </FieldRow>
            </>
          )}
        </div>
      </FormShell>
    </div>
  );
}

export default ProjectNewPage;
