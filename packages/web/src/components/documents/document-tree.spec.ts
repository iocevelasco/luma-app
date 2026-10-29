import type { ProjectDocument } from '@luma/shared';
import { describe, expect, it } from 'vitest';
import {
  buildDocumentTree,
  displayName,
  documentsInSpace,
  titleFromName,
} from './document-tree';

function doc(overrides: Partial<ProjectDocument>): ProjectDocument {
  return {
    id: 'd1',
    projectId: 'p1',
    category: 'plano',
    title: 'Planta',
    fileName: 'planta.pdf',
    contentType: 'application/pdf',
    sizeBytes: 1000,
    url: null,
    uploadedBy: 'u1',
    uploadedByName: 'Ana',
    createdAt: '2026-08-13T10:00:00.000Z',
    updatedAt: '2026-08-13T10:00:00.000Z',
    ...overrides,
  };
}

const label = (category: string) => category.toUpperCase();

describe('buildDocumentTree', () => {
  it('muestra las siete categorías aunque estén vacías', () => {
    const tree = buildDocumentTree([], [], label);
    expect(tree.entities).toHaveLength(7);
    expect(tree.folders.get('/PLANO')).toEqual({ category: 'plano' });
  });

  it('arma una carpeta de espacio sólo dentro de planos y renders', () => {
    const tree = buildDocumentTree(
      [
        doc({ id: 'a', space: 'Cocina' }),
        doc({ id: 'b', category: 'permiso_municipal', space: 'Cocina' }),
      ],
      [],
      label,
    );
    expect(tree.folders.get('/PLANO/Cocina')).toEqual({ category: 'plano', space: 'Cocina' });
    expect(tree.folders.has('/PERMISO_MUNICIPAL/Cocina')).toBe(false);
    expect([...tree.files.keys()]).toContain('/PERMISO_MUNICIPAL/Planta.pdf');
  });

  it('desambigua dos documentos con el mismo nombre', () => {
    const tree = buildDocumentTree([doc({ id: 'a' }), doc({ id: 'b' })], [], label);
    expect([...tree.files.keys()].sort()).toEqual(['/PLANO/Planta (2).pdf', '/PLANO/Planta.pdf']);
  });

  it('una barra en el título no crea una carpeta', () => {
    const tree = buildDocumentTree([doc({ title: 'A/B' })], [], label);
    expect([...tree.files.keys()]).toEqual(['/PLANO/A-B.pdf']);
  });

  it('suma las carpetas de espacio todavía vacías', () => {
    const tree = buildDocumentTree([], [{ category: 'render', space: 'Baño' }], label);
    expect(tree.folders.get('/RENDER/Baño')).toEqual({ category: 'render', space: 'Baño' });
  });

  it('lista los documentos de un espacio', () => {
    const tree = buildDocumentTree(
      [doc({ id: 'a', space: 'Cocina' }), doc({ id: 'b' })],
      [],
      label,
    );
    expect(documentsInSpace(tree, { category: 'plano', space: 'Cocina' }).map((d) => d.id)).toEqual([
      'a',
    ]);
  });
});

describe('nombres', () => {
  it('agrega la extensión al mostrar y la quita al guardar', () => {
    const d = doc({ title: 'Planta', fileName: 'x.PDF' });
    expect(displayName(d)).toBe('Planta.PDF');
    expect(titleFromName('Planta nueva.pdf', d.fileName)).toBe('Planta nueva');
  });

  it('no duplica la extensión si el título ya la trae', () => {
    expect(displayName(doc({ title: 'Planta.pdf' }))).toBe('Planta.pdf');
  });
});
