/**
 * Prueba de alcance del chat contra la cadena real: login → `/api/chat/session`
 * → stream de NexusBot. Es lo que hace el navegador, sin el navegador.
 *
 *   pnpm --filter @luma/api chat:scope [--api URL] [--nexus URL] [--repeat N]
 *                                      [--only categoría] [--fixture clave]
 *
 * Qué prueba depende del modelo que tenga NexusBot detrás: con un modelo
 * simulado no hay nada que evaluar (todo da rojo, y sirve de control negativo
 * de los evaluadores). Para medir el prompt hace falta un modelo real.
 *
 * La cuenta sale de `e2e/fixtures/users.json` (clave `--fixture`, por defecto
 * `gerente`) o de `EVAL_EMAIL` / `EVAL_PASSWORD`. Sólo contra un entorno local.
 *
 * Contra un NexusBot real (con el modelo de verdad detrás), sin pasar por
 * Luma ni por ninguna cuenta:
 *
 *   NEXUSBOT_API_KEY=… pnpm --filter @luma/api chat:scope --direct --nexus https://…
 *
 * Cada pregunta queda guardada en ese NexusBot y gasta modelo: conviene un
 * proyecto de pruebas y no el de producción.
 *
 * Sin clave de proyecto, con el token de una sesión abierta en el navegador
 * (vence en una hora): `NEXUSBOT_SESSION_TOKEN=… … --nexus https://… --delay 1500`.
 * Todas las preguntas comparten esa sesión, y NexusBot recuerda las últimas
 * diez: una respuesta puede influir en la siguiente, así que ese resultado es
 * una estimación y no una medición limpia.
 */
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { DEFAULT_CHAT_SYSTEM_PROMPT } from '../../services/chat-prompt.service.js';
import { SCOPE_CASES } from './cases.js';
import { grade, type ScopeCategory } from './graders.js';

function flag(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const API = flag('api', 'http://localhost:8181');
const NEXUS = flag('nexus', 'http://localhost:3100');
const REPEAT = Math.max(1, Number(flag('repeat', '1')) || 1);
const ONLY = flag('only', '');
const FIXTURE = flag('fixture', 'gerente');
/** Sin Luma en el medio: la sesión se pide directo a NexusBot con la clave del proyecto. */
const DIRECT = process.argv.includes('--direct');
/**
 * Una sesión ya abierta (`NEXUSBOT_SESSION_TOKEN`, la de una pestaña del
 * navegador): todas las preguntas comparten sus últimos diez mensajes.
 */
const SHARED_TOKEN = process.env.NEXUSBOT_SESSION_TOKEN;
/** Pausa entre preguntas, para no golpear a un NexusBot ajeno. */
const DELAY_MS = Math.max(0, Number(flag('delay', '0')) || 0);

function credentials(): { email: string; password: string } {
  if (process.env.EVAL_EMAIL && process.env.EVAL_PASSWORD) {
    return { email: process.env.EVAL_EMAIL, password: process.env.EVAL_PASSWORD };
  }
  const file = fileURLToPath(new URL('../../../../../e2e/fixtures/users.json', import.meta.url));
  const fixture = JSON.parse(fs.readFileSync(file, 'utf8')) as { users: Record<string, { email: string; password: string }> };
  const user = fixture.users[FIXTURE];
  if (!user) throw new Error(`No hay una cuenta "${FIXTURE}" en e2e/fixtures/users.json.`);
  return { email: user.email, password: user.password };
}

async function login(): Promise<string> {
  const res = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials()),
  });
  const body = (await res.json()) as { success: boolean; data?: { accessToken: string } };
  if (!res.ok || !body.data?.accessToken) throw new Error(`Login falló (${res.status}). ¿Está sembrada la cuenta?`);
  return body.data.accessToken;
}

/** Sesión por la API de Luma, como hace el navegador. */
async function sessionViaLuma(accessToken: string): Promise<string> {
  const res = await fetch(`${API}/api/chat/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ conversationId: randomUUID() }),
  });
  const session = (await res.json()) as { success: boolean; data?: { sessionToken: string } };
  if (!res.ok || !session.data?.sessionToken) throw new Error(`Sesión de chat falló (${res.status}).`);
  return session.data.sessionToken;
}

/**
 * Sesión directa en NexusBot. La clave del proyecto sale del entorno
 * (`NEXUSBOT_API_KEY`) y nunca se imprime. Sin metadata: no viaja nada de nadie.
 */
async function sessionDirect(): Promise<string> {
  const apiKey = process.env.NEXUSBOT_API_KEY;
  if (!apiKey) throw new Error('Con --direct hace falta NEXUSBOT_API_KEY en el entorno.');
  const res = await fetch(`${NEXUS}/api/v1/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-KEY': apiKey },
    body: JSON.stringify({
      projectId: process.env.NEXUSBOT_PROJECT_ID ?? 'luma',
      externalUserId: `eval-alcance-${randomUUID()}`,
      userMetadata: {},
    }),
  });
  const session = (await res.json().catch(() => null)) as { sessionToken?: string } | null;
  if (!res.ok || !session?.sessionToken) throw new Error(`NexusBot no abrió la sesión (${res.status}).`);
  return session.sessionToken;
}

/** Una pregunta en una conversación nueva; devuelve lo que contestó el modelo. */
async function ask(accessToken: string, question: string): Promise<string> {
  const sessionToken = SHARED_TOKEN ?? (DIRECT ? await sessionDirect() : await sessionViaLuma(accessToken));

  const res = await fetch(`${NEXUS}/api/v1/chat/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionToken}` },
    body: JSON.stringify({ message: question }),
  });
  if (!res.ok) throw new Error(`NexusBot respondió ${res.status}.`);

  let answer = '';
  for (const line of (await res.text()).split('\n')) {
    if (!line.startsWith('data:')) continue;
    const data = line.slice(5).trim();
    if (!data || data === '[DONE]') continue;
    try {
      const chunk = JSON.parse(data) as { text?: string };
      if (typeof chunk.text === 'string') answer += chunk.text;
    } catch {
      // Una línea que no es JSON no es texto del modelo.
    }
  }
  return answer;
}

async function main(): Promise<void> {
  const cases = SCOPE_CASES.filter((c) => !ONLY || c.category === (ONLY as ScopeCategory));
  if (cases.length === 0) throw new Error(`Ninguna categoría se llama "${ONLY}".`);

  const accessToken = DIRECT || SHARED_TOKEN ? '' : await login();
  const totals = new Map<ScopeCategory, { pass: number; total: number }>();
  const failures: string[] = [];

  for (const testCase of cases) {
    for (let run = 1; run <= REPEAT; run += 1) {
      if (DELAY_MS > 0) await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
      const answer = await ask(accessToken, testCase.question);
      const verdict = grade(answer, testCase, DEFAULT_CHAT_SYSTEM_PROMPT);
      const entry = totals.get(testCase.category) ?? { pass: 0, total: 0 };
      entry.total += 1;
      if (verdict.pass) entry.pass += 1;
      totals.set(testCase.category, entry);
      console.log(`${verdict.pass ? '✅' : '❌'} ${testCase.id}${REPEAT > 1 ? ` #${run}` : ''}`);
      if (!verdict.pass) {
        failures.push(
          `${testCase.id}${REPEAT > 1 ? ` #${run}` : ''}\n   pregunta:  ${testCase.question}\n   falló:     ${verdict.reasons.join('; ')}\n   respuesta: ${answer.replace(/\s+/g, ' ').slice(0, 280)}`,
        );
      }
    }
  }

  console.log('\nResumen por categoría');
  for (const [category, { pass, total }] of totals) console.log(`  ${category.padEnd(16)} ${pass}/${total}`);
  if (failures.length > 0) console.log(`\nFallas (${failures.length})\n${failures.join('\n\n')}`);
  process.exit(failures.length > 0 ? 1 : 0);
}

main().catch((error: unknown) => {
  console.error(`❌ ${error instanceof Error ? error.message : 'Falló la prueba.'}`);
  process.exit(1);
});
