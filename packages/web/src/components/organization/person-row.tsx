import { Fragment, type ReactNode } from 'react';
import { RowCard, RowCardBody, RowCardEnd } from '@/components/common/row-card-list';

/**
 * Una persona de la Empresa en la lista: nombre, etiquetas, línea de detalle
 * y acciones.
 *
 * Existe para que quien hace trabajo administrativo y quien trabaja en obra se
 * vean igual en la misma lista. Son dos cosas distintas por debajo (una tiene
 * cuenta y acceso, la otra jornal y asistencia) pero para la Empresa son
 * empleados, y una fila hecha de otra manera cada vez los separaría a la vista.
 */
export function PersonRow({
  name,
  badges,
  details,
  actions,
}: {
  name: string;
  badges?: ReactNode;
  /** Datos de la línea 2, separados por " · "; los vacíos (`null`, `undefined`, `''`) se omiten. */
  details?: ReactNode[];
  actions: ReactNode;
}) {
  const shown = (details ?? []).filter(Boolean);

  return (
    <RowCard className="justify-between">
      <RowCardBody
        title={
          <div className="flex flex-wrap items-center gap-2">
            <span>{name}</span>
            {badges}
          </div>
        }
        meta={
          shown.length > 0 && (
            <p className="truncate">
              {shown.map((detail, index) => (
                <Fragment key={index}>
                  {index > 0 && ' · '}
                  {detail}
                </Fragment>
              ))}
            </p>
          )
        }
      />
      <RowCardEnd>{actions}</RowCardEnd>
    </RowCard>
  );
}
