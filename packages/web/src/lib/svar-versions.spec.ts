import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Las librerías de SVAR se usan apoyándose en cosas que no son su API: el
 * encabezado de las columnas del Tablero pasa un nodo de React donde el tipo
 * dice `string`, y el Cronograma lee clases internas del DOM. Un `^` en la
 * versión dejaría que una actualización menor lo rompa sin que nadie la haya
 * decidido: se suben a mano, revisando esos puntos.
 */
const { dependencies } = JSON.parse(
  readFileSync(resolve(__dirname, '../../package.json'), 'utf8'),
) as { dependencies: Record<string, string> };

describe('versiones de SVAR', () => {
  it.each(['@svar-ui/react-kanban', '@svar-ui/react-gantt'])('%s está fijada a una versión exacta', (name) => {
    expect(dependencies[name]).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
