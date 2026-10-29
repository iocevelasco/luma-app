import fs from 'node:fs';
import path from 'node:path';

/**
 * Las cuentas fijas de E2E, una por tipo de usuario.
 *
 * La lista vive en `e2e/fixtures/users.json`, que es también lo que siembra
 * `pnpm seed:e2e` (el globalSetup lo corre solo antes de cada tanda local).
 * Un spec nunca escribe un email y una contraseña a mano: pide la cuenta por
 * su clave.
 *
 * | Clave        | Qué es                                                  |
 * |--------------|---------------------------------------------------------|
 * | `admin`      | Admin de plataforma. Es la sesión por defecto de la suite |
 * | `user`       | Usuario común sin obras: ve el estado vacío del panel   |
 * | `gerente`    | Dueño de la obra compartida (`E2E_PROJECT_NAME`)        |
 * | `supervisor` | Supervisor en esa obra                                  |
 * | `contador`   | Contador en esa obra                                    |
 * | `cliente`    | Cliente en esa obra                                     |
 * | `inactive`   | Cuenta dada de baja: el login la rechaza                |
 *
 * La obra compartida es para **mirar**, no para mutar: todas las tandas
 * entran a la misma. Un spec que crea, mueve o borra cosas arma su propia
 * obra (con el gerente o con una cuenta registrada en el momento).
 *
 * Contra un entorno remoto no se siembra nada: cada cuenta se puede apuntar a
 * otra con `E2E_<CLAVE>_EMAIL` / `E2E_<CLAVE>_PASSWORD` (p. ej.
 * `E2E_SUPERVISOR_EMAIL`).
 */
export type E2EUserKey =
  | 'admin'
  | 'user'
  | 'gerente'
  | 'cogerente'
  | 'supervisor'
  | 'contador'
  | 'cliente'
  | 'inactive';

/** Los roles de obra que tienen una cuenta fija en la obra compartida. */
export type E2EProjectRoleKey = 'gerente' | 'supervisor' | 'contador' | 'cliente';

interface E2EUserFixture {
  email: string;
  password: string;
  name: string;
  platformRole: 'admin' | 'user';
  projectRole?: E2EProjectRoleKey;
  /** Quien creó la obra compartida (hay dos gerentes: sólo uno la creó). */
  projectOwner?: boolean;
  accountStatus?: 'active' | 'inactive';
}

interface E2EFixture {
  project: { name: string };
  users: Record<E2EUserKey, E2EUserFixture>;
}

export interface E2EUser extends E2EUserFixture {
  key: E2EUserKey;
}

const FIXTURE: E2EFixture = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), 'e2e/fixtures/users.json'), 'utf8'),
);

/** Nombre de la obra que siembra el seed, con las cuatro personas adentro. */
export const E2E_PROJECT_NAME = FIXTURE.project.name;

/** Credenciales de una cuenta, con los overrides del entorno aplicados. */
export function e2eUser(key: E2EUserKey): E2EUser {
  const fixture = FIXTURE.users[key];
  if (!fixture) throw new Error(`No hay usuario de E2E con la clave "${key}"`);
  const env = `E2E_${key.toUpperCase()}`;
  return {
    ...fixture,
    key,
    email: process.env[`${env}_EMAIL`] ?? fixture.email,
    password: process.env[`${env}_PASSWORD`] ?? fixture.password,
  };
}

/** Todas las cuentas, resueltas. */
export function e2eUsers(): E2EUser[] {
  return (Object.keys(FIXTURE.users) as E2EUserKey[]).map(e2eUser);
}

/** Si la cuenta puede abrir sesión. La dada de baja existe justamente para que no. */
export function canLogIn(user: E2EUser): boolean {
  return (user.accountStatus ?? 'active') === 'active';
}

/**
 * Sesión guardada por el globalSetup para esta cuenta. Se usa con
 * `test.use({ storageState: authFile('supervisor') })` y evita un login por test.
 */
export function authFile(key: E2EUserKey): string {
  return path.join(process.cwd(), '.auth', `${key}.json`);
}
