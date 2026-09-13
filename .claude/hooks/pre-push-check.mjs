/**
 * Decide si un comando de Bash es un `git push` a main.
 *
 * Lee el payload del hook por stdin y la rama actual por la env var RAMA.
 * Sale con 0 si el comando puede correr, con 1 si hay que bloquearlo (el .sh
 * que lo envuelve traduce eso al código 2 que espera el hook).
 *
 * La parte delicada es no confundir un push con una MENCIÓN de un push. Un
 * `git commit` cuyo mensaje dice "no pushees a main" no es un push, y un grep
 * suelto sobre el comando entero lo trata como si lo fuera.
 */

const payload = await new Promise((resolve) => {
  let s = '';
  process.stdin.on('data', (d) => (s += d));
  process.stdin.on('end', () => resolve(s));
});

let cmd = '';
try {
  cmd = JSON.parse(payload)?.tool_input?.command ?? '';
} catch {
  process.exit(0); // payload ilegible: no es asunto de este hook
}
if (!cmd) process.exit(0);

/**
 * Saca del comando todo lo que es DATO y no código ejecutable: cuerpos de
 * heredoc y strings entre comillas. Lo que queda es la estructura del comando.
 */
function soloCodigo(texto) {
  let s = texto;

  // Cuerpos de heredoc: <<EOF … EOF, <<'EOF' … EOF, <<-"EOF" … EOF
  s = s.replace(/<<-?\s*(['"]?)([A-Za-z_][A-Za-z0-9_]*)\1[\s\S]*?^\s*\2\s*$/gm, '<<HEREDOC');
  // Un heredoc sin terminador (comando truncado): borrá de ahí hasta el final.
  s = s.replace(/<<-?\s*(['"]?)([A-Za-z_][A-Za-z0-9_]*)\1[\s\S]*$/m, '<<HEREDOC');

  // Strings entre comillas.
  s = s.replace(/'[^']*'/g, "''");
  s = s.replace(/"(?:[^"\\]|\\.)*"/g, '""');

  return s;
}

const codigo = soloCodigo(cmd);

/**
 * Las invocaciones de `git push` que están en posición de comando: al principio,
 * o después de un separador (; && || | & ( { newline).
 */
const invocaciones = [...codigo.matchAll(/(?:^|[;&|(){]|\n)\s*(git\s+push\b[^;&|(){\n]*)/g)].map(
  (m) => m[1].trim(),
);

if (invocaciones.length === 0) process.exit(0);

const RAMA = process.env.RAMA ?? '';
const PROTEGIDAS = ['main', 'master'];

function bloquear(motivo) {
  console.log(`Push bloqueado: el destino es ${motivo}.

En este repo no se pushea a main. El flujo es rama de feature + PR:

  git checkout -b <tipo>/<nombre-corto>
  git push -u origin <tipo>/<nombre-corto>

Si el commit ya está en main localmente, moverlo a una rama:

  git branch <tipo>/<nombre-corto>
  git reset --hard origin/main
  git checkout <tipo>/<nombre-corto>`);
  process.exit(1);
}

for (const inv of invocaciones) {
  // Argumentos posicionales: sacamos `git push` y todas las flags.
  const args = inv
    .split(/\s+/)
    .slice(2)
    .filter((a) => !a.startsWith('-'));

  // Refspec con destino protegido: origin HEAD:main, origin rama:master
  for (const a of args) {
    const destino = a.includes(':') ? a.split(':').pop() : null;
    if (destino && PROTEGIDAS.includes(destino)) bloquear(`\`${destino}\` (por refspec)`);
  }

  // Destino explícito: git push origin main  →  args = [origin, main]
  if (args.length >= 2 && PROTEGIDAS.includes(args[1])) {
    bloquear(`\`${args[1]}\` (explícito en el comando)`);
  }

  // Un solo argumento que es una rama protegida: git push main
  if (args.length === 1 && PROTEGIDAS.includes(args[0])) {
    bloquear(`\`${args[0]}\` (explícito en el comando)`);
  }

  // Sin rama en el comando: se empuja la actual.
  //
  // Son dos casos y los dos cuentan: `git push` pelado (0 argumentos) y
  // `git push -u origin` (1 argumento, que es el remote). En el segundo, git
  // resuelve la rama sola — y si estás parado en main, va a main.
  const sinRamaExplicita = args.length === 0 || (args.length === 1 && !PROTEGIDAS.includes(args[0]));
  if (sinRamaExplicita && PROTEGIDAS.includes(RAMA)) {
    bloquear(`\`${RAMA}\` (la rama actual, sin destino explícito en el comando)`);
  }
}

process.exit(0);
