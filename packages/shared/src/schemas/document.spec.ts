import { describe, expect, it } from 'vitest';
import { createProjectDocumentSchema, updateProjectDocumentSchema } from './document.js';
import { DOCUMENT_CATEGORIES, isSpaceScoped } from '../types/document.js';

describe('createProjectDocumentSchema', () => {
  it('acepta la ficha mínima', () => {
    const parsed = createProjectDocumentSchema.safeParse({
      category: 'permiso_edificio',
      title: 'Permiso de la torre',
    });
    expect(parsed.success).toBe(true);
  });

  it('rechaza una categoría que no está en la matriz', () => {
    const parsed = createProjectDocumentSchema.safeParse({
      category: 'contrato',
      title: 'Contrato',
    });
    expect(parsed.success).toBe(false);
  });

  it('exige título', () => {
    const parsed = createProjectDocumentSchema.safeParse({ category: 'plano', title: '   ' });
    expect(parsed.success).toBe(false);
  });

  it('normaliza un espacio vacío a undefined', () => {
    // Si quedara como '', la lista agruparía por una cadena vacía y mostraría
    // un encabezado de espacio sin nombre.
    const parsed = createProjectDocumentSchema.parse({
      category: 'plano',
      title: 'Planta baja',
      space: '   ',
      notes: '',
    });
    expect(parsed.space).toBeUndefined();
    expect(parsed.notes).toBeUndefined();
  });

  it('conserva el espacio cuando viene', () => {
    const parsed = createProjectDocumentSchema.parse({
      category: 'render',
      title: 'Render cocina',
      space: ' Cocina ',
    });
    expect(parsed.space).toBe('Cocina');
  });
});

describe('updateProjectDocumentSchema', () => {
  it('rechaza un body vacío', () => {
    // Un PATCH sin campos es un error del que llama, no un no-op silencioso.
    expect(updateProjectDocumentSchema.safeParse({}).success).toBe(false);
  });

  it('acepta un solo campo', () => {
    expect(updateProjectDocumentSchema.safeParse({ title: 'Otro nombre' }).success).toBe(true);
  });
});

describe('categorías por espacio', () => {
  it('sólo planos y renders se organizan por espacio', () => {
    // "de cada espacio a construir", dice la matriz, y sólo para esas dos.
    const scoped = DOCUMENT_CATEGORIES.filter(isSpaceScoped);
    expect(scoped).toEqual(['plano', 'render']);
  });
});
