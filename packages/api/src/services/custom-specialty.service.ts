import {
  BASE_SPECIALTY_NAMES,
  CUSTOM_SPECIALTY_PREFIX,
  MAX_CUSTOM_SPECIALTIES,
  type CustomSpecialtyKey,
} from '@luma/shared';
import type { IProject } from '../models/Project.js';
import { Project } from '../models/Project.js';
import { badRequest, conflict } from '../utils/errors.js';

/** Minúsculas y sin acentos: «Yesería » y «yeseria» son la misma especialidad. */
function fold(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

/** Lo que identifica un nombre: sin tildes ni signos, así «A/B» y «A B» chocan. */
function slug(label: string): string {
  return fold(label)
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 50);
}

const BASE_SLUGS: ReadonlySet<string> = new Set([
  ...Object.keys(BASE_SPECIALTY_NAMES),
  ...Object.values(BASE_SPECIALTY_NAMES).map(slug),
]);

/** ¿Otra especialidad de la obra se llama (casi) igual? `exceptKey` es la que se está renombrando. */
function sameName(project: IProject, label: string, exceptKey?: string): boolean {
  const wanted = slug(label);
  return project.customSpecialties.some(
    (specialty) => specialty.key !== exceptKey && slug(specialty.label) === wanted,
  );
}

/** «Sistema contra incendio» o «Diseño» ya existen de base: se compara con el nombre visible y con la clave. */
function collidesWithBase(label: string): boolean {
  return BASE_SLUGS.has(slug(label));
}

function assertValidName(label: string) {
  if (!slug(label)) throw badRequest('Escribe un nombre con letras o números.');
  if (collidesWithBase(label)) throw conflict('Ya existe una especialidad con ese nombre.');
}

/**
 * Agrega una especialidad propia a la obra. La clave sale del nombre
 * (`custom_<nombre sin tildes>`) y no cambia nunca: es lo que guardan las tareas.
 *
 * Que el nombre no se repita y que no se pase el tope se decide **en la misma
 * escritura** (el filtro del `updateOne`), no contra la copia de la obra que
 * trajo el middleware: dos gerentes creando lo mismo a la vez no pueden dejar
 * dos entradas con la misma clave.
 */
export async function addCustomSpecialty(project: IProject, label: string) {
  assertValidName(label);

  const key = `${CUSTOM_SPECIALTY_PREFIX}${slug(label)}` as CustomSpecialtyKey;
  const created = { key, label: label.trim(), archived: false };

  const result = await Project.updateOne(
    {
      _id: project._id,
      'customSpecialties.key': { $ne: key },
      [`customSpecialties.${MAX_CUSTOM_SPECIALTIES - 1}`]: { $exists: false },
    },
    { $push: { customSpecialties: created } },
  );
  if (result.modifiedCount === 1) return created;

  // No entró: o ya existe, o la obra está llena. Se mira la obra de ahora para decirlo.
  const fresh = await Project.findById(project._id).select('customSpecialties').lean();
  if (fresh?.customSpecialties.some((specialty) => specialty.key === key)) {
    throw conflict('Ya existe una especialidad con ese nombre.');
  }
  throw conflict(`Una obra admite hasta ${MAX_CUSTOM_SPECIALTIES} especialidades propias.`);
}

/** Renombra o archiva. Archivar no toca las tareas: dejan de poder elegirla, nada más. */
export async function updateCustomSpecialty(
  project: IProject,
  key: string,
  changes: { label?: string; archived?: boolean },
) {
  const current = project.customSpecialties.find((specialty) => specialty.key === key);
  if (!current) return null;

  if (changes.label !== undefined) {
    assertValidName(changes.label);
    if (sameName(project, changes.label, key)) {
      throw conflict('Ya existe una especialidad con ese nombre.');
    }
  }

  const set: Record<string, unknown> = {};
  if (changes.label !== undefined) set['customSpecialties.$.label'] = changes.label.trim();
  if (changes.archived !== undefined) set['customSpecialties.$.archived'] = changes.archived;
  await Project.updateOne({ _id: project._id, 'customSpecialties.key': key }, { $set: set });

  return {
    key,
    label: changes.label?.trim() ?? current.label,
    archived: changes.archived ?? current.archived,
  };
}

/**
 * ¿Se puede elegir `specialty` en esta obra? Las de base siempre; una propia
 * tiene que existir en la obra y no estar archivada.
 */
export function isSelectableSpecialty(project: IProject, specialty: string): boolean {
  if (!specialty.startsWith(CUSTOM_SPECIALTY_PREFIX)) return true;
  return project.customSpecialties.some((item) => item.key === specialty && !item.archived);
}
