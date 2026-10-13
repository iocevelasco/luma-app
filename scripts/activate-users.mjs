// Activa cuentas y les pone una contraseña temporal.
//
// Para cuentas creadas por invitación que nunca llegaron a activarse (el mail
// no salió, venció el enlace de 72 h, o la dirección tenía un error de tipeo).
// Si el mail no sale, desde la app el dueño ya puede copiar el enlace de
// activación; esto es la salida de emergencia cuando eso no alcanzó.
//
// Por cada email:
//   - password            → una temporal, generada acá (bcrypt 10 rondas, igual que la API)
//   - email_verified      → true, y se borran los tokens de activación y de reset
//   - enabled / status    → true / 'active' (levanta una baja lógica si la hubiera)
// NO crea usuarios, NO toca roles, membresías ni el email. Si el email no
// existe no inventa nada: lista direcciones parecidas.
//
// Guards — una cuenta se OMITE (no se toca) si:
//   - ya funciona: tiene contraseña, está verificada y habilitada.   → FORCE=1 la pisa
//   - fue dada de baja (enabled=false o status 'inactive').           → FORCE=1 la levanta
//   - es admin.                                                       → ALLOW_ADMIN=1
// Sin esto, pasar por error el email del dueño le cambiaba la contraseña.
//
// Uso — se copia dentro del contenedor de `app` para que `mongoose` y
// `bcryptjs` se resuelvan desde packages/api. `MONGODB_URI` ya está en el
// entorno del contenedor:
//
//   docker cp scripts/activate-users.mjs <container>:/app/packages/api/activate-users.mjs
//   docker exec -e DRY_RUN=1 -w /app/packages/api <container> \
//     node activate-users.mjs a@x.com b@y.com          # en seco: no escribe
//   docker exec -w /app/packages/api <container> \
//     node activate-users.mjs a@x.com b@y.com          # de verdad
//   docker exec <container> rm /app/packages/api/activate-users.mjs
//
// Las contraseñas salen UNA vez por stdout. No se guardan en ningún lado.
// Código de salida: 2 si algún email no existe, 3 si alguno se omitió, 0 si todo se aplicó.

import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';

const BCRYPT_ROUNDS = 10;
// Sin 0/O ni 1/l/I: se las van a dictar por teléfono o tipear a mano.
const ALPHABET = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function tempPassword(length = 12) {
  let out = '';
  while (out.length < length) {
    const byte = crypto.randomBytes(1)[0];
    // Rechazo por módulo: sin sesgo hacia los primeros caracteres.
    if (byte < Math.floor(256 / ALPHABET.length) * ALPHABET.length) {
      out += ALPHABET[byte % ALPHABET.length];
    }
  }
  return out;
}

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const uri = process.env.MONGODB_URI;
const dryRun = process.env.DRY_RUN === '1';
const force = process.env.FORCE === '1';
const allowAdmin = process.env.ALLOW_ADMIN === '1';
const emails = process.argv
  .slice(1)
  .filter((a) => a.includes('@'))
  .map((e) => e.trim().toLowerCase());

if (!uri) {
  console.error('Falta MONGODB_URI.');
  process.exit(1);
}
if (emails.length === 0) {
  console.error('Pasá al menos un email como argumento.');
  process.exit(1);
}

await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
const users = mongoose.connection.collection('users');
console.log(`Base: ${mongoose.connection.name}${dryRun ? '  (DRY_RUN: no se escribe nada)' : ''}\n`);

const results = [];
for (const email of emails) {
  const user = await users.findOne({ email });

  if (!user) {
    const local = email.split('@')[0];
    const near = await users
      .find({ email: { $regex: `^${escapeRegex(local)}`, $options: 'i' } })
      .project({ email: 1 })
      .limit(5)
      .toArray();
    results.push({
      email,
      status: 'NO EXISTE',
      note: near.map((u) => u.email).join(', ') || 'sin parecidos',
    });
    continue;
  }

  const disabled = user.enabled === false || user.account_status === 'inactive';
  const working = Boolean(user.password) && user.email_verified === true && !user.claimedViaLinkBy;

  const before = [
    user.password ? 'con contraseña' : 'SIN contraseña',
    user.email_verified ? 'verificada' : 'sin verificar',
    disabled ? 'DESHABILITADA' : 'habilitada',
    user.role === 'admin' ? 'ADMIN' : null,
  ]
    .filter(Boolean)
    .join(', ');

  const skip =
    user.role === 'admin' && !allowAdmin
      ? 'es admin: ALLOW_ADMIN=1 para tocarla'
      : disabled && !force
        ? 'está dada de baja, y fue a propósito: FORCE=1 para levantarla'
        : working && !force
          ? 'ya funciona (tiene contraseña y está verificada): FORCE=1 para pisarla'
          : null;

  if (skip) {
    results.push({ email, status: 'OMITIDA', name: user.name, before, note: skip });
    continue;
  }

  const password = tempPassword();
  if (!dryRun) {
    await users.updateOne(
      { _id: user._id },
      {
        $set: {
          password: await bcrypt.hash(password, BCRYPT_ROUNDS),
          email_verified: true,
          enabled: true,
          account_status: 'active',
          updatedAt: new Date(),
        },
        $unset: {
          emailVerificationToken: '',
          emailVerificationTokenExpires: '',
          resetToken: '',
          resetTokenExpires: '',
          deactivated_at: '',
          deactivated_by: '',
          // Las verificó quien corre esto, con acceso a la base: ya no hay enlace en juego.
          activationLinkHeldBy: '',
          claimedViaLinkBy: '',
        },
      },
    );
  }

  results.push({ email, status: dryRun ? 'listo (en seco)' : 'ACTIVADA', name: user.name, before, password });
}

await mongoose.disconnect();

console.log('─'.repeat(70));
for (const r of results) {
  console.log(`${r.email}\n  estado:  ${r.status}`);
  if (r.name) console.log(`  nombre:  ${r.name}\n  antes:   ${r.before}`);
  if (r.password && !dryRun) console.log(`  clave temporal:  ${r.password}`);
  if (r.note) console.log(`  ${r.status === 'OMITIDA' ? 'motivo' : 'parecidos'}: ${r.note}`);
  console.log();
}
const missing = results.some((r) => r.status === 'NO EXISTE');
const omitted = results.some((r) => r.status === 'OMITIDA');
process.exit(missing ? 2 : omitted ? 3 : 0);
