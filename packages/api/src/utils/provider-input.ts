import type { UpdateQuery } from 'mongoose';
import {
  allowsCustomSpecialty,
  type CreateProviderInput,
  type UpdateProviderInput,
} from '@luma/shared';
import type { IProvider } from '../models/Provider.js';

/**
 * Qué se guarda de un proveedor, y qué no.
 *
 * Un `<input>` vacío manda `''`, no `undefined`. Sin esto la base se llena de
 * `companyName: ''` y de un `customSpecialty` que quedó de cuando el rubro era
 * «Otra»: campos que dicen "no hay nada" de dos maneras distintas, y cada
 * lectura tiene que acordarse de las dos.
 *
 * Vive acá y no en el schema de `@luma/shared` a propósito: el formulario de
 * edición valida con el schema de alta, y si éste convirtiera `''` en
 * `undefined`, vaciar un campo dejaría de llegar a la API — un PATCH sin la
 * clave es "no cambies esto", no "borralo".
 */

const OPTIONAL_TEXT_FIELDS = ['companyName', 'email', 'notes', 'customSpecialty'] as const;

/** Alta: lo que está en blanco no se guarda, y el detalle sólo va con un rubro que lo admite. */
export function toNewProvider(data: CreateProviderInput): CreateProviderInput {
  const next: CreateProviderInput = { ...data };

  for (const field of OPTIONAL_TEXT_FIELDS) {
    if (!next[field]) delete next[field];
  }
  if (!allowsCustomSpecialty(next.specialty)) delete next.customSpecialty;

  return next;
}

/**
 * Edición: `''` es "vaciá este campo" y se traduce a `$unset`; cambiar a un
 * rubro sin detalle borra el `customSpecialty` que había.
 */
export function toProviderUpdate(data: UpdateProviderInput): UpdateQuery<IProvider> {
  const set: Record<string, unknown> = { ...data };
  const unset: Record<string, 1> = {};

  for (const field of OPTIONAL_TEXT_FIELDS) {
    if (set[field] === '') {
      delete set[field];
      unset[field] = 1;
    }
  }
  if (data.specialty && !allowsCustomSpecialty(data.specialty)) {
    delete set.customSpecialty;
    unset.customSpecialty = 1;
  }

  return (Object.keys(unset).length > 0 ? { ...set, $unset: unset } : set) as UpdateQuery<IProvider>;
}
