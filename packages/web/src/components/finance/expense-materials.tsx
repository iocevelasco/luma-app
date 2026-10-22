import type { Expense } from '@luma/shared';
import { Package } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useProjectCapabilities } from '@/hooks/projects/use-project-capabilities';
import { projectMaterialPath } from '@/lib/routes';

/**
 * "¿Qué paga esta factura?" desde Finanzas. Va como un dato más de la línea 2
 * del gasto ("· 3 materiales") y no como una lista abierta: en un mes con
 * veinte facturas, los nombres de cada una empujarían la plata —que es lo
 * que se viene a leer acá— fuera de la pantalla.
 *
 * Los nombres llegan resueltos por la API. Sólo quien puede entrar a Compras
 * recibe además el link a cada material; el contador ve el nombre y nada más.
 */
export function ExpenseMaterials({
  projectId,
  materials,
}: {
  projectId: string;
  materials: NonNullable<Expense['materials']>;
}) {
  const { t } = useTranslation();
  const canOpenPurchases = useProjectCapabilities(projectId).can('material.read');

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1 underline-offset-2 hover:text-foreground hover:underline max-sm:min-h-11"
        >
          <Package aria-hidden className="size-3" />
          {t('finance.expenses.materialsCount', { count: materials.length })}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-2">
        <p className="px-2 pb-1 text-2xs font-medium uppercase tracking-wide text-muted-foreground">
          {t('finance.expenses.materialsTitle')}
        </p>
        <ul className="flex flex-col">
          {materials.map((material) => (
            <li key={material.id} className="text-sm">
              {canOpenPurchases ? (
                <Link
                  to={projectMaterialPath(projectId, material.id)}
                  className="block truncate rounded-sm px-2 py-1.5 hover:bg-accent"
                >
                  {material.name}
                </Link>
              ) : (
                <span className="block truncate px-2 py-1.5">{material.name}</span>
              )}
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
