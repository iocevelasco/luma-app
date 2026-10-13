// Da de baja cuentas: baja LÓGICA, no borrado.
//
// El proyecto no borra documentos de usuario (CLAUDE.md, "Baja lógica"), y con
// razón: actividades, gastos, hitos, materiales, membresías y notificaciones
// referencian a `User`. Un documento borrado deja todo eso apuntando a la
// nada, y los populate devuelven `null`. La baja es reversible; el borrado no.
//
// Por cada email:
//   - enabled / account_status → false / 'inactive', y deactivated_at = ahora
//   - tokens de activación, reset y cambio de email → se borran, para que un
//     enlace viejo no pueda reactivar la cuenta (`/activate` no mira `enabled`)
// NO toca contraseña, roles, membresías, obras ni el email. Si el email no
// existe no inventa nada: lista direcciones parecidas.
//
// Guards — una cuenta se OMITE (no se toca) si:
//   - es admin.                                                  → ALLOW_ADMIN=1
//   - es gerente de una o más obras (las dejaría sin gerente).   → FORCE=1
// Una cuenta que ya estaba dada de baja sale como "YA DADA DE BAJA" y no se toca.
//
// Qué NO corta: una sesión que ya esté abierta. El access token dura 7 días y
// `isAuthenticated` sólo verifica la firma del JWT, no consulta la base. El
// login y la renovación (/refresh) sí quedan bloqueados desde ya.
//
// Revertir: `activate-users.mjs` con FORCE=1 levanta la baja (y pone una
// contraseña temporal nueva).
//
// Uso — copiar el archivo dentro del contenedor de `app`, en
// /app/packages/api, para que `mongoose` se resuelva. `MONGODB_URI` ya está
// en el entorno del contenedor:
//
//   DRY_RUN=1 node deactivate-users.mjs a@x.com b@y.com   # en seco: no escribe
//   node deactivate-users.mjs a@x.com b@y.com             # de verdad
//
// Código de salida: 2 si algún email no existe, 3 si alguno se omitió, 0 si todo se aplicó.

import mongoose from 'mongoose';

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
const db = mongoose.connection;
const users = db.collection('users');
console.log(`Base: ${db.name}${dryRun ? '  (DRY_RUN: no se escribe nada)' : ''}\n`);

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

  // Lo que se vería afectado: sirve para decidir antes de apretar el botón.
  const [ownedProjects, projectRoles, companies] = await Promise.all([
    db.collection('projects').countDocuments({ createdBy: user._id }),
    db.collection('projectmemberships').countDocuments({ user: user._id }),
    db.collection('organizationmembers').countDocuments({ user: user._id }),
  ]);
  const links = `gerente de ${ownedProjects} obra(s), ${projectRoles} acceso(s) a obras, ${companies} Empresa(s)`;

  const inactive = user.enabled === false || user.account_status === 'inactive';
  const before = [
    inactive ? 'DESHABILITADA' : 'habilitada',
    user.role === 'admin' ? 'ADMIN' : null,
    user.password ? 'con contraseña' : 'SIN contraseña',
  ]
    .filter(Boolean)
    .join(', ');

  if (inactive) {
    results.push({ email, status: 'YA DADA DE BAJA', name: user.name, before, links });
    continue;
  }

  const skip =
    user.role === 'admin' && !allowAdmin
      ? 'es admin: ALLOW_ADMIN=1 para tocarla'
      : ownedProjects > 0 && !force
        ? `es gerente de ${ownedProjects} obra(s) y quedarían sin gerente: FORCE=1 para darla de baja igual`
        : null;

  if (skip) {
    results.push({ email, status: 'OMITIDA', name: user.name, before, links, note: skip });
    continue;
  }

  if (!dryRun) {
    await users.updateOne(
      { _id: user._id },
      {
        $set: {
          enabled: false,
          account_status: 'inactive',
          deactivated_at: new Date(),
          updatedAt: new Date(),
        },
        $unset: {
          emailVerificationToken: '',
          emailVerificationTokenExpires: '',
          resetToken: '',
          resetTokenExpires: '',
          emailChangeToken: '',
          emailChangeTokenExpires: '',
          pendingEmail: '',
          activationLinkHeldBy: '',
          claimedViaLinkBy: '',
        },
      },
    );
  }

  results.push({
    email,
    status: dryRun ? 'lista para dar de baja (en seco)' : 'DADA DE BAJA',
    name: user.name,
    before,
    links,
  });
}

await mongoose.disconnect();

console.log('─'.repeat(70));
for (const r of results) {
  console.log(`${r.email}\n  estado:   ${r.status}`);
  if (r.name) console.log(`  nombre:   ${r.name}\n  antes:    ${r.before}`);
  if (r.links) console.log(`  vínculos: ${r.links}`);
  if (r.note) console.log(`  ${r.status === 'OMITIDA' ? 'motivo' : 'parecidos'}:   ${r.note}`);
  console.log();
}
if (!dryRun && results.some((r) => r.status === 'DADA DE BAJA')) {
  console.log('Ojo: una sesión ya abierta puede seguir andando hasta 7 días (el access token no');
  console.log('consulta la base). El login y la renovación quedan bloqueados desde ahora.');
}
const missing = results.some((r) => r.status === 'NO EXISTE');
const omitted = results.some((r) => r.status === 'OMITIDA');
process.exit(missing ? 2 : omitted ? 3 : 0);
