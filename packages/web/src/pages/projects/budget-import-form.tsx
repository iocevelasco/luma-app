import { useMemo, useState, type ChangeEvent } from 'react';
import { roundMoney, type CreateBudgetInput } from '@luma/shared';
import { useTranslation } from 'react-i18next';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ResponsiveTable, type ResponsiveColumn } from '@/components/common/responsive-table';
import { useCreateBudget } from '@/hooks/budget/use-budget-queries';
import { formatMoney } from '@/lib/format-money';
import {
  BUDGET_COLUMN_KEYS,
  REQUIRED_BUDGET_COLUMNS,
  SpreadsheetParseError,
  buildImportPreview,
  detectColumnMapping,
  mapSpreadsheetRows,
  parseSpreadsheetFile,
  type BudgetColumnKey,
  type MappedBudgetRow,
  type ParsedSpreadsheet,
  type SpreadsheetParseErrorCode,
} from '@/lib/parse-budget-spreadsheet';

const PREVIEW_LIMIT = 50;

type ImportStep =
  | { kind: 'idle' }
  | { kind: 'parsing' }
  | { kind: 'error'; code: SpreadsheetParseErrorCode }
  | { kind: 'ready'; parsed: ParsedSpreadsheet; mapping: Partial<Record<BudgetColumnKey, number>> };

type PreviewRow = MappedBudgetRow & { key: string };

function ColumnMapping({
  headers,
  mapping,
  onChange,
}: {
  headers: string[];
  mapping: Partial<Record<BudgetColumnKey, number>>;
  onChange: (key: BudgetColumnKey, index: number | undefined) => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {BUDGET_COLUMN_KEYS.map((key) => {
        const required = REQUIRED_BUDGET_COLUMNS.includes(key);
        const value = mapping[key];
        return (
          <div key={key} className="flex flex-col gap-1">
            <Label>{t(`budget.import.columns.${key}`)}</Label>
            <Select
              value={value === undefined ? 'none' : String(value)}
              onValueChange={(next) => onChange(key, next === 'none' ? undefined : Number(next))}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('budget.import.noColumn')} />
              </SelectTrigger>
              <SelectContent>
                {!required && <SelectItem value="none">{t('budget.import.noColumn')}</SelectItem>}
                {headers.map((header, index) => (
                  <SelectItem key={index} value={String(index)}>
                    {header || `(${index + 1})`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );
      })}
    </div>
  );
}

export function BudgetImportForm({ projectId, currency }: { projectId: string; currency: string }) {
  const { t, i18n } = useTranslation();
  const createBudget = useCreateBudget(projectId);
  const [step, setStep] = useState<ImportStep>({ kind: 'idle' });
  const [contingencyAmount, setContingencyAmount] = useState(0);
  const [fileName, setFileName] = useState<string | null>(null);

  const mappedRows = useMemo(() => {
    if (step.kind !== 'ready') return [];
    return mapSpreadsheetRows(step.parsed.rows, step.mapping);
  }, [step]);

  const preview = useMemo(() => buildImportPreview(mappedRows), [mappedRows]);

  const missingRequired =
    step.kind === 'ready'
      ? REQUIRED_BUDGET_COLUMNS.filter((key) => step.mapping[key] === undefined)
      : [];

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Permite re-elegir el mismo archivo después de un error sin que el
    // input "ya lo tenga cargado" y no dispare el evento de nuevo.
    event.target.value = '';
    if (!file) return;

    setFileName(file.name);
    setStep({ kind: 'parsing' });
    try {
      const parsed = await parseSpreadsheetFile(file);
      setStep({ kind: 'ready', parsed, mapping: detectColumnMapping(parsed.headers) });
    } catch (error) {
      const code = error instanceof SpreadsheetParseError ? error.code : 'corrupt';
      setStep({ kind: 'error', code });
    }
  }

  function updateMapping(key: BudgetColumnKey, index: number | undefined) {
    if (step.kind !== 'ready') return;
    setStep({ ...step, mapping: { ...step.mapping, [key]: index } });
  }

  function handleConfirm() {
    const payload: CreateBudgetInput = {
      totalAmount: preview.totalAmount,
      contingencyAmount: roundMoney(contingencyAmount),
      lines: preview.validRows.map((row) => ({
        chapter: row.chapter,
        name: row.name,
        unit: row.unit,
        quantity: row.quantity,
        unitCost: row.unitCost,
        total: roundMoney(row.total ?? 0),
      })),
      importMode: 'import',
      sourceFileName: fileName ?? undefined,
      sourceRowCount: preview.validRows.length,
    };
    createBudget.mutate(payload);
  }

  const previewRows: PreviewRow[] = preview.validRows
    .slice(0, PREVIEW_LIMIT)
    .map((row, index) => ({ ...row, key: String(index) }));

  const columns: ResponsiveColumn<PreviewRow>[] = [
    { id: 'chapter', header: t('budget.fields.chapter'), cell: (r) => r.chapter, mobile: 'secondary' },
    { id: 'name', header: t('budget.fields.name'), cell: (r) => r.name, mobile: 'primary' },
    { id: 'unit', header: t('budget.fields.unit'), cell: (r) => r.unit, mobile: 'field' },
    {
      id: 'quantity',
      header: t('budget.fields.quantity'),
      cell: (r) => r.quantity ?? '—',
      mobile: 'field',
    },
    {
      id: 'unitCost',
      header: t('budget.fields.unitCost'),
      cell: (r) => (r.unitCost !== undefined ? formatMoney(r.unitCost, currency, i18n.language) : '—'),
      mobile: 'field',
    },
    {
      id: 'total',
      header: t('budget.fields.total'),
      cell: (r) => formatMoney(r.total ?? 0, currency, i18n.language),
      mobile: 'secondary',
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="budget-import-file">{t('budget.import.selectFile')}</Label>
        <Input
          id="budget-import-file"
          type="file"
          accept=".xlsx,.csv"
          onChange={handleFileChange}
          disabled={step.kind === 'parsing'}
        />
      </div>

      {step.kind === 'parsing' && (
        <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
      )}

      {step.kind === 'error' && (
        <Alert variant="destructive">
          <AlertTitle>{t('budget.import.errorTitle')}</AlertTitle>
          <AlertDescription>{t(`budget.import.errors.${step.code}`)}</AlertDescription>
        </Alert>
      )}

      {step.kind === 'ready' && (
        <div className="flex flex-col gap-4">
          <ColumnMapping headers={step.parsed.headers} mapping={step.mapping} onChange={updateMapping} />

          {missingRequired.length > 0 && (
            <Alert>
              <AlertTitle>{t('budget.import.missingColumnsTitle')}</AlertTitle>
              <AlertDescription>{t('budget.import.missingColumnsBody')}</AlertDescription>
            </Alert>
          )}

          {missingRequired.length === 0 && (
            <>
              {preview.incompleteCount > 0 && (
                <Alert>
                  <AlertTitle>{t('budget.import.incompleteTitle')}</AlertTitle>
                  <AlertDescription>
                    {t('budget.import.incompleteBody', { count: preview.incompleteCount })}
                  </AlertDescription>
                </Alert>
              )}
              {preview.duplicateCount > 0 && (
                <Alert>
                  <AlertTitle>{t('budget.import.duplicateTitle')}</AlertTitle>
                  <AlertDescription>
                    {t('budget.import.duplicateBody', { count: preview.duplicateCount })}
                  </AlertDescription>
                </Alert>
              )}

              {preview.validRows.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('budget.import.noValidRows')}</p>
              ) : (
                <>
                  <ResponsiveTable columns={columns} rows={previewRows} getRowKey={(r) => r.key} />
                  {preview.validRows.length > PREVIEW_LIMIT && (
                    <p className="text-xs text-muted-foreground">
                      {t('budget.import.moreRows', { count: preview.validRows.length - PREVIEW_LIMIT })}
                    </p>
                  )}

                  <div className="flex flex-col gap-2 border-t border-border pt-4 sm:flex-row sm:items-end sm:justify-between">
                    <div className="flex flex-col gap-1 sm:max-w-xs">
                      <Label htmlFor="import-contingency">{t('budget.fields.contingencyAmount')}</Label>
                      <Input
                        id="import-contingency"
                        inputMode="decimal"
                        value={contingencyAmount}
                        onChange={(event) => setContingencyAmount(Number(event.target.value) || 0)}
                      />
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">{t('budget.form.computedTotal')}</p>
                      <p className="text-lg font-semibold">
                        {formatMoney(preview.totalAmount, currency, i18n.language)}
                      </p>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button onClick={handleConfirm} disabled={createBudget.isPending}>
                      {createBudget.isPending ? t('common.loading') : t('budget.import.confirm')}
                    </Button>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default BudgetImportForm;
