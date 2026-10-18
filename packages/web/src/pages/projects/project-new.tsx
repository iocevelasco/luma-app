import { zodResolver } from '@hookform/resolvers/zod';
import { createProjectSchema, type CreateProjectInput } from '@luma/shared';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
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
import { Textarea } from '@/components/ui/textarea';
import { useCreateProject } from '@/hooks/projects/use-project-queries';
import { ROUTES } from '@/lib/routes';

/**
 * Monedas comunes de arranque, no un catálogo exhaustivo — fácil de sumar más
 * cuando haga falta. La validación de `currency` en el schema compartido es
 * un string libre a propósito: la UI cura la lista, el contrato no la fija.
 */
const CURRENCY_OPTIONS = ['ARS', 'USD', 'MXN', 'COP', 'CLP', 'PEN'];

/**
 * Separador con título entre bloques del formulario. Es un `<h2>` y no un
 * `<p>` con estilo: para quien navega con lector de pantalla, la estructura
 * del formulario es la única pista de cuántas partes tiene.
 */
function FieldGroup({ title }: { title: string }) {
  return (
    <h2 className="border-b border-border pb-1 pt-2 text-xs font-medium uppercase tracking-wide text-muted-foreground first:pt-0">
      {title}
    </h2>
  );
}

export function ProjectNewPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const createProject = useCreateProject();

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<CreateProjectInput>({ resolver: zodResolver(createProjectSchema) });

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
      {/*
        Sin tarjeta ni título propio: el nombre de la sección ya está en el
        header (ver `Breadcrumbs`), y repetirlo acá gastaba el alto que el
        formulario necesita. El formulario scrollea y las acciones quedan
        pegadas al fondo.
      */}
      <FormShell
        variant="bare"
        onSubmit={handleSubmit((values) => createProject.mutate(values))}
        submitLabel={t('project.new.submit')}
        onCancel={() => navigate(ROUTES.ADMIN)}
        isSubmitting={createProject.isPending}
        error={createProject.error}
      >
        {/*
              Tres bloques en una sola pantalla, no tres pasos.
              Ocho campos entran de sobra en una vista, ninguno depende de una
              respuesta anterior y todos son obligatorios salvo el metraje: un
              asistente agregaría dos clicks y le sacaría a la persona la
              posibilidad de ver de una el compromiso completo antes de
              empezar a escribir. Los subtítulos resuelven lo que molestaba
              —que se leía como una pared— sin ese costo.
            */}
        {/* El formulario es una columna angosta y centrada; el pie no. */}
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="name">{t('project.fields.name')}</Label>
            <Input aria-invalid={Boolean(errors.name)} id="name" {...register('name')} />
            {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="description">{t('project.fields.description')}</Label>
            <Textarea
              aria-invalid={Boolean(errors.description)}
              id="description"
              rows={3}
              {...register('description')}
            />
            {errors.description && (
              <p className="text-sm text-destructive">{errors.description.message}</p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="location">{t('project.fields.location')}</Label>
            <Input
              aria-invalid={Boolean(errors.location)}
              id="location"
              {...register('location')}
            />
            {errors.location && (
              <p className="text-sm text-destructive">{errors.location.message}</p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="size">{t('project.fields.size')}</Label>
            <Input id="size" {...register('size')} />
          </div>

          <FieldGroup title={t('project.new.sections.when')} />

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="estimatedStartDate">{t('project.fields.startDate')}</Label>
              <Input
                aria-invalid={Boolean(errors.estimatedStartDate)}
                id="estimatedStartDate"
                type="date"
                {...register('estimatedStartDate')}
              />
              {errors.estimatedStartDate && (
                <p className="text-sm text-destructive">{errors.estimatedStartDate.message}</p>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="estimatedEndDate">{t('project.fields.endDate')}</Label>
              <Input
                aria-invalid={Boolean(errors.estimatedEndDate)}
                id="estimatedEndDate"
                type="date"
                {...register('estimatedEndDate')}
              />
              {errors.estimatedEndDate && (
                <p className="text-sm text-destructive">{errors.estimatedEndDate.message}</p>
              )}
            </div>
          </div>

          <FieldGroup title={t('project.new.sections.money')} />

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="currency">{t('project.fields.currency')}</Label>
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
              {errors.currency && (
                <p className="text-sm text-destructive">{errors.currency.message}</p>
              )}
            </div>
          </div>
        </div>
      </FormShell>
    </div>
  );
}

export default ProjectNewPage;
