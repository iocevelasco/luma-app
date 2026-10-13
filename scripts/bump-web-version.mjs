#!/usr/bin/env node
//
// Sube la versión de la SPA (packages/web/package.json) siguiendo semver.org.
//
//   pnpm bump:web patch            # 0.2.0 → 0.2.1   arreglo, sin cambio visible
//   pnpm bump:web minor            # 0.2.0 → 0.3.0   funcionalidad nueva
//   pnpm bump:web major            # 0.2.0 → 1.0.0   cambio que rompe algo
//   pnpm bump:web 1.4.0            # versión explícita (tiene que ser mayor)
//   pnpm bump:web patch --dry-run  # muestra el cambio y no escribe
//
// Por qué sólo la SPA: es la única pieza que vive en el navegador de la gente,
// y la única que puede quedar vieja ahí. La app compara esta versión contra
// /version.json (ver hooks/use-version-check.ts) para avisar que hay un deploy
// nuevo. La API, la landing y el package.json de la raíz no se tocan.
//
// Se reemplaza la línea `"version"` en el texto y no se reescribe el JSON entero:
// el diff queda en una línea y no se reformatea nada.

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// MAJOR.MINOR.PATCH sin ceros a la izquierda — semver.org, punto 2.
const CORE = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const KINDS = ['major', 'minor', 'patch'];

export function parse(version) {
  const match = CORE.exec(version);
  if (!match) return null;
  return match.slice(1).map(Number);
}

/** `kind` es major | minor | patch, o una versión X.Y.Z explícita. */
export function bump(current, kind) {
  const from = parse(current);
  if (!from) throw new Error(`La versión actual "${current}" no es semver X.Y.Z.`);
  const [major, minor, patch] = from;

  if (kind === 'major') return `${major + 1}.0.0`;
  if (kind === 'minor') return `${major}.${minor + 1}.0`;
  if (kind === 'patch') return `${major}.${minor}.${patch + 1}`;

  const to = parse(kind);
  if (!to) {
    throw new Error(`"${kind}" no es major, minor, patch ni una versión X.Y.Z válida.`);
  }
  // Precedencia semver: se compara número a número, no como texto ("0.10.0" > "0.9.0").
  const greater = to[0] - from[0] || to[1] - from[1] || to[2] - from[2];
  if (greater <= 0) {
    throw new Error(`${kind} no es mayor que la versión actual (${current}).`);
  }
  return kind;
}

function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const [kind] = args.filter((arg) => !arg.startsWith('--'));

  if (!kind) {
    console.error(`uso: pnpm bump:web <${KINDS.join('|')}|X.Y.Z> [--dry-run]`);
    process.exit(2);
  }

  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const file = resolve(root, 'packages/web/package.json');
  const source = readFileSync(file, 'utf8');

  const line = /^(\s*"version":\s*")([^"]+)(",?)$/m;
  const found = line.exec(source);
  if (!found) {
    console.error('No encontré la línea "version" en packages/web/package.json.');
    process.exit(1);
  }

  const current = found[2];
  let next;
  try {
    next = bump(current, kind);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }

  if (!dryRun) {
    writeFileSync(file, source.replace(line, `$1${next}$3`));
  }
  console.log(`@luma/web  ${current} → ${next}${dryRun ? '  (dry-run, no se escribió)' : ''}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
