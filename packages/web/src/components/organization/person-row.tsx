import type { ReactNode } from 'react';

/**
 * Una persona de la Empresa en la lista: nombre, etiquetas, líneas de detalle
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
  /** Líneas secundarias; las vacías (`null`, `undefined`, `''`) se omiten. */
  details?: ReactNode[];
  actions: ReactNode;
}) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 text-sm">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{name}</span>
          {badges}
        </div>
        {(details ?? []).filter(Boolean).map((detail, index) => (
          <span key={index} className="block truncate text-muted-foreground">
            {detail}
          </span>
        ))}
      </div>
      <div className="flex gap-2">{actions}</div>
    </li>
  );
}
