import { describe, expect, it } from 'vitest';
import type { CrewDirectoryEntry } from '@luma/shared';
import { ApiError } from './api-client';
import { crewDuplicateOf, matchCrewDirectory } from './crew-directory';

const entry = (id: string, name: string): CrewDirectoryEntry => ({
  id,
  name,
  kind: 'persona',
  isLead: false,
});

const directory = [
  entry('1', 'Juan Pérez'),
  entry('2', 'Juana Gómez'),
  entry('3', 'Pedro Muñoz'),
];

describe('matchCrewDirectory', () => {
  it('encuentra sin tildes ni mayúsculas', () => {
    expect(matchCrewDirectory(directory, 'JUAN PEREZ').map((e) => e.id)).toEqual(['1']);
  });

  it('cada palabra tipeada es el comienzo de una palabra del nombre', () => {
    expect(matchCrewDirectory(directory, 'juan').map((e) => e.id)).toEqual(['1', '2']);
    expect(matchCrewDirectory(directory, 'perez').map((e) => e.id)).toEqual(['1']);
    expect(matchCrewDirectory(directory, 'pe mu').map((e) => e.id)).toEqual(['3']);
  });

  it('no sugiere por una letra suelta', () => {
    expect(matchCrewDirectory(directory, 'j')).toEqual([]);
    expect(matchCrewDirectory(directory, '   ')).toEqual([]);
  });

  it('no encuentra por el medio de una palabra', () => {
    expect(matchCrewDirectory(directory, 'uan')).toEqual([]);
  });

  it('respeta el tope', () => {
    const many = Array.from({ length: 8 }, (_, i) => entry(String(i), `Juan ${i}`));
    expect(matchCrewDirectory(many, 'juan')).toHaveLength(5);
  });
});

describe('crewDuplicateOf', () => {
  const details = {
    reason: 'name',
    existing: { id: '1', name: 'Juan Pérez', kind: 'persona', isLead: false, active: true },
    alreadyInProject: false,
  };

  it('lee el details de un 409 de duplicado', () => {
    const error = new ApiError('Ya hay alguien', 409, 'CONFLICT', undefined, details);
    expect(crewDuplicateOf(error)).toEqual(details);
  });

  it('un 409 de otra cosa no es un duplicado', () => {
    expect(crewDuplicateOf(new ApiError('Otra cosa', 409, 'CONFLICT'))).toBeNull();
  });

  it('otro código no es un duplicado aunque traiga details', () => {
    expect(crewDuplicateOf(new ApiError('x', 400, 'VALIDATION', undefined, details))).toBeNull();
  });

  it('un error que no es de la API no es un duplicado', () => {
    expect(crewDuplicateOf(new Error('boom'))).toBeNull();
    expect(crewDuplicateOf(null)).toBeNull();
  });
});
