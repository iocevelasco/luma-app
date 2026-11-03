import {
  CUSTOM_SPECIALTY_PREFIX,
  MAX_CUSTOM_SPECIALTIES,
  activityBaseSpecialtySchema,
  type CustomSpecialtyKey,
} from '@luma/shared';
import type { IProject } from '../models/Project.js';
import { Project } from '../models/Project.js';
import { badRequest, conflict } from '../utils/errors.js';

/** Minúsculas y sin acentos: «Yesería » y «yeseria» son la misma especialidad. */
function fold(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

function slug(label: string): string {
  return fold(label)
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 50);
}

function sameName(project: IProject, label: string, exceptKey?: string): boolean {
  const wanted = fold(label);
  return project.customSpecialties.some(
    (specialty) => specialty.key !== exceptKey && fold(specialty.label) === wanted,
  );
}

/** «Drywall» o «Diseño» ya existen de base: la clave de base es el rótulo sin tildes. */
function collidesWithBase(label: string): boolean {
  return (activityBaseSpecialtySchema.options as readonly string[]).includes(slug(label));
}

/**
 * Agrega una especialidad propia a la obra. La clave la arma el servidor a
 * partir del nombre; si dos nombres distintos dan la misma, la segunda lleva un
 * número. Una vez creada la clave no cambia nunca: es lo que guardan las tareas.
 */
export async function addCustomSpecialty(project: IProject, label: string) {
  if (!slug(label)) throw badRequest('Escribí un nombre con letras o números.');
  if (collidesWithBase(label) || sameName(project, label)) {
    throw conflict('Ya existe una especialidad con ese nombre.');
  }
  if (project.customSpecialties.length >= MAX_CUSTOM_SPECIALTIES) {
    throw conflict(`Una obra admite hasta ${MAX_CUSTOM_SPECIALTIES} especialidades propias.`);
  }

  const taken = new Set(project.customSpecialties.map((specialty) => specialty.key));
  const base = `${CUSTOM_SPECIALTY_PREFIX}${slug(label)}`;
  let key = base;
  for (let n = 2; taken.has(key); n += 1) key = `${base}_${n}`;

  const created = { key: key as CustomSpecialtyKey, label: label.trim(), archived: false };
  await Project.updateOne({ _id: project._id }, { $push: { customSpecialties: created } });
  return created;
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
    if (!slug(changes.label)) throw badRequest('Escribí un nombre con letras o números.');
    if (collidesWithBase(changes.label) || sameName(project, changes.label, key)) {
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
