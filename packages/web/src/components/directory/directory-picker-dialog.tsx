import { Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { FormDrawer } from '@/components/common/form-drawer';
import { Button } from '@/components/ui/button';

export interface DirectoryPickerItem {
  id: string;
  name: string;
  detail?: string;
}

/**
 * Lo que la Empresa ya tiene cargado y esta obra todavía no. Es el camino de
 * "agregar a la obra": elegir de la libreta en vez de volver a tipear a la
 * misma persona obra por obra.
 */
export function DirectoryPickerDialog({
  open,
  onOpenChange,
  title,
  items,
  isLoading,
  pendingId,
  emptyLabel,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  items: DirectoryPickerItem[];
  isLoading: boolean;
  pendingId?: string | null;
  emptyLabel: string;
  onAdd: (id: string) => void;
}) {
  const { t } = useTranslation();

  return (
    <FormDrawer open={open} onOpenChange={onOpenChange} title={title} size="md">
      {isLoading ? (
        <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyLabel}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{item.name}</p>
                {item.detail && (
                  <p className="truncate text-xs text-muted-foreground">{item.detail}</p>
                )}
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={pendingId === item.id}
                onClick={() => onAdd(item.id)}
              >
                <Plus className="size-4" />
                {t('directory.addToProject')}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </FormDrawer>
  );
}
