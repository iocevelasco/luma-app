import { describe, expect, it } from 'vitest';
import { checkMaterialPhoto, MATERIAL_PHOTO_PICK_MAX_BYTES } from './material-photo';

describe('checkMaterialPhoto', () => {
  it('acepta jpg, png y webp dentro del tope', () => {
    for (const type of ['image/jpeg', 'image/png', 'image/webp']) {
      expect(checkMaterialPhoto({ type, size: 1024 })).toBe('ok');
    }
  });

  it('deja elegir una foto de celular de 12 MB: se achica antes de subir', () => {
    expect(checkMaterialPhoto({ type: 'image/jpeg', size: 12 * 1024 * 1024 })).toBe('ok');
  });

  it('acepta justo el tope y rechaza un byte más', () => {
    expect(checkMaterialPhoto({ type: 'image/jpeg', size: MATERIAL_PHOTO_PICK_MAX_BYTES })).toBe('ok');
    expect(checkMaterialPhoto({ type: 'image/jpeg', size: MATERIAL_PHOTO_PICK_MAX_BYTES + 1 })).toBe('size');
  });

  it('rechaza lo que no es una foto soportada', () => {
    expect(checkMaterialPhoto({ type: 'application/pdf', size: 10 })).toBe('type');
    expect(checkMaterialPhoto({ type: 'image/heic', size: 10 })).toBe('type');
    expect(checkMaterialPhoto({ type: '', size: 10 })).toBe('type');
  });
});
