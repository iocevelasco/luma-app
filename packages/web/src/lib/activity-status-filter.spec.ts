import { describe, expect, it } from 'vitest';
import { parseStatusFilter, serializeStatusFilter } from './activity-status-filter';

describe('parseStatusFilter', () => {
  it('sin parámetro no filtra', () => {
    expect(parseStatusFilter(null)).toEqual([]);
    expect(parseStatusFilter('')).toEqual([]);
  });

  it('descarta lo que no es un estado y respeta el orden del ciclo', () => {
    expect(parseStatusFilter('completada,foo,pendiente')).toEqual(['pendiente', 'completada']);
  });
});

describe('serializeStatusFilter', () => {
  it('ordena y saca el parámetro cuando no queda nada', () => {
    expect(serializeStatusFilter(['en_revision', 'en_curso'])).toBe('en_curso,en_revision');
    expect(serializeStatusFilter([])).toBeNull();
  });
});
