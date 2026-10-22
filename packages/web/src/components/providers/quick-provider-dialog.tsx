import { useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { createProviderSchema, type CreateProviderInput, type Provider } from '@luma/shared';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { FormShell } from '@/components/common/form-shell';
import { ProviderFormFields } from '@/components/providers/provider-form-fields';
import { ResponsiveDialog } from '@/components/ui/responsive-dialog';
import { useCreateProvider } from '@/hooks/providers/use-provider-queries';
import { useProjectCapabilities } from '@/hooks/projects/use-project-capabilities';

interface QuickProviderDialogProps {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Lo que la persona ya escribió en el buscador: no tiene que tipearlo dos veces. */
  initialName?: string;
  onCreated: (provider: Provider) => void;
}

/**
 * Dar de alta un proveedor sin salir de Compras. Quien está en la obra
 * encuentra al corralón de la esquina mientras carga el pedido; mandarlo a
 * otra pantalla para cargarlo es la razón por la que terminaba escrito a mano.
 *
 * Mismos campos que el alta de Proveedores (`ProviderFormFields`). El alcance
 * sólo lo elige quien tiene `provider.manage`; el resto da de alta para esta
 * obra, y la API lo fuerza igual aunque el pedido diga otra cosa.
 */
export function QuickProviderDialog({
  projectId,
  open,
  onOpenChange,
  initialName,
  onCreated,
}: QuickProviderDialogProps) {
  const { t } = useTranslation();
  const canManage = useProjectCapabilities(projectId).can('provider.manage');
  const createProvider = useCreateProvider(projectId);

  const {
    register,
    handleSubmit,
    reset,
    control,
    watch,
    formState: { errors },
  } = useForm<CreateProviderInput>({
    resolver: zodResolver(createProviderSchema),
  });

  // Cada apertura arranca limpia, con el nombre que se venía buscando.
  useEffect(() => {
    if (!open) return;
    createProvider.reset();
    reset({ name: initialName ?? '', scope: canManage ? 'organization' : 'project' } as CreateProviderInput);
    // Sólo `open`: re-sembrar con cada tecla del nombre borraría lo tipeado.
  }, [open]);

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('provider.list.newTitle')}
      description={canManage ? undefined : t('material.provider.createHint')}
    >
      <FormShell
        variant="embedded"
        submitLabel={t('provider.list.newSubmit')}
        onCancel={() => onOpenChange(false)}
        cancelLabel={t('common.cancel')}
        isSubmitting={createProvider.isPending}
        error={createProvider.error}
        onSubmit={(event) => {
          // Va dentro del drawer del material: sin esto el submit sube al
          // formulario de afuera y lo manda también.
          event.stopPropagation();
          void handleSubmit((values) =>
            createProvider.mutate(values, {
              onSuccess: ({ provider }) => {
                onCreated(provider);
                onOpenChange(false);
              },
            }),
          )(event);
        }}
      >
        <ProviderFormFields
          idPrefix="quick-provider"
          register={register}
          control={control}
          errors={errors}
          specialty={watch('specialty')}
          showScope={canManage}
        />
      </FormShell>
    </ResponsiveDialog>
  );
}
