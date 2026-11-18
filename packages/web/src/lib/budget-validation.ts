import type { TFunction } from 'i18next';

/** Un issue de Zod, del cliente o del `details` que devuelve la API. */
export interface FieldIssue {
  code?: string;
  maximum?: number | bigint;
  path?: Array<string | number>;
  message?: string;
}

export type BudgetValidationHint =
  | { kind: 'nameTooLong'; lines: number[]; max: number }
  | { kind: 'lines'; lines: number[] };

/**
 * Traduce los issues de un presupuesto a algo que se puede mostrar.
 * Los índices del path son 0-based; las partidas se cuentan desde 1.
 */
export function budgetValidationHint(issues: FieldIssue[]): BudgetValidationHint | null {
  const nameLines: number[] = [];
  const lineNumbers = new Set<number>();
  let max = 0;

  for (const issue of issues) {
    const path = issue.path ?? [];
    if (path[0] !== 'lines' || typeof path[1] !== 'number') continue;
    lineNumbers.add(path[1] + 1);
    if (issue.code === 'too_big' && path[2] === 'name') {
      nameLines.push(path[1] + 1);
      if (typeof issue.maximum === 'number') max = issue.maximum;
    }
  }

  if (nameLines.length > 0) return { kind: 'nameTooLong', lines: nameLines, max };
  if (lineNumbers.size > 0) return { kind: 'lines', lines: [...lineNumbers].sort((a, b) => a - b) };
  return null;
}

export function budgetValidationMessage(issues: FieldIssue[], t: TFunction): string {
  const hint = budgetValidationHint(issues);
  if (!hint) return t('errors.validation');
  if (hint.kind === 'nameTooLong') {
    return t('budget.import.nameTooLong', { lines: hint.lines.join(', '), max: hint.max });
  }
  return t('budget.form.lineErrors', { lines: hint.lines.join(', ') });
}
