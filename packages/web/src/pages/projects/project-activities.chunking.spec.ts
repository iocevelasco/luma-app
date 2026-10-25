import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * La pantalla de Actividades pesaba 418 kB porque traía el Cronograma y el
 * Tablero (cada uno con su librería) y el armado del PDF aunque se abriera la
 * Lista. Se bajan al abrir la vista. Sin esto, un `import` cualquiera de
 * esos módulos los vuelve a meter en el chunk de la pantalla y nada lo avisa.
 */
const source = readFileSync(resolve(__dirname, 'project-activities.tsx'), 'utf8');

describe('project-activities: lo pesado se baja cuando hace falta', () => {
  it.each([
    '@/components/activities/activity-gantt',
    '@/components/activities/task-board',
    '@/lib/activities-day-pdf',
  ])('%s no se importa de forma estática', (module) => {
    const staticImport = new RegExp(`^import[^;]*from '${module}'`, 'm');
    expect(source).not.toMatch(staticImport);
  });

  it('el Cronograma y el Tablero se piden con import()', () => {
    expect(source).toContain("import('@/components/activities/activity-gantt')");
    expect(source).toContain("import('@/components/activities/task-board')");
  });
});
