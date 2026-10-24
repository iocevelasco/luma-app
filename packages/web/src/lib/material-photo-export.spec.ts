import { describe, expect, it, vi } from 'vitest';
import { loadRowPhotos, photoFileName } from './material-photo-export';
import type { PurchaseRow } from './materials';

describe('photoFileName', () => {
  it('lleva el nombre del material, para que quien la recibe sepa qué es', () => {
    expect(photoFileName('Cemento gris', new Set())).toBe('Cemento gris.jpg');
  });

  it('saca lo que un sistema de archivos rechaza', () => {
    expect(photoFileName('Caño 1/2" : gris?', new Set())).toBe('Caño 1 2 gris.jpg');
  });

  it('dos materiales con el mismo nombre no se pisan en un mismo envío', () => {
    const taken = new Set<string>();
    expect(photoFileName('Ladrillo', taken)).toBe('Ladrillo.jpg');
    expect(photoFileName('ladrillo', taken)).toBe('ladrillo (2).jpg');
    expect(photoFileName('Ladrillo', taken)).toBe('Ladrillo (3).jpg');
  });

  it('un nombre que queda vacío no deja un archivo sin nombre', () => {
    expect(photoFileName('///', new Set())).toBe('material.jpg');
  });
});

describe('loadRowPhotos', () => {
  const row = (id: string, photoVersion: string | null): PurchaseRow => ({
    id,
    name: id,
    quantity: 1,
    unit: 'un',
    supplier: null,
    tagged: false,
    photoVersion,
  });

  it('sólo pide las filas que tienen foto, con su versión', async () => {
    const load = vi.fn().mockResolvedValue(new Blob(['x']));

    const photos = await loadRowPhotos([row('a', 'v1'), row('b', null)], load);

    expect(load).toHaveBeenCalledTimes(1);
    expect(load).toHaveBeenCalledWith('a', 'v1');
    expect([...photos.keys()]).toEqual(['a']);
  });

  it('una foto que falla se salta y no tira la lista', async () => {
    const load = vi.fn((id: string) =>
      id === 'rota' ? Promise.reject(new Error('404')) : Promise.resolve(new Blob(['x'])),
    );

    const photos = await loadRowPhotos([row('ok', 'v1'), row('rota', 'v1')], load);

    expect([...photos.keys()]).toEqual(['ok']);
  });
});
