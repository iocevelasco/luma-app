import { useMemo } from 'react';
import type { Provider } from '@luma/shared';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { MaterialStatusBadge } from '@/components/materials/material-status-badge';
import { ResponsiveDialog } from '@/components/ui/responsive-dialog';
import { Spinner } from '@/components/ui/spinner';
import { useMaterials } from '@/hooks/materials/use-material-queries';
import { projectMaterialPath, projectMaterialsPath } from '@/lib/routes';

interface ProviderMaterialsDialogProps {
  projectId: string;
  provider: Provider;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * "¿Qué le compramos a este proveedor en esta obra?" — la otra punta del
 * vínculo entre Compras y Proveedores. Lee la misma lista que Compras y la
 * filtra acá: no hace falta un endpoint para una pregunta que ya está en la
 * caché.
 *
 * Sólo lo vinculado. Lo escrito a mano con el mismo nombre no aparece: es
 * justamente lo que todavía no se formalizó, y Compras ofrece vincularlo.
 */
export function ProviderMaterialsDialog({
  projectId,
  provider,
  open,
  onOpenChange,
}: ProviderMaterialsDialogProps) {
  const { t } = useTranslation();
  const { data, isLoading } = useMaterials(open ? projectId : undefined);

  const materials = useMemo(
    () => (data?.materials ?? []).filter((material) => material.providerId === provider.id),
    [data, provider.id],
  );

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('provider.materials.title', { name: provider.name })}
    >
      {isLoading ? (
        <div className="flex justify-center py-6">
          <Spinner className="size-5" />
        </div>
      ) : materials.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('provider.materials.empty')}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {materials.map((material) => (
            <li key={material.id} className="flex items-center justify-between gap-3 py-3 text-sm">
              <Link
                to={projectMaterialPath(projectId, material.id)}
                className="min-w-0 underline-offset-2 hover:underline max-sm:min-h-11"
              >
                <p className="truncate font-medium">{material.name}</p>
                <p className="text-muted-foreground">
                  {material.quantity} {t(`material.unit.${material.unit}`)}
                </p>
              </Link>
              <MaterialStatusBadge status={material.status} />
            </li>
          ))}
        </ul>
      )}
      <Link
        to={projectMaterialsPath(projectId)}
        className="mt-2 self-start text-sm font-medium underline-offset-2 hover:underline"
      >
        {t('provider.materials.openPurchases')}
      </Link>
    </ResponsiveDialog>
  );
}
