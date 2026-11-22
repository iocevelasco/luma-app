import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Sheet } from 'lucide-react';
import { FormShell } from '@/components/common/form-shell';
import { Button } from '@/components/ui/button';
import { ResponsiveDialog } from '@/components/ui/responsive-dialog';
import { Spinner } from '@/components/ui/spinner';
import { useReadSheet, type ReadSheet } from '@/hooks/google-drive/use-read-sheet';
import { useBulkCreateMaterials } from '@/hooks/materials/use-material-queries';
import { useIsMobile } from '@/components/ui/use-mobile';
import { planMaterialImport, type ImportPlan } from '@/lib/material-import';

/** Cuántas filas se muestran en la vista previa: alcanza para ver si se leyó bien. */
const PREVIEW_ROWS = 6;
const PREVIEW_SKIPPED = 5;

/**
 * "Importar de Google Sheets" en Compras: elegir una planilla del Drive, ver qué
 * se va a añadir y confirmar. Todo entra como Pendiente, que es lo que es una
 * lista recién traída: algo para revisar y pedir.
 *
 * Es un alta, así que va junto a "Añadir material" (`dockActions`), y también
 * en la pantalla vacía, que es donde más sirve. El diálogo vive acá adentro y
 * no en la página: con la pantalla vacía, `PageLayout` no monta sus hijos.
 *
 * Sin Google Drive configurado no se dibuja.
 */
export function MaterialImportButton({ projectId }: { projectId: string }) {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const [sheet, setSheet] = useState<(ReadSheet & { plan: ImportPlan }) | null>(null);
  const bulkCreate = useBulkCreateMaterials(projectId);
  const reader = useReadSheet((read) => {
    bulkCreate.reset();
    setSheet({ ...read, plan: planMaterialImport(read.values) });
  });

  if (!reader.available) return null;

  const close = () => setSheet(null);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size={isMobile ? 'icon-lg' : 'default'}
        aria-label={t('material.import.button')}
        aria-busy={reader.busy}
        disabled={reader.busy}
        onClick={reader.read}
      >
        {reader.busy ? <Spinner className="size-4" /> : <Sheet className={isMobile ? 'size-5' : 'size-4'} />}
        {!isMobile && t('material.import.button')}
      </Button>

      <ResponsiveDialog
        open={sheet !== null}
        onOpenChange={(open) => !open && close()}
        title={t('material.import.title')}
        description={sheet?.name}
      >
        {sheet && !sheet.plan.ok && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">{t(`material.import.reasons.${sheet.plan.reason}`)}</p>
            <p className="text-xs text-muted-foreground">{t('material.import.columnsHint')}</p>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={close}>
                {t('common.cancel')}
              </Button>
              <Button type="button" disabled={reader.busy} onClick={reader.read}>
                {t('material.import.pickOther')}
              </Button>
            </div>
          </div>
        )}

        {sheet?.plan.ok && (
          <ImportPreview
            plan={sheet.plan}
            submitting={bulkCreate.isPending}
            error={bulkCreate.error}
            onCancel={close}
            onSubmit={(items) => bulkCreate.mutate({ items }, { onSuccess: close })}
          />
        )}
      </ResponsiveDialog>
    </>
  );
}

function ImportPreview({
  plan,
  submitting,
  error,
  onCancel,
  onSubmit,
}: {
  plan: Extract<ImportPlan, { ok: true }>;
  submitting: boolean;
  error: unknown;
  onCancel: () => void;
  onSubmit: (items: Extract<ImportPlan, { ok: true }>['items']) => void;
}) {
  const { t, i18n } = useTranslation();
  const { items, skipped } = plan;
  const number = (value: number) => value.toLocaleString(i18n.language);

  if (items.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">{t('material.import.noneValid', { count: skipped.length })}</p>
        <SkippedList skipped={skipped} />
        <div className="flex justify-end">
          <Button type="button" variant="outline" onClick={onCancel}>
            {t('material.import.close')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <FormShell
      variant="embedded"
      submitLabel={t('material.import.submit', { count: items.length })}
      onCancel={onCancel}
      cancelLabel={t('common.cancel')}
      isSubmitting={submitting}
      error={error}
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(items);
      }}
    >
      <p className="text-sm text-muted-foreground">{t('material.import.summary', { count: items.length })}</p>
      <ul className="flex flex-col gap-2" aria-label={t('material.import.previewLabel')}>
        {items.slice(0, PREVIEW_ROWS).map((item, index) => (
          <li key={index} className="flex min-w-0 flex-col rounded-md bg-secondary px-3 py-2">
            <span className="truncate text-sm">{item.name}</span>
            <span className="text-xs text-muted-foreground">
              {[
                `${number(item.quantity)} ${t(`material.unit.${item.unit}`)}`,
                item.supplier,
              ]
                .filter(Boolean)
                .join(' · ')}
            </span>
          </li>
        ))}
      </ul>
      {items.length > PREVIEW_ROWS && (
        <p className="text-xs text-muted-foreground">
          {t('material.import.more', { count: items.length - PREVIEW_ROWS })}
        </p>
      )}
      {skipped.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-sm">{t('material.import.skipped', { count: skipped.length })}</p>
          <SkippedList skipped={skipped} />
        </div>
      )}
    </FormShell>
  );
}

function SkippedList({ skipped }: { skipped: Extract<ImportPlan, { ok: true }>['skipped'] }) {
  const { t } = useTranslation();
  return (
    <ul className="flex flex-col gap-1 text-xs text-muted-foreground">
      {skipped.slice(0, PREVIEW_SKIPPED).map((row) => (
        <li key={row.line}>
          {t('material.import.skippedRow', { line: row.line, reason: t(`material.import.rowErrors.${row.error}`) })}
        </li>
      ))}
      {skipped.length > PREVIEW_SKIPPED && (
        <li>{t('material.import.more', { count: skipped.length - PREVIEW_SKIPPED })}</li>
      )}
    </ul>
  );
}
